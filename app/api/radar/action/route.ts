import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { RADAR_ENABLED } from "@/lib/flags"

const SNOOZE_DAYS = 7
const ACTIONS = new Set(["dismissed", "snoozed", "starred", "undo"])

export async function POST(request: Request) {
  if (!RADAR_ENABLED) return NextResponse.json({ error: "Not found" }, { status: 404 })
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { githubRepoId, action } = await request.json()
    const id = Number(githubRepoId)
    if (!Number.isInteger(id) || id <= 0 || !ACTIONS.has(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    if (action === "undo") {
      const { error: delError } = await supabase
        .from("radar_actions")
        .delete()
        .eq("user_id", user.id)
        .eq("github_repo_id", id)
      if (delError) throw delError
      return NextResponse.json({ ok: true })
    }

    const until =
      action === "snoozed" ? new Date(Date.now() + SNOOZE_DAYS * 86_400_000).toISOString() : null
    const { error: upsertError } = await supabase.from("radar_actions").upsert(
      {
        user_id: user.id,
        github_repo_id: id,
        action,
        until,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,github_repo_id" },
    )
    if (upsertError) throw upsertError
    return NextResponse.json({ ok: true, until })
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.json({ error: "Action failed" }, { status: 500 })
  }
}
