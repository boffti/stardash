import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import type { DiscoverSavedSearch } from '@/lib/search-cache'
import { DISCOVER_SEARCH_CACHE_VERSION } from '@/lib/search-cache'

interface DiscoverSearchSummaryRow {
  id: string
  query: string
  normalized_query: string
  result_count: number
  cached_at: string
  last_run_at: string
  last_opened_at: string | null
  expires_at: string
  is_saved: boolean
}

function mapSearch(row: DiscoverSearchSummaryRow): DiscoverSavedSearch {
  return {
    id: row.id,
    query: row.query,
    normalizedQuery: row.normalized_query,
    resultCount: row.result_count,
    cachedAt: row.cached_at,
    lastRunAt: row.last_run_at,
    lastOpenedAt: row.last_opened_at,
    expiresAt: row.expires_at,
    isSaved: row.is_saved,
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('discover_searches')
      .select('id, query, normalized_query, result_count, cached_at, last_run_at, last_opened_at, expires_at, is_saved')
      .eq('user_id', user.id)
      .eq('search_version', DISCOVER_SEARCH_CACHE_VERSION)
      .order('is_saved', { ascending: false })
      .order('last_run_at', { ascending: false })
      .limit(50)

    if (error) throw error

    const now = Date.now()
    const searches = ((data ?? []) as DiscoverSearchSummaryRow[])
      .filter(row => row.is_saved || new Date(row.expires_at).getTime() > now)
      .slice(0, 24)
      .map(mapSearch)

    return NextResponse.json({ searches })
  } catch (err) {
    Sentry.captureException(err)
    console.error('Saved search list error:', err)
    return NextResponse.json({ error: 'Failed to load saved searches' }, { status: 500 })
  }
}
