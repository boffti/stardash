import { NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { db, fromJson, nowIso } from "@/lib/db"
import { fetchAllStarredRepos } from "@/lib/github"
import { getValidGitHubToken } from "@/lib/tokens"
import { upsertStarredRepos } from "@/lib/user-metadata"
import type { StarredRepo } from "@/lib/types"

export const maxDuration = 60

const SYNC_COOLDOWN_MS = 60 * 1000
const REPO_CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface StoredRow {
  github_repo_id: number
  owner: string
  name: string
  full_name: string
  description: string | null
  language: string | null
  language_color: string | null
  topics: string
  homepage: string | null
  license: string | null
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  pushed_at: string | null
  avatar_url: string | null
  archived: number
  readme: string | null
  updated_at: string
  starred_at: string | null
  status: StarredRepo["status"]
  is_pinned: number
  notes: string | null
}

function fetchStoredStarredRepos(userId: string): StarredRepo[] {
  const rows = db
    .prepare(
      `select r.github_repo_id, r.owner, r.name, r.full_name, r.description, r.language, r.language_color, r.topics,
              r.homepage, r.license, r.stargazers_count, r.forks_count, r.open_issues_count, r.pushed_at, r.avatar_url,
              r.archived, r.readme, r.updated_at, usr.starred_at, usr.status, usr.is_pinned, usr.notes
       from user_starred_repos usr join repos r on r.id = usr.repo_id
       where usr.user_id = ? order by usr.starred_at desc`,
    )
    .all(userId) as unknown as StoredRow[]

  return rows.map((r) => ({
    id: String(r.github_repo_id),
    owner: r.owner,
    name: r.name,
    fullName: r.full_name,
    description: r.description ?? "",
    language: r.language,
    languageColor: r.language_color,
    topics: fromJson<string[]>(r.topics, []),
    homepage: r.homepage,
    license: r.license,
    stargazersCount: r.stargazers_count,
    forksCount: r.forks_count,
    openIssuesCount: r.open_issues_count,
    pushedAt: r.pushed_at ?? r.updated_at,
    starredAt: r.starred_at ?? r.updated_at,
    avatarUrl: r.avatar_url ?? "",
    status: r.status ?? null,
    isPinned: r.is_pinned === 1,
    notes: r.notes,
    tags: [],
    collections: [],
    readme: r.readme,
    archived: r.archived === 1,
  }))
}

function storedReposResponse(
  userId: string,
  lastSynced: string | null,
  options: { error?: string; allowEmpty?: boolean } = {},
) {
  const repos = fetchStoredStarredRepos(userId)
  if (repos.length === 0 && !options.allowEmpty) return null
  return NextResponse.json({
    repos,
    lastSynced: lastSynced ?? nowIso(),
    fromCache: true,
    ...(options.error ? { error: options.error } : {}),
  })
}

const isFresh = (lastSynced: string | null) =>
  Boolean(lastSynced) && Date.now() - new Date(lastSynced!).getTime() < REPO_CACHE_TTL_MS

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cacheMode = searchParams.get("cache") === "refresh" ? "refresh" : "prefer"
  const syncLog = {
    triggerKind: searchParams.get("triggerKind") ?? "unknown",
    triggerSource: searchParams.get("triggerSource") ?? "unknown",
    cacheMode,
  }
  let userId: string | null = null
  let lastSyncedAt: string | null = null

  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    userId = user.id

    const profile = db
      .prepare("select last_github_sync_at, total_starred_count from profiles where id = ?")
      .get(user.id) as
      { last_github_sync_at: string | null; total_starred_count: number } | undefined
    lastSyncedAt = profile?.last_github_sync_at ?? null

    if (cacheMode === "prefer" && isFresh(lastSyncedAt)) {
      const cached = storedReposResponse(user.id, lastSyncedAt, {
        allowEmpty: profile?.total_starred_count === 0,
      })
      if (cached) return cached
    }

    if (lastSyncedAt) {
      const since = Date.now() - new Date(lastSyncedAt).getTime()
      if (since < SYNC_COOLDOWN_MS) {
        const cached = storedReposResponse(user.id, lastSyncedAt)
        if (cached) return cached
        const retryAfter = Math.ceil((SYNC_COOLDOWN_MS - since) / 1000)
        return NextResponse.json(
          {
            error: "Sync cooldown active. Please wait before syncing again.",
            retryAfterSeconds: retryAfter,
          },
          { status: 429, headers: { "Retry-After": String(retryAfter) } },
        )
      }
    }

    const { token } = await getValidGitHubToken(user.id)
    if (!token) {
      const cached = storedReposResponse(user.id, lastSyncedAt, {
        error: "GitHub token not available. Please sign in again.",
      })
      if (cached) return cached
      return NextResponse.json(
        { error: "GitHub token not available. Please sign in again.", code: "GITHUB_AUTH_ERROR" },
        { status: 401 },
      )
    }

    const startedAt = Date.now()
    console.info("[github-star-sync:start]", { ...syncLog, userId: user.id })

    const repos = await fetchAllStarredRepos(token)
    upsertStarredRepos(repos, user.id)
    const syncedAt = nowIso()
    db.prepare(
      "update profiles set last_github_sync_at = ?, total_starred_count = ? where id = ?",
    ).run(syncedAt, repos.length, user.id)

    console.info("[github-star-sync:success]", {
      ...syncLog,
      userId: user.id,
      repoCount: repos.length,
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json({ repos, lastSynced: syncedAt })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[github-star-sync:error]", { ...syncLog, error: message })
    const authError = message.includes("401")
    if (userId) {
      try {
        const cached = storedReposResponse(userId, lastSyncedAt, {
          error: authError ? "GitHub token rejected" : undefined,
        })
        if (cached) return cached
      } catch (fallbackError) {
        console.error("[github-star-sync:fallback-error]", {
          error: fallbackError instanceof Error ? fallbackError.message : "Unknown error",
        })
      }
    }
    if (authError) {
      return NextResponse.json(
        { error: "GitHub token rejected", code: "GITHUB_AUTH_ERROR" },
        { status: 401 },
      )
    }
    return NextResponse.json({ error: "Failed to fetch starred repos" }, { status: 500 })
  }
}
