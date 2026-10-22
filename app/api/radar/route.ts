import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { getUser } from "@/lib/auth"
import { RADAR_ENABLED } from "@/lib/flags"
import { buildRadarFeed } from "@/lib/radar-feed"

export type { RadarItem, RadarResponse } from "@/lib/radar-feed"

export async function GET() {
  if (!RADAR_ENABLED) return NextResponse.json({ error: "Not found" }, { status: 404 })
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json(buildRadarFeed(user.id))
  } catch (err) {
    Sentry.captureException(err)
    console.error("Radar error:", err)
    return NextResponse.json({ error: "Radar failed" }, { status: 500 })
  }
}
