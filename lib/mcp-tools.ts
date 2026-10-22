import { db, fromJson, toJson } from "@/lib/db"
import { RADAR_ENABLED } from "@/lib/flags"
import { starRepo as githubStar } from "@/lib/github"
import { buildRadarFeed } from "@/lib/radar-feed"
import { getValidGitHubToken } from "@/lib/tokens"
import type { RepoStatus } from "@/lib/types"
import {
  assignCollection,
  assignTag,
  ensureCollections,
  ensureTags,
  updateRepoNotes,
  updateRepoStatus,
} from "@/lib/user-metadata"

// Tool implementations behind /api/mcp. Pure functions of (userId, args); the
// route only does auth and JSON-RPC plumbing. Keep outputs small: agents pay per token.

interface StarRow {
  usr_id: string
  full_name: string
  description: string | null
  language: string | null
  topics: string
  stargazers_count: number
  pushed_at: string | null
  starred_at: string | null
  status: string | null
  is_pinned: number
  notes: string | null
  tags: string | null
  collections: string | null
}

const STAR_SELECT = `
  select usr.id as usr_id, r.full_name, r.description, r.language, r.topics, r.stargazers_count,
         r.pushed_at, usr.starred_at, usr.status, usr.is_pinned, usr.notes,
         (select group_concat(t.label, ',') from user_starred_repo_tags j join tags t on t.id = j.tag_id
            where j.user_starred_repo_id = usr.id) as tags,
         (select group_concat(c.name, '|') from user_starred_repo_collections j join collections c on c.id = j.collection_id
            where j.user_starred_repo_id = usr.id) as collections
  from user_starred_repos usr join repos r on r.id = usr.repo_id
  where usr.user_id = ?`

const shape = (r: StarRow) => ({
  fullName: r.full_name,
  description: r.description,
  language: r.language,
  topics: fromJson<string[]>(r.topics, []),
  stars: r.stargazers_count,
  pushedAt: r.pushed_at,
  starredAt: r.starred_at,
  status: r.status,
  pinned: r.is_pinned === 1,
  notes: r.notes,
  tags: r.tags ? r.tags.split(",") : [],
  collections: r.collections ? r.collections.split("|") : [],
})

export function searchStars(
  userId: string,
  args: {
    query?: string
    tag?: string
    collection?: string
    language?: string
    status?: string
    limit?: number
  },
) {
  const clauses: string[] = []
  const params: unknown[] = [userId]
  if (args.query) {
    const q = `%${args.query}%`
    clauses.push(
      "(r.full_name like ? or r.description like ? or usr.notes like ? or r.topics like ?)",
    )
    params.push(q, q, q, q)
  }
  if (args.language) {
    clauses.push("r.language = ? collate nocase")
    params.push(args.language)
  }
  if (args.status) {
    clauses.push("usr.status = ?")
    params.push(args.status)
  }
  if (args.tag) {
    clauses.push(
      "exists (select 1 from user_starred_repo_tags j join tags t on t.id = j.tag_id where j.user_starred_repo_id = usr.id and t.label = ? collate nocase)",
    )
    params.push(args.tag)
  }
  if (args.collection) {
    clauses.push(
      "exists (select 1 from user_starred_repo_collections j join collections c on c.id = j.collection_id where j.user_starred_repo_id = usr.id and c.name = ? collate nocase)",
    )
    params.push(args.collection)
  }
  const limit = Math.min(Math.max(args.limit ?? 25, 1), 100)
  const sql = `${STAR_SELECT}${clauses.length ? " and " + clauses.join(" and ") : ""} order by usr.starred_at desc limit ?`
  const rows = db.prepare(sql).all(...(params as string[]), limit) as unknown as StarRow[]
  return rows.map(shape)
}

export function getRepo(userId: string, fullName: string) {
  const row = db
    .prepare(`${STAR_SELECT} and r.full_name = ? collate nocase`)
    .get(userId, fullName) as StarRow | undefined
  if (!row) return null
  const readme = (
    db
      .prepare(
        "select substr(readme, 1, 4000) as readme from repos where full_name = ? collate nocase",
      )
      .get(fullName) as { readme: string | null } | undefined
  )?.readme
  return { ...shape(row), readmeExcerpt: readme ?? null }
}

export function listTaxonomy(userId: string) {
  const tagCounts = db
    .prepare(
      "select t.label, count(j.tag_id) as n from tags t left join user_starred_repo_tags j on j.tag_id = t.id where t.user_id = ? group by t.id order by n desc",
    )
    .all(userId) as unknown as { label: string; n: number }[]
  const collectionCounts = db
    .prepare(
      "select c.name, count(j.collection_id) as n from collections c left join user_starred_repo_collections j on j.collection_id = c.id where c.user_id = ? group by c.id order by n desc",
    )
    .all(userId) as unknown as { name: string; n: number }[]
  return { tags: tagCounts, collections: collectionCounts }
}

const STATUSES: RepoStatus[] = [
  "want-to-try",
  "currently-using",
  "tried-liked",
  "tried-dropped",
  "just-interesting",
  "reference",
]

export function organizeRepo(
  userId: string,
  args: {
    fullName: string
    status?: string | null
    notes?: string
    tags?: string[]
    collections?: string[]
  },
) {
  const row = db
    .prepare(
      "select usr.id from user_starred_repos usr join repos r on r.id = usr.repo_id where usr.user_id = ? and r.full_name = ? collate nocase",
    )
    .get(userId, args.fullName) as { id: string } | undefined
  if (!row) return { error: `${args.fullName} is not in your stars. Star it and sync first.` }
  if (args.status !== undefined) {
    if (args.status !== null && !STATUSES.includes(args.status as RepoStatus)) {
      return { error: `status must be one of ${STATUSES.join(", ")} or null` }
    }
    updateRepoStatus(row.id, userId, args.status as RepoStatus | null)
  }
  if (args.notes !== undefined) updateRepoNotes(row.id, userId, args.notes)
  if (args.tags?.length) {
    for (const t of ensureTags(
      userId,
      args.tags.map((label) => ({ label, color: "#6366f1" })),
    )) {
      assignTag(row.id, userId, t.id)
    }
  }
  if (args.collections?.length) {
    const cols = ensureCollections(
      userId,
      args.collections.map((name) => ({ name, emoji: "", color: "#64748b" })),
    )
    for (const c of cols) assignCollection(row.id, userId, c.id)
  }
  return getRepo(userId, args.fullName)
}

export function radarFeed(userId: string, limit = 20) {
  if (!RADAR_ENABLED)
    return { items: [], note: "Radar is disabled on this instance (NEXT_PUBLIC_RADAR_ENABLED)." }
  const feed = buildRadarFeed(userId)
  return {
    scannedAt: feed.scannedAt,
    total: feed.total,
    items: feed.items.slice(0, Math.min(Math.max(limit, 1), 80)).map((i) => ({
      id: i.id,
      fullName: i.fullName,
      description: i.description,
      language: i.language,
      stars: i.stargazersCount,
      starsDelta7d: i.starsDelta7d,
      followers: i.followers,
      score: i.score,
      why: i.evidence,
      url: i.htmlUrl,
    })),
  }
}

export function radarAction(
  userId: string,
  githubRepoId: number,
  action: "dismissed" | "snoozed" | "undo",
) {
  if (action === "undo") {
    db.prepare("delete from radar_actions where user_id = ? and github_repo_id = ?").run(
      userId,
      githubRepoId,
    )
    return { ok: true }
  }
  const until = action === "snoozed" ? new Date(Date.now() + 7 * 86_400_000).toISOString() : null
  db.prepare(
    `insert into radar_actions (user_id, github_repo_id, action, until) values (?, ?, ?, ?)
     on conflict (user_id, github_repo_id) do update set action = excluded.action, until = excluded.until`,
  ).run(userId, githubRepoId, action, until)
  return { ok: true, until }
}

export async function starOnGitHub(userId: string, owner: string, repo: string) {
  const { token } = await getValidGitHubToken(userId)
  if (!token) return { error: "No GitHub token for this user. Sign in to StarDash again." }
  await githubStar(token, owner, repo)
  return { ok: true, note: "Starred on GitHub. It appears in StarDash after the next sync." }
}

export const json = (value: unknown) => toJson(value)
