import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { getUser } from "@/lib/auth"
import { db } from "@/lib/db"
import type { DiscoverSavedSearch } from "@/lib/search-cache"
import { DISCOVER_SEARCH_CACHE_VERSION } from "@/lib/search-cache"

interface DiscoverSearchSummaryRow {
  id: string
  query: string
  normalized_query: string
  context_hash: string | null
  result_count: number
  cached_at: string
  last_run_at: string
  last_opened_at: string | null
  expires_at: string
  is_saved: number
}

function mapSearch(row: DiscoverSearchSummaryRow): DiscoverSavedSearch {
  return {
    id: row.id,
    query: row.query,
    normalizedQuery: row.normalized_query,
    contextHash: row.context_hash,
    resultCount: row.result_count,
    cachedAt: row.cached_at,
    lastRunAt: row.last_run_at,
    lastOpenedAt: row.last_opened_at,
    expiresAt: row.expires_at,
    isSaved: row.is_saved === 1,
  }
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const data = db
      .prepare(
        `select id, query, normalized_query, context_hash, result_count, cached_at, last_run_at, last_opened_at, expires_at, is_saved
         from discover_searches where user_id = ? and search_version = ?
         order by is_saved desc, last_run_at desc limit 50`,
      )
      .all(user.id, DISCOVER_SEARCH_CACHE_VERSION) as unknown as DiscoverSearchSummaryRow[]

    const now = Date.now()
    const searches = data
      .filter((row) => row.is_saved === 1 || new Date(row.expires_at).getTime() > now)
      .slice(0, 24)
      .map(mapSearch)

    return NextResponse.json({ searches })
  } catch (err) {
    Sentry.captureException(err)
    console.error("Saved search list error:", err)
    return NextResponse.json({ error: "Failed to load saved searches" }, { status: 500 })
  }
}
