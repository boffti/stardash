import { NextResponse, after } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { getUser } from "@/lib/auth"
import { getValidGitHubToken } from "@/lib/tokens"
import { getListsSyncStatus, syncGitHubLists } from "@/lib/github-lists"

// Settings → GitHub Lists. POST starts a sync in the background; GET reports progress.
// Writing lists needs GITHUB_PAT (classic, user scope): GitHub App tokens can only read them.

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(getListsSyncStatus(user.id))
}

export async function POST() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (getListsSyncStatus(user.id).state === "running") {
      return NextResponse.json({ error: "A sync is already running." }, { status: 409 })
    }
    const token = process.env.GITHUB_PAT || (await getValidGitHubToken(user.id)).token
    if (!token) return NextResponse.json({ error: "GitHub token expired" }, { status: 401 })
    // A first sync writes a few hundred repos at GitHub's pace, so it outlives the request.
    after(async () => {
      const status = await syncGitHubLists(user.id, token)
      if (status.state === "error") Sentry.captureException(new Error(status.error))
    })
    return NextResponse.json({ started: true }, { status: 202 })
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.json({ error: "Sync failed to start" }, { status: 500 })
  }
}
