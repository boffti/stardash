import type { SupabaseClient } from '@supabase/supabase-js'
import type { StarredRepo, Tag, Collection, RepoStatus } from './types'

const TAG_PALETTE = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899',
  '#06b6d4', '#ef4444', '#84cc16', '#f97316', '#6366f1',
]

const STARRED_REPOS_UPSERT_BATCH_SIZE = 500

interface RepoRecord {
  id: string
  github_repo_id: number
}

interface UserStarredRepoRecord {
  id: string
  repo_id: string
}

interface TagInput {
  label: string
  color: string
}

interface CollectionInput {
  name: string
  emoji: string
  color: string
}

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

function toGitHubRepoId(repo: StarredRepo): number {
  return parseInt(repo.id, 10)
}

function mapRepoForStorage(repo: StarredRepo) {
  return {
    github_repo_id: toGitHubRepoId(repo),
    owner: repo.owner,
    name: repo.name,
    full_name: repo.fullName,
    description: repo.description,
    language: repo.language,
    language_color: repo.languageColor,
    topics: repo.topics,
    homepage: repo.homepage,
    license: repo.license,
    stargazers_count: repo.stargazersCount,
    forks_count: repo.forksCount,
    open_issues_count: repo.openIssuesCount,
    pushed_at: repo.pushedAt,
    avatar_url: repo.avatarUrl,
    archived: repo.archived ?? false,
  }
}

async function upsertRepoBatch(
  supabase: SupabaseClient,
  batch: StarredRepo[]
): Promise<Map<number, string>> {
  const { data, error } = await supabase
    .from('repos')
    .upsert(batch.map(mapRepoForStorage), { onConflict: 'github_repo_id' })
    .select('id, github_repo_id')

  if (error) throw error

  const repoIdMap = new Map<number, string>()
  for (const row of (data ?? []) as RepoRecord[]) {
    repoIdMap.set(row.github_repo_id, row.id)
  }
  return repoIdMap
}

async function upsertUserStarredRepoBatch(
  supabase: SupabaseClient,
  batch: StarredRepo[],
  userId: string,
  repoIdMap: Map<number, string>
): Promise<Map<number, string>> {
  const rows = batch
    .map((repo) => {
      const githubRepoId = toGitHubRepoId(repo)
      const repoId = repoIdMap.get(githubRepoId)
      if (!repoId) return null
      return {
        user_id: userId,
        repo_id: repoId,
        starred_at: repo.starredAt,
      }
    })
    .filter(Boolean)

  if (rows.length === 0) return new Map()

  const { data, error } = await supabase
    .from('user_starred_repos')
    .upsert(rows, { onConflict: 'user_id,repo_id' })
    .select('id, repo_id')

  if (error) throw error

  const userStarIdMap = new Map<number, string>()
  const userRows = (data ?? []) as UserStarredRepoRecord[]

  for (const row of userRows) {
    const githubRepoId = Array.from(repoIdMap.entries()).find(([, repoId]) => repoId === row.repo_id)?.[0]
    if (githubRepoId !== undefined) {
      userStarIdMap.set(githubRepoId, row.id)
    }
  }

  return userStarIdMap
}

export async function upsertStarredRepos(
  supabase: SupabaseClient,
  repos: StarredRepo[],
  userId: string
): Promise<void> {
  if (repos.length === 0) {
    const { error } = await supabase
      .from('user_starred_repos')
      .delete()
      .eq('user_id', userId)

    if (error) throw error
    return
  }

  const incomingRepoIds = new Set<number>()

  for (let i = 0; i < repos.length; i += STARRED_REPOS_UPSERT_BATCH_SIZE) {
    const batch = repos.slice(i, i + STARRED_REPOS_UPSERT_BATCH_SIZE)
    batch.forEach((repo) => incomingRepoIds.add(toGitHubRepoId(repo)))

    const repoIdMap = await upsertRepoBatch(supabase, batch)
    await upsertUserStarredRepoBatch(supabase, batch, userId, repoIdMap)
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('user_starred_repos')
    .select('id, repo_id, repos!inner(github_repo_id)')
    .eq('user_id', userId)

  if (existingError) throw existingError

  const staleUserStarIds = (existingRows ?? [])
    .filter((row) => {
      const repo = Array.isArray(row.repos) ? row.repos[0] : row.repos
      return !incomingRepoIds.has(repo.github_repo_id)
    })
    .map((row) => row.id)

  if (staleUserStarIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('user_starred_repos')
      .delete()
      .in('id', staleUserStarIds)

    if (deleteError) throw deleteError
  }
}

export async function updateRepoStatus(
  supabase: SupabaseClient,
  dbId: string,
  status: RepoStatus | null
): Promise<void> {
  const { error } = await supabase
    .from('user_starred_repos')
    .update({ status })
    .eq('id', dbId)
  if (error) throw error
}

export async function updateRepoNotes(
  supabase: SupabaseClient,
  dbId: string,
  notes: string
): Promise<void> {
  const { error } = await supabase
    .from('user_starred_repos')
    .update({ notes })
    .eq('id', dbId)
  if (error) throw error
}

export async function togglePin(
  supabase: SupabaseClient,
  dbId: string,
  isPinned: boolean
): Promise<void> {
  const { error } = await supabase
    .from('user_starred_repos')
    .update({ is_pinned: isPinned })
    .eq('id', dbId)
  if (error) throw error
}

export async function createTag(
  supabase: SupabaseClient,
  userId: string,
  label: string,
  color: string
): Promise<Tag> {
  const { data, error } = await supabase
    .from('tags')
    .insert({ user_id: userId, label: normalizeTagLabel(label), color })
    .select()
    .single()
  if (error) throw error
  return { id: data.id, label: data.label, color: data.color }
}

export async function updateTag(
  supabase: SupabaseClient,
  tagId: string,
  label: string,
  color: string
): Promise<Tag> {
  const { data, error } = await supabase
    .from('tags')
    .update({ label: normalizeTagLabel(label), color })
    .eq('id', tagId)
    .select()
    .single()

  if (error) throw error
  return { id: data.id, label: data.label, color: data.color }
}

export async function ensureTags(
  supabase: SupabaseClient,
  userId: string,
  tags: TagInput[]
): Promise<Tag[]> {
  const requested = Array.from(
    new Map(
      tags
        .map((tag) => ({
          label: normalizeTagLabel(tag.label),
          color: tag.color,
        }))
        .filter((tag) => tag.label)
        .map((tag) => [tag.label, tag])
    ).values()
  )

  if (requested.length === 0) return []

  const labels = requested.map((tag) => tag.label)
  const { data: existingTags, error: existingError } = await supabase
    .from('tags')
    .select('id, label, color')
    .eq('user_id', userId)
    .in('label', labels)

  if (existingError) throw existingError

  const existingLabelSet = new Set((existingTags ?? []).map((tag) => tag.label))
  const missingTags = requested.filter((tag) => !existingLabelSet.has(tag.label))

  let insertedTags: Tag[] = []
  if (missingTags.length > 0) {
    const { data, error } = await supabase
      .from('tags')
      .insert(missingTags.map((tag) => ({ user_id: userId, label: tag.label, color: tag.color })))
      .select('id, label, color')

    if (error) throw error
    insertedTags = (data ?? []).map((tag) => ({ id: tag.id, label: tag.label, color: tag.color }))
  }

  const allTags = [
    ...((existingTags ?? []).map((tag) => ({ id: tag.id, label: tag.label, color: tag.color }))),
    ...insertedTags,
  ]

  const tagMap = new Map(allTags.map((tag) => [tag.label, tag]))
  return labels.map((label) => tagMap.get(label)).filter((tag): tag is Tag => Boolean(tag))
}

export async function deleteTag(
  supabase: SupabaseClient,
  tagId: string
): Promise<void> {
  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', tagId)

  if (error) throw error
}

export async function assignTag(
  supabase: SupabaseClient,
  repoDbId: string,
  userId: string,
  tagId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_starred_repo_tags')
    .upsert({ user_starred_repo_id: repoDbId, user_id: userId, tag_id: tagId })
  if (error) throw error
}

export async function removeTag(
  supabase: SupabaseClient,
  repoDbId: string,
  userId: string,
  tagId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_starred_repo_tags')
    .delete()
    .eq('user_starred_repo_id', repoDbId)
    .eq('user_id', userId)
    .eq('tag_id', tagId)
  if (error) throw error
}

export async function createCollection(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  emoji: string,
  color: string
): Promise<Collection> {
  const { data, error } = await supabase
    .from('collections')
    .insert({ user_id: userId, name: normalizeCollectionName(name), emoji, color })
    .select()
    .single()
  if (error) throw error
  return { id: data.id, name: data.name, emoji: data.emoji || '', color: data.color, repoCount: 0 }
}

export async function updateCollection(
  supabase: SupabaseClient,
  collectionId: string,
  name: string,
  emoji: string,
  color: string
): Promise<Collection> {
  const { data, error } = await supabase
    .from('collections')
    .update({ name: normalizeCollectionName(name), emoji, color })
    .eq('id', collectionId)
    .select()
    .single()

  if (error) throw error
  return { id: data.id, name: data.name, emoji: data.emoji || '', color: data.color, repoCount: 0 }
}

export async function ensureCollections(
  supabase: SupabaseClient,
  userId: string,
  collections: CollectionInput[]
): Promise<Collection[]> {
  const requested = Array.from(
    new Map(
      collections
        .map((collection) => ({
          name: normalizeCollectionName(collection.name),
          emoji: collection.emoji,
          color: collection.color,
        }))
        .filter((collection) => collection.name)
        .map((collection) => [collection.name, collection])
    ).values()
  )

  if (requested.length === 0) return []

  const names = requested.map((collection) => collection.name)
  const { data: existingCollections, error: existingError } = await supabase
    .from('collections')
    .select('id, name, emoji, color')
    .eq('user_id', userId)
    .in('name', names)

  if (existingError) throw existingError

  const existingNameSet = new Set((existingCollections ?? []).map((collection) => collection.name))
  const missingCollections = requested.filter((collection) => !existingNameSet.has(collection.name))

  let insertedCollections: Collection[] = []
  if (missingCollections.length > 0) {
    const { data, error } = await supabase
      .from('collections')
      .insert(
        missingCollections.map((collection) => ({
          user_id: userId,
          name: collection.name,
          emoji: collection.emoji,
          color: collection.color,
        }))
      )
      .select('id, name, emoji, color')

    if (error) throw error
    insertedCollections = (data ?? []).map((collection) => ({
      id: collection.id,
      name: collection.name,
      emoji: collection.emoji || '',
      color: collection.color,
      repoCount: 0,
    }))
  }

  const allCollections = [
    ...((existingCollections ?? []).map((collection) => ({
      id: collection.id,
      name: collection.name,
      emoji: collection.emoji || '',
      color: collection.color,
      repoCount: 0,
    }))),
    ...insertedCollections,
  ]

  const collectionMap = new Map(allCollections.map((collection) => [collection.name, collection]))
  return names.map((name) => collectionMap.get(name)).filter((collection): collection is Collection => Boolean(collection))
}

export async function deleteCollection(
  supabase: SupabaseClient,
  collectionId: string
): Promise<void> {
  const { error } = await supabase
    .from('collections')
    .delete()
    .eq('id', collectionId)

  if (error) throw error
}

export async function assignCollection(
  supabase: SupabaseClient,
  repoDbId: string,
  userId: string,
  collectionId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_starred_repo_collections')
    .upsert({ user_starred_repo_id: repoDbId, user_id: userId, collection_id: collectionId })
  if (error) throw error
}

export async function removeCollection(
  supabase: SupabaseClient,
  repoDbId: string,
  userId: string,
  collectionId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_starred_repo_collections')
    .delete()
    .eq('user_starred_repo_id', repoDbId)
    .eq('user_id', userId)
    .eq('collection_id', collectionId)
  if (error) throw error
}
