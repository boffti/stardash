import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface UserRepoMetadataRow {
  github_repo_id: number
  user_starred_repo_id: string
  status: string | null
  is_pinned: boolean
  notes: string | null
  tag_ids: string[]
  collection_ids: string[]
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [repoMetaResult, tagsResult, collectionsResult] = await Promise.all([
      supabase.rpc('get_user_repo_metadata'),
      supabase
        .from('tags')
        .select('id, label, color')
        .eq('user_id', session.user.id)
        .order('label'),
      supabase
        .from('collections')
        .select('id, name, emoji, color')
        .eq('user_id', session.user.id)
        .order('name'),
    ])

    if (repoMetaResult.error || tagsResult.error || collectionsResult.error) {
      throw repoMetaResult.error || tagsResult.error || collectionsResult.error
    }

    const repoMeta: Record<string, {
      dbId: string
      status: string | null
      isPinned: boolean
      notes: string | null
      tagIds: string[]
      collectionIds: string[]
    }> = {}
    const collectionRepoCounts: Record<string, number> = {}

    for (const row of (repoMetaResult.data ?? []) as UserRepoMetadataRow[]) {
      repoMeta[String(row.github_repo_id)] = {
        dbId: row.user_starred_repo_id,
        status: row.status,
        isPinned: row.is_pinned ?? false,
        notes: row.notes,
        tagIds: row.tag_ids ?? [],
        collectionIds: row.collection_ids ?? [],
      }

      for (const collectionId of row.collection_ids ?? []) {
        collectionRepoCounts[collectionId] = (collectionRepoCounts[collectionId] || 0) + 1
      }
    }

    const tags = (tagsResult.data || []).map((tag) => ({
      id: tag.id,
      label: tag.label,
      color: tag.color,
    }))

    const collections = (collectionsResult.data || []).map((collection) => ({
      id: collection.id,
      name: collection.name,
      emoji: collection.emoji || '',
      color: collection.color || '#64748b',
      repoCount: collectionRepoCounts[collection.id] || 0,
    }))

    return NextResponse.json({ tags, collections, repoMeta })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch metadata' }, { status: 500 })
  }
}
