import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { getUser } from "@/lib/auth"
import { db, fromJson } from "@/lib/db"
import type { RepoIntel } from "@/lib/types"
import { type RepoInsightRow, rowToIntel } from "@/lib/repo-insight-row"

// SQLite stores top_pain_points and metrics as JSON text.
type StoredInsightRow = Omit<RepoInsightRow, "top_pain_points" | "metrics"> & {
  top_pain_points: string | null
  metrics: string | null
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // One join: every cached insight for a repo this user has starred, best health first.
    const rows = db
      .prepare(
        `select ri.* from repo_insights ri
         where ri.repo_full_name in (
           select r.full_name from user_starred_repos usr join repos r on r.id = usr.repo_id
           where usr.user_id = ?
         )
         order by coalesce(ri.health_score, 0) desc`,
      )
      .all(user.id) as unknown as StoredInsightRow[]

    const intel = rows.map((row) =>
      rowToIntel({
        ...row,
        top_pain_points: fromJson<string[] | null>(row.top_pain_points, null),
        metrics: fromJson<RepoIntel["metrics"] | null>(row.metrics, null),
      }),
    )

    return NextResponse.json({ intel })
  } catch (err) {
    Sentry.captureException(err)
    console.error("[intel/all] error:", err)
    return NextResponse.json({ error: "Failed to fetch intel" }, { status: 500 })
  }
}
