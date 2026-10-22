import { db, fromJson, toJson } from "@/lib/db"
import {
  buildTasteProfile,
  scoreCandidate,
  type RadarHnSource,
  type RadarReason,
  type RepoStatus,
} from "@/lib/radar"

export interface RadarItem {
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
  ghCreatedAt: string | null
  firstSeenAt: string
  starsDelta7d: number | null
  followers: string[]
  hn: RadarHnSource | null
  score: number
  reasons: RadarReason[]
  // SearchRepo compatibility so the existing star popover works unchanged.
  evidence: string[]
  relevanceScore: number
}

export interface RadarResponse {
  items: RadarItem[]
  total: number
  scannedAt: string | null
  starCount: number
}

const WINDOW_DAYS = 14
const MAX_CANDIDATES = 600
const MAX_ITEMS = 80

interface CandidateRow {
  github_repo_id: number
  owner: string
  name: string
  full_name: string
  description: string | null
  language: string | null
  topics: string
  stargazers_count: number
  forks_count: number
  pushed_at: string | null
  gh_created_at: string | null
  avatar_url: string | null
  html_url: string
  sources: string
  first_seen_at: string
  last_seen_at: string
}

interface StarRow {
  status: RepoStatus
  starred_at: string | null
  github_repo_id: number
  topics: string
  language: string | null
}

/** Scores every recent candidate against the user's stars. Shared by the API route and the MCP tool. */
export function buildRadarFeed(userId: string): RadarResponse {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString()
  const weekAgo = new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10)

  const stars = db
    .prepare(
      `select usr.status, usr.starred_at, r.github_repo_id, r.topics, r.language
       from user_starred_repos usr join repos r on r.id = usr.repo_id
       where usr.user_id = ?`,
    )
    .all(userId) as unknown as StarRow[]
  const candidates = db
    .prepare(
      "select * from radar_candidates where last_seen_at >= ? order by last_seen_at desc limit ?",
    )
    .all(since, MAX_CANDIDATES) as unknown as CandidateRow[]
  const signals = db
    .prepare(
      "select github_repo_id, actor_login from radar_signals where user_id = ? and seen_at >= ?",
    )
    .all(userId, since) as unknown as { github_repo_id: number; actor_login: string }[]
  const actions = db
    .prepare("select github_repo_id, action, until from radar_actions where user_id = ?")
    .all(userId) as unknown as { github_repo_id: number; action: string; until: string | null }[]

  const starredIds = new Set(stars.map((s) => Number(s.github_repo_id)))
  const profile = buildTasteProfile(
    stars.map((s) => ({
      topics: fromJson<string[]>(s.topics, []),
      language: s.language,
      status: s.status,
      starredAt: s.starred_at,
    })),
  )

  const hidden = new Set<number>()
  for (const a of actions) {
    if (a.action === "snoozed" && a.until && Date.parse(a.until) < Date.now()) continue
    hidden.add(Number(a.github_repo_id))
  }

  const followersByRepo = new Map<number, string[]>()
  for (const s of signals) {
    const id = Number(s.github_repo_id)
    followersByRepo.set(id, [...(followersByRepo.get(id) ?? []), s.actor_login])
  }

  const visible = candidates.filter(
    (c) => !starredIds.has(Number(c.github_repo_id)) && !hidden.has(Number(c.github_repo_id)),
  )

  // Socially-signalled repos may be older than the window; pull them in too.
  const missingSocial = [...followersByRepo.keys()].filter(
    (id) =>
      !starredIds.has(id) &&
      !hidden.has(id) &&
      !visible.some((c) => Number(c.github_repo_id) === id),
  )
  if (missingSocial.length > 0) {
    const extra = db
      .prepare(
        "select * from radar_candidates where github_repo_id in (select value from json_each(?))",
      )
      .all(toJson(missingSocial.slice(0, 200))) as unknown as CandidateRow[]
    visible.push(...extra)
  }

  const ids = visible.map((c) => Number(c.github_repo_id))
  const starsWeekAgo = new Map<number, number>()
  if (ids.length > 0) {
    const snapshots = db
      .prepare(
        `select repo_github_id, star_count from repo_star_snapshots
         where repo_github_id in (select value from json_each(?)) and snapshot_date >= ?
         order by snapshot_date asc`,
      )
      .all(toJson(ids), weekAgo) as unknown as { repo_github_id: number; star_count: number }[]
    for (const s of snapshots) {
      const id = Number(s.repo_github_id)
      if (!starsWeekAgo.has(id)) starsWeekAgo.set(id, s.star_count)
    }
  }

  const items: RadarItem[] = visible
    .map((c) => {
      const id = Number(c.github_repo_id)
      const followers = followersByRepo.get(id) ?? []
      const topics = fromJson<string[]>(c.topics, [])
      const hn = fromJson<{ new?: boolean; hn?: RadarHnSource }>(c.sources, {}).hn ?? null
      const then = starsWeekAgo.get(id) ?? null
      const { score, reasons } = scoreCandidate(
        {
          topics,
          language: c.language,
          ghCreatedAt: c.gh_created_at,
          followers,
          hn,
          starsThenWeekAgo: then,
          stargazersCount: c.stargazers_count,
        },
        profile,
      )
      return {
        id,
        fullName: c.full_name,
        name: c.name,
        owner: c.owner,
        avatarUrl: c.avatar_url ?? "",
        description: c.description,
        stargazersCount: c.stargazers_count,
        forksCount: c.forks_count,
        language: c.language,
        topics,
        pushedAt: c.pushed_at ?? c.last_seen_at,
        htmlUrl: c.html_url,
        ghCreatedAt: c.gh_created_at,
        firstSeenAt: c.first_seen_at,
        starsDelta7d: then !== null ? c.stargazers_count - then : null,
        followers,
        hn,
        score,
        reasons,
        evidence: reasons.map((r) => r.text),
        relevanceScore: score,
      }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.stargazersCount - a.stargazersCount)

  const scannedAt = visible.reduce<string | null>(
    (max, c) => (!max || c.last_seen_at > max ? c.last_seen_at : max),
    null,
  )

  const body: RadarResponse = {
    items: items.slice(0, MAX_ITEMS),
    total: items.length,
    scannedAt,
    starCount: stars.length,
  }
  return body
}
