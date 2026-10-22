import { db, nowIso, toJson } from "./db"
import type { StarredRepo, Tag, Collection, RepoStatus } from "./types"

const TAG_PALETTE = [
  "#8b5cf6",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#ef4444",
  "#84cc16",
  "#f97316",
  "#6366f1",
]

const MAX_NOTES_LENGTH = 5000
const MAX_TAG_LABEL_LENGTH = 50
const MAX_COLLECTION_NAME_LENGTH = 50
const MAX_TAGS_PER_USER = 200
const MAX_COLLECTIONS_PER_USER = 50

interface TagInput {
  label: string
  color: string
}

interface CollectionInput {
  name: string
  emoji: string
  color: string
}

interface TagRow {
  id: string
  label: string
  color: string
}

interface CollectionRow {
  id: string
  name: string
  emoji: string | null
  color: string | null
}

const toTag = (r: TagRow): Tag => ({ id: r.id, label: r.label, color: r.color })
const toCollection = (r: CollectionRow): Collection => ({
  id: r.id,
  name: r.name,
  emoji: r.emoji || "",
  color: r.color || "#64748b",
  repoCount: 0,
})

export function pickTagColor(label: string): string {
  let hash = 0
  for (let i = 0; i < label.length; i++) {
    hash = (hash << 5) - hash + label.charCodeAt(i)
    hash |= 0
  }
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length]
}

export function normalizeTagLabel(label: string): string {
  return label.toLowerCase().trim()
}

export function normalizeCollectionName(name: string): string {
  return name.trim()
}

const count = (table: "tags" | "collections", userId: string) =>
  (db.prepare(`select count(*) as n from ${table} where user_id = ?`).get(userId) as { n: number })
    .n

// ── Per-repo metadata (was the get_user_repo_metadata Postgres function) ─────

export interface UserRepoMetadataRow {
  github_repo_id: number
  user_starred_repo_id: string
  status: string | null
  is_pinned: boolean
  notes: string | null
  tag_ids: string[]
  collection_ids: string[]
}

export function getUserRepoMetadata(userId: string): UserRepoMetadataRow[] {
  const rows = db
    .prepare(
      `select r.github_repo_id, usr.id as user_starred_repo_id, usr.status, usr.is_pinned, usr.notes,
              (select group_concat(tag_id) from user_starred_repo_tags t where t.user_starred_repo_id = usr.id) as tag_ids,
              (select group_concat(collection_id) from user_starred_repo_collections c where c.user_starred_repo_id = usr.id) as collection_ids
       from user_starred_repos usr join repos r on r.id = usr.repo_id
       where usr.user_id = ?`,
    )
    .all(userId) as Array<
    Omit<UserRepoMetadataRow, "is_pinned" | "tag_ids" | "collection_ids"> & {
      is_pinned: number
      tag_ids: string | null
      collection_ids: string | null
    }
  >
  return rows.map((r) => ({
    ...r,
    is_pinned: r.is_pinned === 1,
    tag_ids: r.tag_ids ? r.tag_ids.split(",") : [],
    collection_ids: r.collection_ids ? r.collection_ids.split(",") : [],
  }))
}

// ── Star sync ────────────────────────────────────────────────────────────────

const upsertRepo = db.prepare(
  `insert into repos (github_repo_id, owner, name, full_name, description, language, language_color, topics,
                      homepage, license, stargazers_count, forks_count, open_issues_count, pushed_at, avatar_url, archived, updated_at)
   values (@github_repo_id, @owner, @name, @full_name, @description, @language, @language_color, @topics,
           @homepage, @license, @stargazers_count, @forks_count, @open_issues_count, @pushed_at, @avatar_url, @archived, @updated_at)
   on conflict (github_repo_id) do update set
     owner = excluded.owner, name = excluded.name, full_name = excluded.full_name, description = excluded.description,
     language = excluded.language, language_color = excluded.language_color, topics = excluded.topics,
     homepage = excluded.homepage, license = excluded.license, stargazers_count = excluded.stargazers_count,
     forks_count = excluded.forks_count, open_issues_count = excluded.open_issues_count, pushed_at = excluded.pushed_at,
     avatar_url = excluded.avatar_url, archived = excluded.archived, updated_at = excluded.updated_at
   returning id`,
)

const upsertUserStar = db.prepare(
  `insert into user_starred_repos (user_id, repo_id, starred_at) values (?, ?, ?)
   on conflict (user_id, repo_id) do update set starred_at = excluded.starred_at`,
)

export function upsertStarredRepos(repos: StarredRepo[], userId: string): void {
  const ids = repos.map((r) => parseInt(r.id, 10))
  db.exec("begin")
  try {
    for (const repo of repos) {
      const { id: repoId } = upsertRepo.get({
        github_repo_id: parseInt(repo.id, 10),
        owner: repo.owner,
        name: repo.name,
        full_name: repo.fullName,
        description: repo.description,
        language: repo.language,
        language_color: repo.languageColor,
        topics: toJson(repo.topics ?? []),
        homepage: repo.homepage,
        license: repo.license,
        stargazers_count: repo.stargazersCount,
        forks_count: repo.forksCount,
        open_issues_count: repo.openIssuesCount,
        pushed_at: repo.pushedAt,
        avatar_url: repo.avatarUrl,
        archived: repo.archived ? 1 : 0,
        updated_at: nowIso(),
      }) as { id: string }
      upsertUserStar.run(userId, repoId, repo.starredAt)
    }
    // Drop stars the user no longer has.
    db.prepare(
      `delete from user_starred_repos where user_id = ? and repo_id in
         (select id from repos where github_repo_id not in (select value from json_each(?)))`,
    ).run(userId, toJson(ids))
    db.exec("commit")
  } catch (e) {
    db.exec("rollback")
    throw e
  }
}

// ── Per-star fields ──────────────────────────────────────────────────────────

export function updateRepoStatus(dbId: string, userId: string, status: RepoStatus | null): void {
  db.prepare("update user_starred_repos set status = ? where id = ? and user_id = ?").run(
    status,
    dbId,
    userId,
  )
}

export function updateRepoNotes(dbId: string, userId: string, notes: string): void {
  if (notes.length > MAX_NOTES_LENGTH) {
    throw new Error(`Notes must be ${MAX_NOTES_LENGTH} characters or fewer`)
  }
  db.prepare("update user_starred_repos set notes = ? where id = ? and user_id = ?").run(
    notes,
    dbId,
    userId,
  )
}

export function togglePin(dbId: string, userId: string, isPinned: boolean): void {
  db.prepare("update user_starred_repos set is_pinned = ? where id = ? and user_id = ?").run(
    isPinned ? 1 : 0,
    dbId,
    userId,
  )
}

// ── Tags ─────────────────────────────────────────────────────────────────────

export function listTags(userId: string): Tag[] {
  return (
    db
      .prepare("select id, label, color from tags where user_id = ? order by label")
      .all(userId) as unknown as TagRow[]
  ).map(toTag)
}

export function createTag(userId: string, label: string, color: string): Tag {
  const normalized = normalizeTagLabel(label)
  if (normalized.length > MAX_TAG_LABEL_LENGTH) {
    throw new Error(`Tag label must be ${MAX_TAG_LABEL_LENGTH} characters or fewer`)
  }
  if (count("tags", userId) >= MAX_TAGS_PER_USER) {
    throw new Error(`You can have at most ${MAX_TAGS_PER_USER} tags`)
  }
  const row = db
    .prepare("insert into tags (user_id, label, color) values (?, ?, ?) returning id, label, color")
    .get(userId, normalized, color) as unknown as TagRow
  return toTag(row)
}

export function updateTag(tagId: string, userId: string, label: string, color: string): Tag {
  const normalized = normalizeTagLabel(label)
  if (normalized.length > MAX_TAG_LABEL_LENGTH) {
    throw new Error(`Tag label must be ${MAX_TAG_LABEL_LENGTH} characters or fewer`)
  }
  const row = db
    .prepare(
      "update tags set label = ?, color = ? where id = ? and user_id = ? returning id, label, color",
    )
    .get(normalized, color, tagId, userId) as unknown as TagRow | undefined
  if (!row) throw new Error("Tag not found")
  return toTag(row)
}

/** Returns tags for every requested label, creating the missing ones (up to the per-user cap). */
export function ensureTags(userId: string, tags: TagInput[]): Tag[] {
  const requested = Array.from(
    new Map(
      tags
        .map((t) => ({
          label: normalizeTagLabel(t.label).slice(0, MAX_TAG_LABEL_LENGTH),
          color: t.color,
        }))
        .filter((t) => t.label)
        .map((t) => [t.label, t]),
    ).values(),
  )
  if (requested.length === 0) return []

  const existing = new Map(listTags(userId).map((t) => [t.label, t]))
  let slots = MAX_TAGS_PER_USER - existing.size
  const insert = db.prepare(
    "insert into tags (user_id, label, color) values (?, ?, ?) returning id, label, color",
  )
  for (const t of requested) {
    if (existing.has(t.label) || slots <= 0) continue
    existing.set(t.label, toTag(insert.get(userId, t.label, t.color) as unknown as TagRow))
    slots--
  }
  return requested.map((t) => existing.get(t.label)).filter((t): t is Tag => Boolean(t))
}

export function deleteTag(tagId: string, userId: string): void {
  db.prepare("delete from tags where id = ? and user_id = ?").run(tagId, userId)
}

export function assignTag(repoDbId: string, userId: string, tagId: string): void {
  db.prepare(
    "insert or ignore into user_starred_repo_tags (user_starred_repo_id, user_id, tag_id) values (?, ?, ?)",
  ).run(repoDbId, userId, tagId)
}

export function removeTag(repoDbId: string, userId: string, tagId: string): void {
  db.prepare(
    "delete from user_starred_repo_tags where user_starred_repo_id = ? and user_id = ? and tag_id = ?",
  ).run(repoDbId, userId, tagId)
}

// ── Collections ──────────────────────────────────────────────────────────────

export function listCollections(userId: string): Collection[] {
  return (
    db
      .prepare("select id, name, emoji, color from collections where user_id = ? order by name")
      .all(userId) as unknown as CollectionRow[]
  ).map(toCollection)
}

export function createCollection(
  userId: string,
  name: string,
  emoji: string,
  color: string,
): Collection {
  const normalized = normalizeCollectionName(name)
  if (normalized.length > MAX_COLLECTION_NAME_LENGTH) {
    throw new Error(`Collection name must be ${MAX_COLLECTION_NAME_LENGTH} characters or fewer`)
  }
  if (count("collections", userId) >= MAX_COLLECTIONS_PER_USER) {
    throw new Error(`You can have at most ${MAX_COLLECTIONS_PER_USER} collections`)
  }
  const row = db
    .prepare(
      "insert into collections (user_id, name, emoji, color) values (?, ?, ?, ?) returning id, name, emoji, color",
    )
    .get(userId, normalized, emoji, color) as unknown as CollectionRow
  return toCollection(row)
}

export function updateCollection(
  collectionId: string,
  userId: string,
  name: string,
  emoji: string,
  color: string,
): Collection {
  const normalized = normalizeCollectionName(name)
  if (normalized.length > MAX_COLLECTION_NAME_LENGTH) {
    throw new Error(`Collection name must be ${MAX_COLLECTION_NAME_LENGTH} characters or fewer`)
  }
  const row = db
    .prepare(
      "update collections set name = ?, emoji = ?, color = ? where id = ? and user_id = ? returning id, name, emoji, color",
    )
    .get(normalized, emoji, color, collectionId, userId) as unknown as CollectionRow | undefined
  if (!row) throw new Error("Collection not found")
  return toCollection(row)
}

export function ensureCollections(userId: string, collections: CollectionInput[]): Collection[] {
  const requested = Array.from(
    new Map(
      collections
        .map((c) => ({
          name: normalizeCollectionName(c.name).slice(0, MAX_COLLECTION_NAME_LENGTH),
          emoji: c.emoji,
          color: c.color,
        }))
        .filter((c) => c.name)
        .map((c) => [c.name, c]),
    ).values(),
  )
  if (requested.length === 0) return []

  const existing = new Map(listCollections(userId).map((c) => [c.name, c]))
  let slots = MAX_COLLECTIONS_PER_USER - existing.size
  const insert = db.prepare(
    "insert into collections (user_id, name, emoji, color) values (?, ?, ?, ?) returning id, name, emoji, color",
  )
  for (const c of requested) {
    if (existing.has(c.name) || slots <= 0) continue
    existing.set(
      c.name,
      toCollection(insert.get(userId, c.name, c.emoji, c.color) as unknown as CollectionRow),
    )
    slots--
  }
  return requested.map((c) => existing.get(c.name)).filter((c): c is Collection => Boolean(c))
}

export function deleteCollection(collectionId: string, userId: string): void {
  db.prepare("delete from collections where id = ? and user_id = ?").run(collectionId, userId)
}

export function assignCollection(repoDbId: string, userId: string, collectionId: string): void {
  db.prepare(
    "insert or ignore into user_starred_repo_collections (user_starred_repo_id, user_id, collection_id) values (?, ?, ?)",
  ).run(repoDbId, userId, collectionId)
}

export function removeCollection(repoDbId: string, userId: string, collectionId: string): void {
  db.prepare(
    "delete from user_starred_repo_collections where user_starred_repo_id = ? and user_id = ? and collection_id = ?",
  ).run(repoDbId, userId, collectionId)
}
