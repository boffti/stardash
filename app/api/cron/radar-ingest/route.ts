import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAnyValidGitHubToken } from "@/lib/tokens"
import { ingestRadar } from "@/lib/radar-ingest"
import { RADAR_ENABLED } from "@/lib/flags"

// Nightly Radar ingest (Vercel cron). Runs after star-snapshots so velocity has fresh data.
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!RADAR_ENABLED) return NextResponse.json({ skipped: true, reason: "RADAR_ENABLED is off" })
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET environment variable is required" },
      { status: 500 },
    )
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { token } = await getAnyValidGitHubToken()
  if (!token) {
    return NextResponse.json({ error: "GITHUB_PAT is required for Radar ingest" }, { status: 500 })
  }

  try {
    const admin = createAdminClient()
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, github_username")
      .not("github_username", "is", null)
      .limit(500)
    if (error) throw error

    const users = (profiles ?? []).map((p) => ({
      id: p.id as string,
      login: p.github_username as string,
    }))
    const stats = await ingestRadar({ admin, token, users })
    return NextResponse.json({ success: stats.errors.length === 0, users: users.length, ...stats })
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    )
  }
}
