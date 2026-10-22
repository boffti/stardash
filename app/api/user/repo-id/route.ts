import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const githubRepoIdParam = new URL(request.url).searchParams.get("githubRepoId")
    const githubRepoId = githubRepoIdParam ? parseInt(githubRepoIdParam, 10) : NaN

    if (!Number.isFinite(githubRepoId)) {
      return NextResponse.json({ error: "githubRepoId is required" }, { status: 400 })
    }

    const repoRow = db
      .prepare("select id from repos where github_repo_id = ?")
      .get(githubRepoId) as { id: string } | undefined

    if (!repoRow) {
      return NextResponse.json({ error: "Repo not synced yet" }, { status: 404 })
    }

    const userStarredRepo = db
      .prepare("select id from user_starred_repos where user_id = ? and repo_id = ?")
      .get(user.id, repoRow.id) as { id: string } | undefined

    if (!userStarredRepo) {
      return NextResponse.json({ error: "User star relation not synced yet" }, { status: 404 })
    }

    return NextResponse.json({ dbId: userStarredRepo.id })
  } catch {
    return NextResponse.json({ error: "Failed to resolve repo metadata" }, { status: 500 })
  }
}
