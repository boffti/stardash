import { createClient } from '@/lib/supabase/server'
import { fetchAllStarredRepos } from '@/lib/github'
import { getValidGitHubToken } from '@/lib/tokens'
import { upsertStarredRepos } from '@/lib/user-metadata'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StarredRepo } from '@/lib/types'

export const maxDuration = 60

const SYNC_COOLDOWN_MS = 60 * 1000 // 60 seconds
const REPO_CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface StoredRepoRecord {
  github_repo_id: number
  owner: string
  name: string
  full_name: string
  description: string | null
  language: string | null
  language_color: string | null
  topics: string[] | null
  homepage: string | null
  license: string | null
  stargazers_count: number | null
  forks_count: number | null
  open_issues_count: number | null
  pushed_at: string | null
  avatar_url: string | null
  archived: boolean | null
  readme: string | null
  updated_at: string
}

interface StoredStarredRepoRow {
  starred_at: string | null
  status: StarredRepo['status']
  is_pinned: boolean | null
  notes: string | null
  repos: StoredRepoRecord | StoredRepoRecord[]
}

function firstRepo(row: StoredStarredRepoRow) {
  return Array.isArray(row.repos) ? row.repos[0] : row.repos
}

async function fetchStoredStarredRepos(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('user_starred_repos')
    .select(`
      starred_at,
      status,
      is_pinned,
      notes,
      repos!inner(
        github_repo_id,
        owner,
        name,
        full_name,
        description,
        language,
        language_color,
        topics,
        homepage,
        license,
        stargazers_count,
        forks_count,
        open_issues_count,
        pushed_at,
        avatar_url,
        archived,
        readme,
        updated_at
      )
    `)
    .eq('user_id', userId)
    .order('starred_at', { ascending: false })

  if (error) throw error

  const repos = ((data ?? []) as StoredStarredRepoRow[])
    .map((row): StarredRepo | null => {
      const repo = firstRepo(row)
      if (!repo) return null

      const fallbackTimestamp = repo.updated_at ?? new Date(0).toISOString()

      return {
        id: String(repo.github_repo_id),
        owner: repo.owner,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description ?? '',
        language: repo.language,
        languageColor: repo.language_color,
        topics: repo.topics ?? [],
        homepage: repo.homepage,
        license: repo.license,
        stargazersCount: repo.stargazers_count ?? 0,
        forksCount: repo.forks_count ?? 0,
        openIssuesCount: repo.open_issues_count ?? 0,
        pushedAt: repo.pushed_at ?? fallbackTimestamp,
        starredAt: row.starred_at ?? fallbackTimestamp,
        avatarUrl: repo.avatar_url ?? '',
        status: row.status ?? null,
        isPinned: row.is_pinned ?? false,
        notes: row.notes,
        tags: [],
        collections: [],
        readme: repo.readme,
        archived: repo.archived ?? false,
      }
    })
    .filter((repo): repo is StarredRepo => repo !== null)

  return repos
}

async function storedReposResponse(
  supabase: SupabaseClient,
  userId: string,
  lastSynced: string | null | undefined,
  options: { error?: string; allowEmpty?: boolean } = {},
) {
  const repos = await fetchStoredStarredRepos(supabase, userId)
  if (repos.length === 0 && !options.allowEmpty) return null

  return NextResponse.json({
    repos,
    lastSynced: lastSynced ?? new Date().toISOString(),
    fromCache: true,
    ...(options.error ? { error: options.error } : {}),
  })
}

function isFreshCache(lastSynced: string | null | undefined) {
  if (!lastSynced) return false
  return Date.now() - new Date(lastSynced).getTime() < REPO_CACHE_TTL_MS
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cacheMode = searchParams.get('cache') === 'refresh' ? 'refresh' : 'prefer'
  const syncLog = {
    triggerKind: searchParams.get('triggerKind') ?? 'unknown',
    triggerSource: searchParams.get('triggerSource') ?? 'unknown',
    triggerContext: searchParams.get('triggerContext') ?? 'unknown',
    cacheMode,
  }
  let currentUserId: string | null = null
  let adminSupabase: SupabaseClient | null = null
  let lastGithubSyncAt: string | null = null

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    currentUserId = user.id

    adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('last_github_sync_at, total_starred_count')
      .eq('id', user.id)
      .maybeSingle()
    lastGithubSyncAt = profile?.last_github_sync_at ?? null

    if (cacheMode === 'prefer' && isFreshCache(lastGithubSyncAt)) {
      const cachedResponse = await storedReposResponse(adminSupabase, user.id, lastGithubSyncAt, {
        allowEmpty: profile?.total_starred_count === 0,
      })
      if (cachedResponse) return cachedResponse
    }

    if (profile?.last_github_sync_at) {
      const msSinceLastSync = Date.now() - new Date(profile.last_github_sync_at).getTime()
      if (msSinceLastSync < SYNC_COOLDOWN_MS) {
        const retryAfter = Math.ceil((SYNC_COOLDOWN_MS - msSinceLastSync) / 1000)
        const cachedResponse = await storedReposResponse(adminSupabase, user.id, profile.last_github_sync_at)
        if (cachedResponse) return cachedResponse

        return NextResponse.json(
          { error: 'Sync cooldown active. Please wait before syncing again.', retryAfterSeconds: retryAfter },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } },
        )
      }
    }

    const tokenResult = await getValidGitHubToken()
    if (tokenResult.error === 'expired') {
      const cachedResponse = await storedReposResponse(
        adminSupabase,
        user.id,
        profile?.last_github_sync_at,
        { error: 'GitHub token expired' },
      )
      if (cachedResponse) return cachedResponse

      return NextResponse.json(
        { error: 'GitHub token expired', code: 'GITHUB_AUTH_ERROR' },
        { status: 401 },
      )
    }

    if (tokenResult.error === 'not_found' || !tokenResult.token) {
      const cachedResponse = await storedReposResponse(
        adminSupabase,
        user.id,
        profile?.last_github_sync_at,
        { error: 'GitHub token not available. Please re-authenticate.' },
      )
      if (cachedResponse) return cachedResponse

      return NextResponse.json(
        { error: 'GitHub token not available. Please re-authenticate.' },
        { status: 401 },
      )
    }

    const startedAt = Date.now()
    const scopedSyncLog = {
      ...syncLog,
      userId: user.id,
    }

    console.info('[github-star-sync:start]', scopedSyncLog)

    const repos = await fetchAllStarredRepos(tokenResult.token)
    await upsertStarredRepos(adminSupabase, repos, user.id)

    await adminSupabase
      .from('profiles')
      .update({
        last_github_sync_at: new Date().toISOString(),
        total_starred_count: repos.length,
      })
      .eq('id', user.id)

    console.info('[github-star-sync:success]', {
      ...scopedSyncLog,
      repoCount: repos.length,
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({ repos, lastSynced: new Date().toISOString() })
  } catch (error) {
    console.error('[github-star-sync:error]', {
      ...syncLog,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    if (currentUserId && adminSupabase) {
      try {
        const cachedResponse = await storedReposResponse(
          adminSupabase,
          currentUserId,
          lastGithubSyncAt,
          {
            error: error instanceof Error && error.message.includes('401')
              ? 'GitHub token expired'
              : undefined,
          },
        )
        if (cachedResponse) return cachedResponse
      } catch (fallbackError) {
        console.error('[github-star-sync:fallback-error]', {
          ...syncLog,
          error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
        })
      }
    }

    if (error instanceof Error && error.message.includes('401')) {
      return NextResponse.json(
        { error: 'GitHub token expired', code: 'GITHUB_AUTH_ERROR' },
        { status: 401 },
      )
    }
    return NextResponse.json({ error: 'Failed to fetch starred repos' }, { status: 500 })
  }
}
