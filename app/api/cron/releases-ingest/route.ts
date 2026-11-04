import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { getAnyValidGitHubToken } from "@/lib/tokens"
import { isCronAuthorized } from "@/lib/cron-auth"
import { runReleases } from "@/lib/releases"
import { langfuseSpanProcessor } from "@/instrumentation"

// Nightly releases check for every currently-using repo (lib/scheduler.ts).
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { token } = await getAnyValidGitHubToken()
  if (!token) return NextResponse.json({ error: "No GitHub token" }, { status: 500 })
  try {
    // A bare Request: the nightly job only ever uses the server's env key.
    const stats = await runReleases(token, new Request(request.url))
    after(async () => {
      await langfuseSpanProcessor?.forceFlush()
    })
    return NextResponse.json({ success: stats.errors.length === 0, ...stats })
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.json({ success: false, error: "Releases ingest failed" }, { status: 500 })
  }
}
