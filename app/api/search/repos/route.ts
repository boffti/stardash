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
  buildUserContextSummary,
  buildStarContextHash,
} from '@/lib/search-cache'
import type { StarredRepo } from '@/lib/types'
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
  queries: z.array(z.string()).min(1).describe(
    'GitHub search query strings using GitHub search syntax. Use operators like stars:>, language:, topic:, in:name,description'
  ),
})

// Pass 1: fast coarse scoring — no evidence required, just scores
const CoarseRankingSchema = z.object({
  scores: z.array(z.object({
    fullName: z.string().describe('Exact full_name of the repo (owner/repo)'),
    relevanceScore: z.number().min(0).max(10).describe('How well this repo matches the original intent (0-10)'),
  })),
})

// Pass 2: deep scoring for shortlisted candidates — includes evidence bullets
const ReRankingSchema = z.object({
  rankedRepos: z.array(z.object({
    fullName: z.string().describe('Exact full_name of the repo (owner/repo)'),
    relevanceScore: z.number().min(0).max(10).describe('How well this repo matches the original intent (0-10)'),
    evidence: z.array(z.string()).describe(
      'Exactly 3 short evidence bullets explaining why this matches. Each bullet max 60 chars. Examples: "847 commits in 90 days", "Has docs site + wiki", "Matches: prod-ready CLI"'
    ),
  })),
})

async function searchGitHub(
  query: string,
  token: string | null,
  sort: 'stars' | 'updated' = 'stars',
): Promise<GitHubSearchItem[]> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&order=desc&per_page=20`
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, { headers })
  if (!res.ok) return []
  const data = await res.json()
  return data.items ?? []
}

type EmitSearchPipelineEvent = (event: SearchPipelineEvent) => void

interface DiscoverSearchRow {
  id: string
  query: string
  normalized_query: string
  context_hash: string | null
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
  contextHash,
}: {
  supabase: SupabaseClient
  userId: string
  normalizedQuery: string
  contextHash: string | null
}): Promise<DiscoverSearchRow | null> {
  try {
    const { data, error } = await supabase
      .from('discover_searches')
      .select('id, query, normalized_query, context_hash, results, pipeline_events, result_count, cached_at, last_run_at, last_opened_at, expires_at, is_saved')
      .eq('user_id', userId)
      .eq('normalized_query', normalizedQuery)
      .eq('search_version', DISCOVER_SEARCH_CACHE_VERSION)
      .maybeSingle()

    if (error || !data) return null

    const row = data as DiscoverSearchRow

    // Saved searches are always returned (user explicitly pinned them).
    // For non-saved rows: check TTL freshness AND context hash match.
    // A mismatched context_hash means the user's interest profile changed —
    // treat as stale and re-run so they get personalised-to-now results.
    // We only invalidate when BOTH sides have a hash — legacy rows with
    // context_hash = null are kept until TTL so they don't all bust at once.
    if (!row.is_saved) {
      const isFresh = new Date(row.expires_at).getTime() > Date.now()
      if (!isFresh) return null
      if (contextHash !== null && row.context_hash !== null && row.context_hash !== contextHash) return null
    }
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

// Max unsaved search rows per user. Saved (pinned) searches are exempt.
const MAX_CACHED_SEARCHES_PER_USER = 50

async function saveDiscoverSearch({
  supabase,
  userId,
  query,
  normalizedQuery,
  contextHash,
  repos,
  pipelineEvents,
  modelConfig,
}: {
  supabase: SupabaseClient
  userId: string
  query: string
  normalizedQuery: string
  contextHash: string | null
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

    // If this is a brand-new query, check the per-user row cap before inserting.
    // Existing rows (same normalized query) are always updated regardless of count.
    if (!existing) {
      const { count } = await supabase
        .from('discover_searches')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('search_version', DISCOVER_SEARCH_CACHE_VERSION)

      if ((count ?? 0) >= MAX_CACHED_SEARCHES_PER_USER) {
        // Cap reached — skip persisting this new search to prevent unbounded growth.
        console.info(`[search-cache] skipping save for user ${userId}: row cap (${MAX_CACHED_SEARCHES_PER_USER}) reached`)
        return null
      }
    }

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('discover_searches')
      .upsert({
        user_id: userId,
        query,
        normalized_query: normalizedQuery,
        context_hash: contextHash,
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
  userContext,
  token,
  modelConfig,
  startedAt,
  emit,
}: {
  query: string
  userContext: string
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

  const userContextSection = userContext
    ? `\nUser context (their existing interests — generate queries for things they haven't explored yet):\n${userContext}\n`
    : ''

  const { object: expansion } = await generateObject({
    model: modelConfig.model,
    schema: QueryExpansionSchema,
    prompt: `You are a GitHub search expert. Given a developer's search intent, generate 3-5 targeted GitHub search queries using GitHub search syntax.
${userContextSection}
Intent: "${query}"

Rules:
- Use GitHub operators: stars:>N, language:X, topic:X, in:name, in:description, is:public
- Vary the queries to cover different interpretations and adjacent angles
- Focus on finding high-quality, production-ready repos the user has NOT already explored
- Make at least one query favour recently-active repos (use pushed:>2024-01-01 or similar)
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
    meta: { queryCount: expansion.queries.length + 1 },
  })

  // Run all AI-generated queries (sort by stars) plus one extra "sort=updated"
  // variant on the first query to surface recently-active hidden gems.
  // The schema enforces min(1) so queries[0] is always defined, but we guard
  // defensively in case the model response is patched at runtime.
  const firstQuery = expansion.queries[0] ?? ''
  const allSearches: Array<{ query: string; sort: 'stars' | 'updated' }> = [
    ...expansion.queries.map(q => ({ query: q, sort: 'stars' as const })),
    ...(firstQuery ? [{ query: firstQuery, sort: 'updated' as const }] : []),
  ]

  const searchResults = await Promise.all(
    allSearches.map(({ query: q, sort }) => searchGitHub(q, token, sort))
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
    detail: 'Merging overlapping query results, tracking cross-query consensus.',
    elapsedMs: elapsedSince(startedAt),
  })

  // Weighted dedup: track how many queries each repo appeared in (queryHits)
  // and its best rank across those queries (bestRank). Both are passed to the
  // reranker so cross-query consensus boosts relevance signals.
  interface MergedCandidate {
    item: GitHubSearchItem
    queryHits: number
    bestRank: number
    readme: string | null
  }
  const seenMap = new Map<string, MergedCandidate>()

  for (const items of searchResults) {
    for (const [rank, item] of items.entries()) {
      const existing = seenMap.get(item.full_name)
      if (existing) {
        existing.queryHits++
        existing.bestRank = Math.min(existing.bestRank, rank)
      } else {
        // Attach readme excerpt if item has it (GitHub search API doesn't return
        // readme — leave null here; will be enriched in deep-rank pass if available)
        seenMap.set(item.full_name, { item, queryHits: 1, bestRank: rank, readme: null })
      }
    }
  }

  const merged = Array.from(seenMap.values())

  // Sort by consensus signal for the coarse pass prompt: multi-hit repos first,
  // then by best rank within same hit count
  merged.sort((a, b) =>
    b.queryHits !== a.queryHits ? b.queryHits - a.queryHits : a.bestRank - b.bestRank
  )

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
    title: 'AI reranking (pass 1 of 2)',
    detail: `Coarse-scoring ${merged.length} candidates to shortlist the top 30.`,
    elapsedMs: elapsedSince(startedAt),
    meta: { uniqueCount: merged.length },
  })

  // ---- PASS 1: coarse score all candidates (no evidence, fast) ----
  const coarseSummaries = merged.map(({ item: r, queryHits, bestRank }) => ({
    fullName: r.full_name,
    description: r.description ?? '',
    language: r.language ?? '',
    topics: r.topics.slice(0, 5).join(', '),
    stars: r.stargazers_count,
    pushedAt: r.pushed_at,
    // Explicit consensus signals for the model
    appearedInQueries: queryHits,
    bestPositionAcrossQueries: bestRank + 1, // 1-indexed for readability
  }))

  const { object: coarseRanking } = await generateObject({
    model: modelConfig.model,
    schema: CoarseRankingSchema,
    prompt: `You are ranking GitHub repos for a developer's search intent.

Original intent: "${query}"

Additional signals per repo:
- "appearedInQueries": how many different search queries returned this repo (higher = stronger consensus match)
- "bestPositionAcrossQueries": the best rank position across all queries (lower = stronger match)

Repos to score (${merged.length} total):
${JSON.stringify(coarseSummaries, null, 2)}

Score each repo 0-10 based on relevance to the intent. Boost repos with high appearedInQueries.
Include ALL repos.`,
    experimental_telemetry: { isEnabled: true, functionId: 'search-coarse-ranking' },
    providerOptions: getProviderOptions(modelConfig.provider),
  })

  // Shortlist top 30 from coarse pass
  const coarseScoreMap = new Map(coarseRanking.scores.map(s => [s.fullName, s.relevanceScore]))
  const shortlisted = merged
    .map(candidate => ({ ...candidate, coarseScore: coarseScoreMap.get(candidate.item.full_name) ?? 0 }))
    .sort((a, b) => b.coarseScore - a.coarseScore)
    .slice(0, 30)

  emit?.({
    type: 'step',
    id: 'rerank',
    status: 'running',
    title: 'AI reranking (pass 2 of 2)',
    detail: `Deep-scoring top ${shortlisted.length} candidates with full context and writing evidence notes.`,
    elapsedMs: elapsedSince(startedAt),
    meta: { shortlistedCount: shortlisted.length },
  })

  // ---- PASS 2: deep score shortlisted 30 with enriched metadata + evidence ----
  const deepSummaries = shortlisted.map(({ item: r, queryHits, bestRank }) => ({
    fullName: r.full_name,
    description: r.description ?? '',
    language: r.language ?? '',
    topics: r.topics.slice(0, 8).join(', '),
    stars: r.stargazers_count,
    forks: r.forks_count,
    pushedAt: r.pushed_at,
    appearedInQueries: queryHits,
    bestPositionAcrossQueries: bestRank + 1,
  }))

  const { object: ranking } = await generateObject({
    model: modelConfig.model,
    schema: ReRankingSchema,
    prompt: `You are deeply ranking a shortlisted set of GitHub repos for a developer's search intent.

Original intent: "${query}"

These are the top candidates after a coarse scoring pass. Score them carefully.

Repos (${shortlisted.length} total):
${JSON.stringify(deepSummaries, null, 2)}

For each repo, provide:
1. relevanceScore (0-10): how well it matches the intent. Boost repos with high appearedInQueries.
2. evidence: exactly 3 short bullets explaining WHY it matches. Be specific and factual.
   Good: "12k stars · actively maintained", "Go CLI framework · prod-ready", "Matches: framework intent"
   Bad: "good repo", "relevant", "matches query"

Include ALL ${shortlisted.length} repos in your response. Sort by relevanceScore descending.`,
    experimental_telemetry: { isEnabled: true, functionId: 'search-deep-reranking' },
    providerOptions: getProviderOptions(modelConfig.provider),
  })

  emit?.({
    type: 'step',
    id: 'rerank',
    status: 'completed',
    title: 'Ranked repositories',
    detail: `AI returned deep relevance scores for ${ranking.rankedRepos.length} repositories.`,
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
  const repos: SearchRepo[] = shortlisted
    .map(({ item }) => repoToSearchRepo(item, rankMap.get(item.full_name)))
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
  userContext,
  contextHash,
  user,
  supabase,
  token,
  modelConfig,
}: {
  query: string
  normalizedQuery: string
  userContext: string
  contextHash: string | null
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
        const cached = await getCachedDiscoverSearch({ supabase, userId: user.id, normalizedQuery, contextHash })
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
        const repos = await runSearchPipeline({ query, userContext, token, modelConfig, startedAt, emit: emitAndCollect })
        const searchId = await saveDiscoverSearch({
          supabase,
          userId: user.id,
          query,
          normalizedQuery,
          contextHash,
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

    const body = await request.json()
    const { query, starData: rawStarData } = body as { query: unknown; starData?: StarredRepo[] }
    const normalizedQuery = typeof query === 'string' ? normalizeDiscoverSearchQuery(query) : ''
    if (!normalizedQuery) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 })
    }

    // Derive user context from the optional star data the client sends
    const starData: StarredRepo[] = Array.isArray(rawStarData) ? rawStarData : []
    const userContext = starData.length ? buildUserContextSummary(starData) : ''
    const contextHash = starData.length ? buildStarContextHash(starData) : null

    // GitHub's repository search endpoint can return public results without a
    // user token. Keep the Supabase user check above, but do not fail Discover
    // search just because the short-lived GitHub OAuth cookie has expired.
    const { token } = await getValidGitHubToken()

    const modelConfig = getAIModel(request)
    const wantsPipelineStream = request.headers.get('accept')?.includes('application/x-ndjson')
      || request.headers.get('x-search-pipeline') === 'stream'

    if (wantsPipelineStream) {
      return streamSearchPipeline({ query: (query as string).trim(), normalizedQuery, userContext, contextHash, user, supabase, token, modelConfig })
    }

    const cached = await getCachedDiscoverSearch({ supabase, userId: user.id, normalizedQuery, contextHash })
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
      query: (query as string).trim(),
      userContext,
      token,
      modelConfig,
      startedAt,
      emit: (event) => pipelineEvents.push(event),
    })
    const searchId = await saveDiscoverSearch({
      supabase,
      userId: user.id,
      query: (query as string).trim(),
      normalizedQuery,
      contextHash,
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
