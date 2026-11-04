import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { getUser } from "@/lib/auth"
import { markReleasesSeen } from "@/lib/releases"

// x in the Releases tab marks a repo's releases read; Undo sends back the previous value.
export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { repoId, restore } = (await request.json()) as {
      repoId?: unknown
      restore?: { value: string | null }
    }
    if (typeof repoId !== "string" || !repoId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }
    const value =
      restore && (restore.value === null || typeof restore.value === "string")
        ? restore.value
        : undefined
    const result = markReleasesSeen(user.id, repoId, value)
    if (!result) return NextResponse.json({ error: "Not in your stars" }, { status: 404 })
    return NextResponse.json({ ok: true, previous: result.previous })
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.json({ error: "Action failed" }, { status: 500 })
  }
}
