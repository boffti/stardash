import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { getUser } from "@/lib/auth"
import { db } from "@/lib/db"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const { isSaved } = (await request.json()) as { isSaved?: boolean }
    if (typeof isSaved !== "boolean") {
      return NextResponse.json({ error: "isSaved boolean required" }, { status: 400 })
    }

    db.prepare(
      "update discover_searches set is_saved = ?, updated_at = ? where id = ? and user_id = ?",
    ).run(isSaved ? 1 : 0, new Date().toISOString(), id, user.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    Sentry.captureException(err)
    console.error("Saved search update error:", err)
    return NextResponse.json({ error: "Failed to update saved search" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    db.prepare("delete from discover_searches where id = ? and user_id = ?").run(id, user.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    Sentry.captureException(err)
    console.error("Saved search delete error:", err)
    return NextResponse.json({ error: "Failed to delete saved search" }, { status: 500 })
  }
}
