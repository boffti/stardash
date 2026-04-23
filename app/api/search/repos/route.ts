import { NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { after } from 'next/server'
import { getValidGitHubToken } from '@/lib/tokens'
import { getAIModel, getProviderOptions, type AIModelConfig } from '@/lib/ai-provider'
import { langfuseSpanProcessor } from '@/instrumentation'
import { createClient } from '@/lib/supabase/server'
import {
  DISCOVER_SEARCH_CACHE_TTL_DAYS,
  DISCOVER_SEARCH_CACHE_VERSION,
  normalizeDiscoverSearchQuery,
} from '@/lib/search-cache'
import { checkAndIncrementWeeklyLimit } from '@/lib/ai-weekly-limit'
import type { SupabaseClient, User } from '@supabase/supabase-js'

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
  searchId?: string
  cached?: boolean
  cachedAt?: string
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

interface DiscoverSearchRow {
  id: string
  query: string
  normalized_query: string
  results: SearchRepo[]
  pipeline_events: SearchPipelineEvent[]
  result_count: number
  cached_at: string
  last_run_at: string
  last_opened_at: string | null
  expires_at: string
  is_saved: boolean
}

function elapsedSince(startedAt: number) {
  return Date.now() - startedAt
}

function discoverSearchExpiresAt() {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + DISCOVER_SEARCH_CACHE_TTL_DAYS)
  return expiresAt.toISOString()
}

function getModelId(modelConfig: AIModelConfig) {
  const model = modelConfig.model as { modelId?: string }
  return model.modelId ?? null
}

async function getCachedDiscoverSearch({
  supabase,
  userId,
  normalizedQuery,
}: {
  supabase: SupabaseClient
  userId: string
  normalizedQuery: string
}): Promise<DiscoverSearchRow | null> {
  try {
    const { data, error } = await supabase
      .from('discover_searches')
      .select('id, query, normalized_query, results, pipeline_events, result_count, cached_at, last_run_at, last_opened_at, expires_at, is_saved')
      .eq('user_id', userId)
      .eq('normalized_query', normalizedQuery)
      .eq('search_version', DISCOVER_SEARCH_CACHE_VERSION)
      .maybeSingle()

    if (error || !data) return null

    const row = data as DiscoverSearchRow
    const isFresh = new Date(row.expires_at).getTime() > Date.now()
    if (!row.is_saved && !isFresh) return null
    if (!Array.isArray(row.results)) return null

    await supabase
      .from('discover_searches')
      .update({ last_opened_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('user_id', userId)

    return row
  } catch (err) {
    console.warn('[search-cache] cache lookup skipped:', err)
    return null
  }
}

async function saveDiscoverSearch({
  supabase,
  userId,
  query,
  normalizedQuery,
  repos,
  pipelineEvents,
  modelConfig,
}: {
  supabase: SupabaseClient
  userId: string
  query: string
  normalizedQuery: string
  repos: SearchRepo[]
  pipelineEvents: SearchPipelineEvent[]
  modelConfig: AIModelConfig
}): Promise<string | null> {
  try {
    const { data: existing } = await supabase
      .from('discover_searches')
      .select('id, is_saved')
      .eq('user_id', userId)
      .eq('normalized_query', normalizedQuery)
      .eq('search_version', DISCOVER_SEARCH_CACHE_VERSION)
      .maybeSingle()

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('discover_searches')
      .upsert({
        user_id: userId,
        query,
        normalized_query: normalizedQuery,
        results: repos,
        pipeline_events: pipelineEvents,
        result_count: repos.length,
        model_provider: modelConfig.provider,
        model_id: getModelId(modelConfig),
        search_version: DISCOVER_SEARCH_CACHE_VERSION,
        cached_at: now,
        last_run_at: now,
        expires_at: discoverSearchExpiresAt(),
        is_saved: Boolean(existing?.is_saved),
      }, { onConflict: 'user_id,normalized_query,search_version' })
      .select('id')
      .single()

    if (error) return existing?.id ?? null
    return data?.id ?? existing?.id ?? null
  } catch (err) {
    console.warn('[search-cache] cache save skipped:', err)
    return null
  }
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
  normalizedQuery,
  user,
  supabase,
  token,
  modelConfig,
}: {
  query: string
  normalizedQuery: string
  user: User
  supabase: SupabaseClient
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
        const cached = await getCachedDiscoverSearch({ supabase, userId: user.id, normalizedQuery })
        if (cached) {
          emit({
            type: 'step',
            id: 'render',
            status: 'completed',
            title: cached.is_saved ? 'Loaded saved search' : 'Loaded cached search',
            detail: `Reused ${cached.result_count} cached repositories from Discover history.`,
            elapsedMs: elapsedSince(startedAt),
            meta: { cached: true, resultCount: cached.result_count },
          })
          emit({
            type: 'result',
            repos: cached.results,
            elapsedMs: elapsedSince(startedAt),
            searchId: cached.id,
            cached: true,
            cachedAt: cached.cached_at,
          })
          controller.close()
          return
        }

        // Enforce weekly/daily limit only when using system key (no cache hit above)
        if (!modelConfig.isUserKey) {
          const limitResult = await checkAndIncrementWeeklyLimit(user.id, 'search')
          if (!limitResult.allowed) {
            const msg = limitResult.limitType === 'daily'
              ? 'Daily AI search limit reached. Try again tomorrow.'
              : 'Weekly AI search limit reached. Try again next week.'
            emit({ type: 'error', error: msg, elapsedMs: elapsedSince(startedAt) })
            controller.close()
            return
          }
        }

        const pipelineEvents: SearchPipelineEvent[] = []
        const emitAndCollect: EmitSearchPipelineEvent = (event) => {
          pipelineEvents.push(event)
          emit(event)
        }
        const repos = await runSearchPipeline({ query, token, modelConfig, startedAt, emit: emitAndCollect })
        const searchId = await saveDiscoverSearch({
          supabase,
          userId: user.id,
          query,
          normalizedQuery,
          repos,
          pipelineEvents,
          modelConfig,
        })
        emit({ type: 'result', repos, elapsedMs: elapsedSince(startedAt), searchId: searchId ?? undefined, cached: false })
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
    const normalizedQuery = typeof query === 'string' ? normalizeDiscoverSearchQuery(query) : ''
    if (!normalizedQuery) {
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
      return streamSearchPipeline({ query: query.trim(), normalizedQuery, user, supabase, token, modelConfig })
    }

    const cached = await getCachedDiscoverSearch({ supabase, userId: user.id, normalizedQuery })
    if (cached) {
      return NextResponse.json({
        repos: cached.results,
        searchId: cached.id,
        cached: true,
        cachedAt: cached.cached_at,
      })
    }

    // Enforce weekly/daily limit only when using system key (cache hits are always free)
    if (!modelConfig.isUserKey) {
      const limitResult = await checkAndIncrementWeeklyLimit(user.id, 'search')
      if (!limitResult.allowed) {
        const msg = limitResult.limitType === 'daily'
          ? 'Daily AI search limit reached. Try again tomorrow.'
          : 'Weekly AI search limit reached. Try again next week.'
        return NextResponse.json(
          { error: msg, remaining: 0, nextAllowedAt: limitResult.nextAllowedAt },
          { status: 429 },
        )
      }
    }

    const pipelineEvents: SearchPipelineEvent[] = []
    const repos = await runSearchPipeline({
      query: query.trim(),
      token,
      modelConfig,
      startedAt,
      emit: (event) => pipelineEvents.push(event),
    })
    const searchId = await saveDiscoverSearch({
      supabase,
      userId: user.id,
      query: query.trim(),
      normalizedQuery,
      repos,
      pipelineEvents,
      modelConfig,
    })

    after(async () => { await langfuseSpanProcessor?.forceFlush() })
    return NextResponse.json({ repos, searchId, cached: false })
  } catch (err) {
    Sentry.captureException(err)
    console.error('Search error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
