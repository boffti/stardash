import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { type RepoInsightRow, rowToIntel } from '@/lib/repo-insight-row'

// Page size for paginating starred repos when building the .in() list.
// Supabase supports up to 1,000 items in an .in() filter, so we chunk
// the starred list and fan out in parallel to avoid oversized queries.
const CHUNK_SIZE = 500

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Paginate through user_starred_repos to collect all starred full_names
    // without a single unbounded select.
    const fullNames: string[] = []
    let page = 0
    const PAGE_SIZE = 1000

    while (true) {
      const { data: starredPage, error: starredError } = await supabase
        .from('user_starred_repos')
        .select('repos(full_name)')
        .eq('user_id', user.id)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (starredError) {
        Sentry.captureException(starredError)
        return NextResponse.json({ error: 'Failed to fetch starred repos' }, { status: 500 })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageNames = (starredPage ?? []).map((r: any) => r.repos?.full_name).filter(Boolean)
      fullNames.push(...pageNames)

      if ((starredPage ?? []).length < PAGE_SIZE) break
      page++
    }

    if (fullNames.length === 0) {
      return NextResponse.json({ intel: [] })
    }

    // Fan out chunked .in() queries in parallel so no single query exceeds
    // CHUNK_SIZE items, then merge and sort client-side.
    const adminClient = createAdminClient()
    const chunks: string[][] = []
    for (let i = 0; i < fullNames.length; i += CHUNK_SIZE) {
      chunks.push(fullNames.slice(i, i + CHUNK_SIZE))
    }

    const chunkResults = await Promise.all(
      chunks.map(chunk =>
        adminClient
          .from('repo_insights')
          .select('*')
          .in('repo_full_name', chunk)
          .order('health_score', { ascending: false })
      )
    )

    const allInsights: RepoInsightRow[] = []
    for (const { data, error } of chunkResults) {
      if (error) {
        Sentry.captureException(error)
        return NextResponse.json({ error: 'Failed to fetch intel' }, { status: 500 })
      }
      allInsights.push(...((data ?? []) as RepoInsightRow[]))
    }

    // Re-sort after merging chunks
    allInsights.sort((a, b) => b.health_score - a.health_score)

    return NextResponse.json({ intel: allInsights.map(row => rowToIntel(row)) })
  } catch (err) {
    Sentry.captureException(err)
    console.error('[intel/all] error:', err)
    return NextResponse.json({ error: 'Failed to fetch intel' }, { status: 500 })
  }
}
