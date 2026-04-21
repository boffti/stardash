import { NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { after } from 'next/server'
import { getValidGitHubToken } from '@/lib/tokens'
import { getAIModel, getProviderOptions, type AIModelConfig } from '@/lib/ai-provider'
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

export type SearchPipelineStepId = 'auth' | 'expand' | 'github' | 'dedupe' | 'rerank' | 'render'
export type SearchPipelineStatus = 'pending' | 'running' | 'completed' | 'error'

export interface SearchPipelineStepEvent {
  type: 'step'
  id: SearchPipelineStepId
  status: SearchPipelineStatus
  title: string
  detail: string
  elapsedMs?: number
  meta?: Record<string, string | number | boolean>
}

export interface SearchPipelineResultEvent {
  type: 'result'
  repos: SearchRepo[]
  elapsedMs: number
}

export interface SearchPipelineErrorEvent {
  type: 'error'
  error: string
  elapsedMs: number
}

export type SearchPipelineEvent =
  | SearchPipelineStepEvent
  | SearchPipelineResultEvent
  | SearchPipelineErrorEvent

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

type EmitSearchPipelineEvent = (event: SearchPipelineEvent) => void

function elapsedSince(startedAt: number) {
  return Date.now() - startedAt
}

function repoToSearchRepo(item: GitHubSearchItem, rank?: { evidence: string[]; relevanceScore: number }): SearchRepo {
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
}

async function runSearchPipeline({
  query,
  token,
  modelConfig,
  startedAt,
  emit,
}: {
  query: string
  token: string | null
  modelConfig: AIModelConfig
  startedAt: number
  emit?: EmitSearchPipelineEvent
}) {
  emit?.({
    type: 'step',
    id: 'auth',
    status: 'completed',
    title: 'Session and GitHub access',
    detail: token ? 'Authenticated GitHub search is available.' : 'Using public GitHub search because the GitHub token cookie is unavailable.',
    elapsedMs: elapsedSince(startedAt),
    meta: { githubToken: Boolean(token) },
  })

  emit?.({
    type: 'step',
    id: 'expand',
    status: 'running',
    title: 'Expanding intent',
    detail: 'AI is translating your search into targeted GitHub query syntax.',
    elapsedMs: elapsedSince(startedAt),
  })

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

  emit?.({
    type: 'step',
    id: 'expand',
    status: 'completed',
    title: 'Expanded intent',
    detail: `Generated ${expansion.queries.length} GitHub search queries.`,
    elapsedMs: elapsedSince(startedAt),
    meta: { queryCount: expansion.queries.length },
  })

  emit?.({
    type: 'step',
    id: 'github',
    status: 'running',
    title: 'Searching GitHub',
    detail: 'Running the expanded queries in parallel against GitHub repository search.',
    elapsedMs: elapsedSince(startedAt),
    meta: { queryCount: expansion.queries.length },
  })

  const searchResults = await Promise.all(
    expansion.queries.map(q => searchGitHub(q, token))
  )
  const rawCandidateCount = searchResults.reduce((sum, items) => sum + items.length, 0)

  emit?.({
    type: 'step',
    id: 'github',
    status: 'completed',
    title: 'Fetched candidates',
    detail: `Fetched ${rawCandidateCount} candidate repositories from GitHub.`,
    elapsedMs: elapsedSince(startedAt),
    meta: { candidateCount: rawCandidateCount },
  })

  emit?.({
    type: 'step',
    id: 'dedupe',
    status: 'running',
    title: 'Deduplicating candidates',
    detail: 'Merging overlapping query results before AI reranking.',
    elapsedMs: elapsedSince(startedAt),
  })

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

  emit?.({
    type: 'step',
    id: 'dedupe',
    status: 'completed',
    title: 'Prepared ranking set',
    detail: `${merged.length} unique repositories remain after deduping.`,
    elapsedMs: elapsedSince(startedAt),
    meta: { uniqueCount: merged.length },
  })

  if (merged.length === 0) {
    emit?.({
      type: 'step',
      id: 'render',
      status: 'completed',
      title: 'No matches found',
      detail: 'GitHub returned no candidates for the expanded searches.',
      elapsedMs: elapsedSince(startedAt),
      meta: { resultCount: 0 },
    })
    return []
  }

  emit?.({
    type: 'step',
    id: 'rerank',
    status: 'running',
    title: 'AI reranking',
    detail: 'AI is scoring each repository and writing short evidence notes.',
    elapsedMs: elapsedSince(startedAt),
    meta: { uniqueCount: merged.length },
  })

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

  emit?.({
    type: 'step',
    id: 'rerank',
    status: 'completed',
    title: 'Ranked repositories',
    detail: `AI returned relevance scores for ${ranking.rankedRepos.length} repositories.`,
    elapsedMs: elapsedSince(startedAt),
    meta: { rankedCount: ranking.rankedRepos.length },
  })

  emit?.({
    type: 'step',
    id: 'render',
    status: 'running',
    title: 'Preparing results',
    detail: 'Sorting ranked repositories and trimming the final result set.',
    elapsedMs: elapsedSince(startedAt),
  })

  const rankMap = new Map(ranking.rankedRepos.map(r => [r.fullName, r]))
  const repos: SearchRepo[] = merged
    .map(item => repoToSearchRepo(item, rankMap.get(item.full_name)))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 24)

  emit?.({
    type: 'step',
    id: 'render',
    status: 'completed',
    title: 'Results ready',
    detail: `Rendering ${repos.length} ranked repositories.`,
    elapsedMs: elapsedSince(startedAt),
    meta: { resultCount: repos.length },
  })

  return repos
}

function streamSearchPipeline({
  query,
  token,
  modelConfig,
}: {
  query: string
  token: string | null
  modelConfig: AIModelConfig
}) {
  const encoder = new TextEncoder()
  const startedAt = Date.now()

  const stream = new ReadableStream({
    async start(controller) {
      const emit: EmitSearchPipelineEvent = (event) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }

      try {
        const repos = await runSearchPipeline({ query, token, modelConfig, startedAt, emit })
        emit({ type: 'result', repos, elapsedMs: elapsedSince(startedAt) })
        after(async () => { await langfuseSpanProcessor?.forceFlush() })
        controller.close()
      } catch (err) {
        Sentry.captureException(err)
        console.error('Search error:', err)
        emit({
          type: 'error',
          error: err instanceof Error ? err.message : 'Search failed',
          elapsedMs: elapsedSince(startedAt),
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}

export async function POST(request: Request) {
  try {
    const startedAt = Date.now()
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
    const wantsPipelineStream = request.headers.get('accept')?.includes('application/x-ndjson')
      || request.headers.get('x-search-pipeline') === 'stream'

    if (wantsPipelineStream) {
      return streamSearchPipeline({ query, token, modelConfig })
    }

    const repos = await runSearchPipeline({ query, token, modelConfig, startedAt })

    after(async () => { await langfuseSpanProcessor?.forceFlush() })
    return NextResponse.json({ repos })
  } catch (err) {
    Sentry.captureException(err)
    console.error('Search error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
