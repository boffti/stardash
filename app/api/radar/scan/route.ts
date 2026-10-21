import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getValidGitHubToken } from "@/lib/tokens"
import { ingestRadar } from "@/lib/radar-ingest"
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import { RADAR_ENABLED } from "@/lib/flags"

// "Scan now": runs the ingest for the current user with their own GitHub token.
export const maxDuration = 120

// ponytail: in-memory limiter, per instance. Move to profiles.last_radar_scan_at if abuse shows up.
const SCAN_LIMIT = 2
const SCAN_WINDOW_MS = 6 * 60 * 60 * 1000

export async function POST() {
  if (!RADAR_ENABLED) return NextResponse.json({ error: "Not found" }, { status: 404 })
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rl = checkRateLimit(`${user.id}:radar-scan`, SCAN_LIMIT, SCAN_WINDOW_MS)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Radar already scanned recently. It refreshes itself nightly." },
        { status: 429, headers: getRateLimitHeaders(rl) },
      )
    }

    const tokenResult = await getValidGitHubToken(user.id)
    if (!tokenResult.token) {
      return NextResponse.json({ error: "GitHub token expired" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("github_username")
      .eq("id", user.id)
      .maybeSingle()
    const login = profile?.github_username as string | null
    const users = login ? [{ id: user.id, login }] : []

    const stats = await ingestRadar({ admin: createAdminClient(), token: tokenResult.token, users })
    return NextResponse.json(stats, { headers: getRateLimitHeaders(rl) })
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.json({ error: "Scan failed" }, { status: 500 })
  }
}
