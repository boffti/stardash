// Radar ingest: pulls candidate repos from GitHub search, Hacker News and the
// social graph (stars by people each user follows), then upserts them.
// Shared by the nightly cron (all users, GITHUB_PAT) and "Scan now" (one user, own token).

import type { SupabaseClient } from "@supabase/supabase-js"
import type { RadarHnSource } from "./radar"

const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
}

interface GhRepo {
  id: number
  name: string
  full_name: string
  owner: { login: string; avatar_url: string }
  description: string | null
  language: string | null
  topics?: string[]
  stargazers_count: number
  forks_count: number
  pushed_at: string
  created_at: string
  html_url: string
}

interface GhEvent {
  type: string
  actor: { login: string }
  repo: { id: number; name: string }
  created_at: string
}

export interface IngestUser {
  id: string
  login: string
}

export interface IngestStats {
  search: number
  hn: number
  social: number
  signals: number
  candidates: number
  errors: string[]
}

// ponytail: sequential fetches with hard caps. Batch via GraphQL if a run ever nears the 5k/hr core limit.
const SEARCH_PAGES_NEW = 3
const SEARCH_PAGES_RISING = 2
const MAX_HN_STORIES = 40
const MAX_SOCIAL_REPO_FETCHES = 200
const HN_MIN_POINTS = 30

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
}

async function gh<T>(url: string, token: string): Promise<T | null> {
  const res = await fetch(url, { headers: { ...GH_HEADERS, Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  return (await res.json()) as T
}

async function searchRepos(q: string, pages: number, token: string): Promise<GhRepo[]> {
  const out: GhRepo[] = []
  for (let page = 1; page <= pages; page++) {
    const params = new URLSearchParams({
      q,
      sort: "stars",
      order: "desc",
      per_page: "100",
      page: String(page),
    })
    const data = await gh<{ items: GhRepo[] }>(
      `https://api.github.com/search/repositories?${params}`,
      token,
    )
    if (!data?.items?.length) break
    out.push(...data.items)
  }
  return out
}

async function fetchRepo(fullName: string, token: string): Promise<GhRepo | null> {
  return gh<GhRepo>(`https://api.github.com/repos/${fullName}`, token)
}

export function parseGitHubRepoUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const m = url.match(
    /^https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#]|$)/i,
  )
  if (!m) return null
  const [, owner, name] = m
  if (["topics", "orgs", "sponsors", "features", "about", "marketplace"].includes(owner))
    return null
  return `${owner}/${name}`
}

export async function fetchHnGitHubStories(): Promise<Map<string, RadarHnSource>> {
  const since = Math.floor(Date.now() / 1000) - 2 * 86_400
  const params = new URLSearchParams({
    query: "github.com",
    tags: "story",
    hitsPerPage: "100",
    numericFilters: `points>${HN_MIN_POINTS},created_at_i>${since}`,
  })
  const res = await fetch(`https://hn.algolia.com/api/v1/search_by_date?${params}`)
  if (!res.ok) return new Map()
  const data = (await res.json()) as {
    hits: { title: string; url: string | null; points: number; objectID: string }[]
  }
  const byRepo = new Map<string, RadarHnSource>()
  for (const hit of data.hits) {
    const fullName = parseGitHubRepoUrl(hit.url)
    if (!fullName) continue
    const existing = byRepo.get(fullName.toLowerCase())
    if (existing && existing.points >= hit.points) continue
    byRepo.set(fullName.toLowerCase(), {
      points: hit.points,
      title: hit.title,
      url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
    })
  }
  return byRepo
}

function toCandidateRow(repo: GhRepo, sources: Record<string, unknown>) {
  const now = new Date().toISOString()
  return {
    github_repo_id: repo.id,
    owner: repo.owner.login,
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    language: repo.language,
    topics: repo.topics ?? [],
    stargazers_count: repo.stargazers_count,
    forks_count: repo.forks_count,
    pushed_at: repo.pushed_at,
    gh_created_at: repo.created_at,
    avatar_url: repo.owner.avatar_url,
    html_url: repo.html_url,
    sources,
    last_seen_at: now,
  }
}

export async function ingestRadar({
  admin,
  token,
  users,
}: {
  admin: SupabaseClient
  token: string
  users: IngestUser[]
}): Promise<IngestStats> {
  const stats: IngestStats = { search: 0, hn: 0, social: 0, signals: 0, candidates: 0, errors: [] }
  const rows = new Map<number, ReturnType<typeof toCandidateRow>>()

  const addRepo = (repo: GhRepo, sources: Record<string, unknown>) => {
    const existing = rows.get(repo.id)
    rows.set(repo.id, toCandidateRow(repo, { ...(existing?.sources ?? {}), ...sources }))
  }

  // 1. GitHub search: brand-new repos with traction, plus rising repos from the last month.
  try {
    const fresh = await searchRepos(
      `created:>${daysAgo(7)} stars:>50 is:public`,
      SEARCH_PAGES_NEW,
      token,
    )
    const rising = await searchRepos(
      `created:>${daysAgo(30)} stars:>300 is:public`,
      SEARCH_PAGES_RISING,
      token,
    )
    for (const repo of [...fresh, ...rising]) addRepo(repo, { new: true })
    stats.search = fresh.length + rising.length
  } catch (err) {
    stats.errors.push(`search: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 2. Hacker News stories linking to GitHub repos.
  try {
    const hnByRepo = await fetchHnGitHubStories()
    let fetched = 0
    for (const [fullName, hn] of hnByRepo) {
      if (fetched >= MAX_HN_STORIES) break
      const known = [...rows.values()].find((r) => r.full_name.toLowerCase() === fullName)
      if (known) {
        rows.set(known.github_repo_id, { ...known, sources: { ...known.sources, hn } })
        stats.hn++
        continue
      }
      fetched++
      const repo = await fetchRepo(fullName, token)
      if (repo) {
        addRepo(repo, { hn })
        stats.hn++
      }
    }
  } catch (err) {
    stats.errors.push(`hn: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 3. Social graph: WatchEvents in each user's received_events = stars by people they follow.
  const signalRows: {
    user_id: string
    github_repo_id: number
    actor_login: string
    seen_at: string
  }[] = []
  const socialRepoNames = new Map<number, string>()
  for (const user of users) {
    try {
      const events = await gh<GhEvent[]>(
        `https://api.github.com/users/${encodeURIComponent(user.login)}/received_events?per_page=100`,
        token,
      )
      for (const ev of events ?? []) {
        if (ev.type !== "WatchEvent") continue
        signalRows.push({
          user_id: user.id,
          github_repo_id: ev.repo.id,
          actor_login: ev.actor.login,
          seen_at: ev.created_at,
        })
        socialRepoNames.set(ev.repo.id, ev.repo.name)
      }
    } catch (err) {
      stats.errors.push(
        `social(${user.login}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
  stats.signals = signalRows.length

  if (socialRepoNames.size > 0) {
    const ids = [...socialRepoNames.keys()]
    const { data: existing } = await admin
      .from("radar_candidates")
      .select("github_repo_id")
      .in("github_repo_id", ids)
    const known = new Set((existing ?? []).map((r) => Number(r.github_repo_id)))
    let fetched = 0
    for (const [id, fullName] of socialRepoNames) {
      if (rows.has(id)) continue
      if (known.has(id)) {
        // Refresh last_seen so it stays in the 14-day window.
        await admin
          .from("radar_candidates")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("github_repo_id", id)
        continue
      }
      if (fetched >= MAX_SOCIAL_REPO_FETCHES) break
      fetched++
      const repo = await fetchRepo(fullName, token)
      if (repo) {
        addRepo(repo, {})
        stats.social++
      }
    }
  }

  // 4. Persist candidates, signals, and today's star snapshot (feeds velocity scoring).
  const candidateRows = [...rows.values()]
  stats.candidates = candidateRows.length
  for (let i = 0; i < candidateRows.length; i += 200) {
    const batch = candidateRows.slice(i, i + 200)
    const { error } = await admin
      .from("radar_candidates")
      .upsert(batch, { onConflict: "github_repo_id" })
    if (error) stats.errors.push(`upsert candidates: ${error.message}`)

    const today = new Date().toISOString().slice(0, 10)
    const { error: snapError } = await admin.from("repo_star_snapshots").upsert(
      batch.map((r) => ({
        repo_github_id: r.github_repo_id,
        owner: r.owner,
        name: r.name,
        star_count: r.stargazers_count,
        snapshot_date: today,
      })),
      { onConflict: "repo_github_id,snapshot_date" },
    )
    if (snapError) stats.errors.push(`upsert snapshots: ${snapError.message}`)
  }

  for (let i = 0; i < signalRows.length; i += 500) {
    const { error } = await admin.from("radar_signals").upsert(signalRows.slice(i, i + 500), {
      onConflict: "user_id,github_repo_id,actor_login",
      ignoreDuplicates: true,
    })
    if (error) stats.errors.push(`upsert signals: ${error.message}`)
  }

  return stats
}
