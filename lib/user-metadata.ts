import type { SupabaseClient } from '@supabase/supabase-js'
import type { StarredRepo, Tag, Collection, RepoStatus } from './types'

const TAG_PALETTE = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899',
  '#06b6d4', '#ef4444', '#84cc16', '#f97316', '#6366f1',
]

export function pickTagColor(label: string): string {
  let hash = 0
  for (let i = 0; i < label.length; i++) {
    hash = (hash << 5) - hash + label.charCodeAt(i)
    hash |= 0
  }
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length]
}

/** Upsert a repo to get its DB UUID. Safe to call repeatedly. */
export async function ensureRepo(
  supabase: SupabaseClient,
  repo: StarredRepo,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('starred_repos')
    .upsert({
      user_id: userId,
      github_repo_id: parseInt(repo.id, 10),
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
      starred_at: repo.starredAt,
      avatar_url: repo.avatarUrl,
    }, { onConflict: 'user_id,github_repo_id' })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function updateRepoStatus(
  supabase: SupabaseClient,
  dbId: string,
  status: RepoStatus | null
): Promise<void> {
  const { error } = await supabase
    .from('starred_repos')
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
    .from('starred_repos')
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
    .from('starred_repos')
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
    .insert({ user_id: userId, label: label.toLowerCase().trim(), color })
    .select()
    .single()
  if (error) throw error
  return { id: data.id, label: data.label, color: data.color }
}

export async function assignTag(
  supabase: SupabaseClient,
  repoDbId: string,
  tagId: string
): Promise<void> {
  const { error } = await supabase
    .from('repo_tags')
    .upsert({ repo_id: repoDbId, tag_id: tagId })
  if (error) throw error
}

export async function removeTag(
  supabase: SupabaseClient,
  repoDbId: string,
  tagId: string
): Promise<void> {
  const { error } = await supabase
    .from('repo_tags')
    .delete()
    .eq('repo_id', repoDbId)
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
    .insert({ user_id: userId, name, emoji, color })
    .select()
    .single()
  if (error) throw error
  return { id: data.id, name: data.name, emoji: data.emoji || '', color: data.color, repoCount: 0 }
}

export async function assignCollection(
  supabase: SupabaseClient,
  repoDbId: string,
  collectionId: string
): Promise<void> {
  const { error } = await supabase
    .from('repo_collections')
    .upsert({ repo_id: repoDbId, collection_id: collectionId })
  if (error) throw error
}

export async function removeCollection(
  supabase: SupabaseClient,
  repoDbId: string,
  collectionId: string
): Promise<void> {
  const { error } = await supabase
    .from('repo_collections')
    .delete()
    .eq('repo_id', repoDbId)
    .eq('collection_id', collectionId)
  if (error) throw error
}
