import { NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { after } from 'next/server'
import { getValidGitHubToken } from '@/lib/tokens'
import { getAIModel, getProviderOptions } from '@/lib/ai-provider'
import { langfuseSpanProcessor } from '@/instrumentation'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

interface GitHubSearchItem {
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
}

export interface SearchRepo {
  id: number
  fullName: string
  name: string
  owner: string
  avatarUrl: string
  description: string | null
  stargazersCount: number
  forksCount: number
  language: string | null
  topics: string[]
  pushedAt: string
  htmlUrl: string
  evidence: string[]
  relevanceScore: number
}

const QueryExpansionSchema = z.object({
  queries: z.array(z.string()).describe(
    'GitHub search query strings using GitHub search syntax. Use operators like stars:>, language:, topic:, in:name,description'
  ),
})

const ReRankingSchema = z.object({
  rankedRepos: z.array(z.object({
    fullName: z.string().describe('Exact full_name of the repo (owner/repo)'),
    relevanceScore: z.number().min(0).max(10).describe('How well this repo matches the original intent (0-10)'),
    evidence: z.array(z.string()).describe(
      'Exactly 3 short evidence bullets explaining why this matches. Each bullet max 60 chars. Examples: "847 commits in 90 days", "Has docs site + wiki", "Matches: prod-ready CLI"'
    ),
  })),
})

async function searchGitHub(query: string, token: string | null): Promise<GitHubSearchItem[]> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=20`
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, {
    headers,
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.items ?? []
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query } = await request.json()
    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 })
    }

    // GitHub's repository search endpoint can return public results without a
    // user token. Keep the Supabase user check above, but do not fail Discover
    // search just because the short-lived GitHub OAuth cookie has expired.
    const { token } = await getValidGitHubToken()

    const modelConfig = getAIModel(request)
    // Step 1: Expand query into GitHub search strings
    const { object: expansion } = await generateObject({
      model: modelConfig.model,
      schema: QueryExpansionSchema,
      prompt: `You are a GitHub search expert. Given a developer's search intent, generate 3-5 targeted GitHub search queries using GitHub search syntax.

Intent: "${query}"

Rules:
- Use GitHub operators: stars:>N, language:X, topic:X, in:name, in:description, is:public
- Vary the queries to cover different interpretations
- Focus on finding high-quality, production-ready repos
- Example for "prod-ready CLI frameworks": ["topic:cli stars:>500 is:public", "cli framework production language:go stars:>200", "topic:cli-app stars:>300 pushed:>2024-01-01"]`,
      experimental_telemetry: { isEnabled: true, functionId: 'search-query-expansion' },
      providerOptions: getProviderOptions(modelConfig.provider),
    })

    // Step 2: Parallel GitHub searches
    const searchResults = await Promise.all(
      expansion.queries.map(q => searchGitHub(q, token))
    )

    // Step 3: Deduplicate
    const seen = new Set<string>()
    const merged: GitHubSearchItem[] = []
    for (const items of searchResults) {
      for (const item of items) {
        if (!seen.has(item.full_name)) {
          seen.add(item.full_name)
          merged.push(item)
        }
      }
    }

    if (merged.length === 0) {
      return NextResponse.json({ repos: [] })
    }

    // Step 4: Re-rank with evidence
    const repoSummaries = merged.map(r => ({
      fullName: r.full_name,
      description: r.description ?? '',
      language: r.language ?? '',
      topics: r.topics.slice(0, 5).join(', '),
      stars: r.stargazers_count,
      pushedAt: r.pushed_at,
    }))

    const { object: ranking } = await generateObject({
      model: modelConfig.model,
      schema: ReRankingSchema,
      prompt: `You are ranking GitHub repos for a developer's search intent.

Original intent: "${query}"

Repos to rank (${merged.length} total):
${JSON.stringify(repoSummaries, null, 2)}

For each repo, provide:
1. relevanceScore (0-10): how well it matches the intent
2. evidence: exactly 3 short bullets explaining WHY it matches. Be specific and factual.
   Good: "12k stars · actively maintained", "Go CLI framework · prod-ready", "Matches: framework intent"
   Bad: "good repo", "relevant", "matches query"

Include ALL repos in your response. Sort by relevanceScore descending.`,
      experimental_telemetry: { isEnabled: true, functionId: 'search-reranking' },
      providerOptions: getProviderOptions(modelConfig.provider),
    })

    // Build ranked result map
    const rankMap = new Map(ranking.rankedRepos.map(r => [r.fullName, r]))

    const repos: SearchRepo[] = merged
      .map(item => {
        const rank = rankMap.get(item.full_name)
        return {
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
          evidence: rank?.evidence ?? [],
          relevanceScore: rank?.relevanceScore ?? 0,
        }
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 24)

    after(async () => { await langfuseSpanProcessor?.forceFlush() })
    return NextResponse.json({ repos })
  } catch (err) {
    Sentry.captureException(err)
    console.error('Search error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
