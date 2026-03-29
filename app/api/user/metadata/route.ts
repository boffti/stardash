import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [reposResult, tagsResult, collectionsResult] = await Promise.all([
      supabase
        .from('starred_repos')
        .select('id, github_repo_id, status, is_pinned, notes, repo_tags(tag_id), repo_collections(collection_id)')
        .eq('user_id', session.user.id),
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

    const repoMeta: Record<string, {
      dbId: string
      status: string | null
      isPinned: boolean
      notes: string | null
      tagIds: string[]
      collectionIds: string[]
    }> = {}
    const collectionRepoCounts: Record<string, number> = {}

    for (const row of reposResult.data || []) {
      const colIds = (row.repo_collections || []).map((rc: { collection_id: string }) => rc.collection_id)
      repoMeta[String(row.github_repo_id)] = {
        dbId: row.id,
        status: row.status,
        isPinned: row.is_pinned ?? false,
        notes: row.notes,
        tagIds: (row.repo_tags || []).map((rt: { tag_id: string }) => rt.tag_id),
        collectionIds: colIds,
      }
      for (const cid of colIds) {
        collectionRepoCounts[cid] = (collectionRepoCounts[cid] || 0) + 1
      }
    }

    const tags = (tagsResult.data || []).map(t => ({
      id: t.id,
      label: t.label,
      color: t.color,
    }))

    const collections = (collectionsResult.data || []).map(c => ({
      id: c.id,
      name: c.name,
      emoji: c.emoji || '',
      color: c.color || '#64748b',
      repoCount: collectionRepoCounts[c.id] || 0,
    }))

    return NextResponse.json({ tags, collections, repoMeta })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch metadata' }, { status: 500 })
  }
}
