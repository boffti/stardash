import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { getUser } from "@/lib/auth"
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
    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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

    const users = user.login ? [{ id: user.id, login: user.login }] : []
    const stats = await ingestRadar({ token: tokenResult.token, users })
    return NextResponse.json(stats, { headers: getRateLimitHeaders(rl) })
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.json({ error: "Scan failed" }, { status: 500 })
  }
}
