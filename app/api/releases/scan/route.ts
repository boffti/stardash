import { NextResponse } from "next/server"
import { after } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { getUser } from "@/lib/auth"
import { getValidGitHubToken } from "@/lib/tokens"
import { runReleases } from "@/lib/releases"
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import { langfuseSpanProcessor } from "@/instrumentation"

// "Check now" in the Releases tab: the user's own repos, their own token and key.
export const maxDuration = 120

// ponytail: in-memory limiter like Radar's scan. ETags make repeat checks nearly free anyway.
const SCAN_LIMIT = 6
const SCAN_WINDOW_MS = 60 * 60 * 1000

export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rl = checkRateLimit(`${user.id}:releases-scan`, SCAN_LIMIT, SCAN_WINDOW_MS)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Checked recently. Releases also refresh nightly." },
        { status: 429, headers: getRateLimitHeaders(rl) },
      )
    }
    const { token } = await getValidGitHubToken(user.id)
    if (!token) return NextResponse.json({ error: "GitHub token expired" }, { status: 401 })

    const stats = await runReleases(token, request, user.id)
    after(async () => {
      await langfuseSpanProcessor?.forceFlush()
    })
    return NextResponse.json(stats, { headers: getRateLimitHeaders(rl) })
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.json({ error: "Check failed" }, { status: 500 })
  }
}
