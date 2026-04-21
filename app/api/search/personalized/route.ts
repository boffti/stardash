import { NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { after } from 'next/server'
import { getValidGitHubToken } from '@/lib/tokens'
import { getAIModel, getProviderOptions } from '@/lib/ai-provider'
import { langfuseSpanProcessor } from '@/instrumentation'
import type { SearchRepo } from '../repos/route'

export const maxDuration = 60

interface RepoSample {
  name: string
  description: string
  language: string | null
  topics: string[]
}

export interface PersonalizedTheme {
  theme: string
  description: string
  repos: SearchRepo[]
}

const ThemeSearchSchema = z.object({
  themes: z.array(z.object({
    theme: z.string().describe('Short theme name, e.g. "Rust async runtimes"'),
    description: z.string().describe('One sentence: why this gap exists based on their stars'),
    searchQuery: z.string().describe('GitHub search query string to find repos for this theme'),
  })),
})

async function searchGitHub(query: string, token: string | null) {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=8`
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(url, { headers })
  if (!res.ok) return []
  const data = await res.json()
  return data.items ?? []
}

export async function POST(request: Request) {
  try {
    const { repos: repoSample } = await request.json() as { repos: RepoSample[] }

    if (!repoSample?.length) {
      return NextResponse.json({ themes: [] })
    }

    // GitHub token is optional — degrade gracefully if missing
    const { token } = await getValidGitHubToken()

    const modelConfig = getAIModel(request)

    const sample = repoSample.slice(0, 100)
    const sampleText = sample.map(r =>
      `${r.name} (${r.language ?? 'unknown'}) — ${r.description} [${r.topics.slice(0, 3).join(', ')}]`
    ).join('\n')

    const { object: themeSearch } = await generateObject({
      model: modelConfig.model,
      schema: ThemeSearchSchema,
      prompt: `Analyze this developer's GitHub starred repos and identify 2-4 interesting gaps or adjacent areas they might want to explore.

Their starred repos (sample of ${sample.length}):
${sampleText}

For each gap/theme:
- Give it a compelling short name (e.g. "Rust async runtimes", "AI observability tools")
- Write one sentence explaining why this is relevant to their existing stars
- Write a targeted GitHub search query (use stars:>200 for quality)

Focus on genuinely useful adjacent tools, not obvious overlaps with what they already have.`,
      experimental_telemetry: { isEnabled: true, functionId: 'personalized-theme-search' },
      providerOptions: getProviderOptions(modelConfig.provider),
    })

    // Fetch repos for each theme in parallel
    const themeResults = await Promise.all(
      themeSearch.themes.map(async theme => {
        const items = await searchGitHub(theme.searchQuery, token)
        const repos: SearchRepo[] = items.map((item: {
          id: number
          full_name: string
          name: string
          owner: { login: string; avatar_url: string }
          description: string | null
          stargazers_count: number
          forks_count: number
          language: string | null
          topics: string[]
          pushed_at: string
          html_url: string
        }) => ({
          id: item.id,
          fullName: item.full_name,
          name: item.name,
          owner: item.owner.login,
          avatarUrl: item.owner.avatar_url,
          description: item.description,
          stargazersCount: item.stargazers_count,
          forksCount: item.forks_count,
          language: item.language,
          topics: item.topics ?? [],
          pushedAt: item.pushed_at,
          htmlUrl: item.html_url,
          evidence: [],
          relevanceScore: 0,
        }))
        return {
          theme: theme.theme,
          description: theme.description,
          repos,
        } as PersonalizedTheme
      })
    )

    const themes = themeResults.filter(t => t.repos.length > 0)

    after(async () => { await langfuseSpanProcessor?.forceFlush() })
    return NextResponse.json({ themes })
  } catch (err) {
    Sentry.captureException(err)
    console.error('Personalized search error:', err)
    return NextResponse.json({ error: 'Personalized search failed' }, { status: 500 })
  }
}
