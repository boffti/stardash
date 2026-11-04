import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { getUser } from "@/lib/auth"
import { releaseFeed } from "@/lib/releases"

export type { ReleaseFeed, ReleaseItem } from "@/lib/releases"

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json(releaseFeed(user.id))
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.json({ error: "Releases failed" }, { status: 500 })
  }
}
