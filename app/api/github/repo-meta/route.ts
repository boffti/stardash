import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/github/repo-meta?owner=&repo=
// Returns github_repo_id for a given owner/repo pair.
export async function GET(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const owner = searchParams.get("owner")
  const repo = searchParams.get("repo")

  if (!owner || !repo) {
    return NextResponse.json({ error: "owner and repo required" }, { status: 400 })
  }

  try {
    const row = db
      .prepare(
        `select r.github_repo_id from repos r
         join user_starred_repos usr on usr.repo_id = r.id and usr.user_id = ?
         where r.full_name = ?`,
      )
      .get(user.id, `${owner}/${repo}`) as { github_repo_id: number } | undefined

    return NextResponse.json({ githubRepoId: row?.github_repo_id ?? null })
  } catch {
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }
}
