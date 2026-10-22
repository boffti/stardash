import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { getUser } from "@/lib/auth"
import { db, nowIso } from "@/lib/db"
import { RADAR_ENABLED } from "@/lib/flags"

const SNOOZE_DAYS = 7
const ACTIONS = new Set(["dismissed", "snoozed", "starred", "undo"])

export async function POST(request: Request) {
  if (!RADAR_ENABLED) return NextResponse.json({ error: "Not found" }, { status: 404 })
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { githubRepoId, action } = await request.json()
    const id = Number(githubRepoId)
    if (!Number.isInteger(id) || id <= 0 || !ACTIONS.has(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    if (action === "undo") {
      db.prepare("delete from radar_actions where user_id = ? and github_repo_id = ?").run(
        user.id,
        id,
      )
      return NextResponse.json({ ok: true })
    }

    const until =
      action === "snoozed" ? new Date(Date.now() + SNOOZE_DAYS * 86_400_000).toISOString() : null
    db.prepare(
      `insert into radar_actions (user_id, github_repo_id, action, until, created_at)
       values (?, ?, ?, ?, ?)
       on conflict (user_id, github_repo_id) do update set
         action = excluded.action, until = excluded.until, created_at = excluded.created_at`,
    ).run(user.id, id, action, until, nowIso())
    return NextResponse.json({ ok: true, until })
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.json({ error: "Action failed" }, { status: 500 })
  }
}
