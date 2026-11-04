import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { db } from "@/lib/db"
import { getValidGitHubToken } from "@/lib/tokens"
import { isCronAuthorized } from "@/lib/cron-auth"
import { getListsSyncStatus, syncGitHubLists } from "@/lib/github-lists"

// Nightly GitHub Lists sync (lib/scheduler.ts). Only for users who have synced once from
// Settings, so nothing is ever written to GitHub without that first opt-in.
export const maxDuration = 600

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const users = db.prepare("select id from profiles where github_token is not null").all() as {
    id: string
  }[]
  const results: Record<string, string> = {}
  for (const { id } of users) {
    const prev = getListsSyncStatus(id).state
    if (prev === "idle" || prev === "running") continue
    const token = process.env.GITHUB_PAT || (await getValidGitHubToken(id)).token
    if (!token) continue
    const status = await syncGitHubLists(id, token)
    if (status.state === "error") Sentry.captureException(new Error(status.error))
    results[id] = status.state
  }
  return NextResponse.json({ success: true, results })
}
