import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { db } from "@/lib/db"
import { getAnyValidGitHubToken } from "@/lib/tokens"
import { isCronAuthorized } from "@/lib/cron-auth"
import { ingestRadar } from "@/lib/radar-ingest"
import { RADAR_ENABLED } from "@/lib/flags"

// Nightly Radar ingest (Vercel cron). Runs after star-snapshots so velocity has fresh data.
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!RADAR_ENABLED) return NextResponse.json({ skipped: true, reason: "RADAR_ENABLED is off" })
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { token } = await getAnyValidGitHubToken()
  if (!token) {
    return NextResponse.json({ error: "GITHUB_PAT is required for Radar ingest" }, { status: 500 })
  }

  try {
    const users = db
      .prepare(
        `select id, github_username as login from profiles
           where github_token is not null and github_username is not null limit 500`,
      )
      .all() as unknown as { id: string; login: string }[]
    const stats = await ingestRadar({ token, users })
    return NextResponse.json({ success: stats.errors.length === 0, users: users.length, ...stats })
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    )
  }
}
