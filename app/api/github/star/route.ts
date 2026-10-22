import { getUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { getValidGitHubToken } from "@/lib/tokens"
import { starRepo, unstarRepo } from "@/lib/github"
import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit"

// Max 10 star/unstar actions per user per minute to protect GitHub API quota
const STAR_RATE_LIMIT = 10
const STAR_RATE_WINDOW_MS = 60_000

const findUserStar = (userId: string, githubRepoId: number) =>
  db
    .prepare(
      `select usr.id from user_starred_repos usr join repos r on r.id = usr.repo_id
       where usr.user_id = ? and r.github_repo_id = ?`,
    )
    .get(userId, githubRepoId) as { id: string } | undefined

export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rl = checkRateLimit(`${user.id}:star`, STAR_RATE_LIMIT, STAR_RATE_WINDOW_MS)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many star/unstar requests. Please slow down." },
        { status: 429, headers: getRateLimitHeaders(rl) },
      )
    }

    const { owner, repo, githubRepoId, collectionIds, tagIds } = await request.json()
    if (!owner || !repo) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const tokenResult = await getValidGitHubToken(user.id)
    if (tokenResult.error || !tokenResult.token) {
      return NextResponse.json({ error: "GitHub token expired" }, { status: 401 })
    }

    await starRepo(tokenResult.token, owner, repo)

    // Upsert tag/collection assignments if provided
    if (githubRepoId && (collectionIds?.length || tagIds?.length)) {
      const userRepoRow = findUserStar(user.id, Number(githubRepoId))

      if (userRepoRow) {
        const addTag = db.prepare(
          "insert or ignore into user_starred_repo_tags (user_starred_repo_id, user_id, tag_id) values (?, ?, ?)",
        )
        const addCollection = db.prepare(
          "insert or ignore into user_starred_repo_collections (user_starred_repo_id, user_id, collection_id) values (?, ?, ?)",
        )
        for (const tagId of (tagIds ?? []) as string[]) addTag.run(userRepoRow.id, user.id, tagId)
        for (const collectionId of (collectionIds ?? []) as string[]) {
          addCollection.run(userRepoRow.id, user.id, collectionId)
        }
      }
    }

    return NextResponse.json({ success: true }, { headers: getRateLimitHeaders(rl) })
  } catch (err) {
    Sentry.captureException(err)
    console.error("Star error:", err)
    return NextResponse.json({ error: "Failed to star repository" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rl = checkRateLimit(`${user.id}:star`, STAR_RATE_LIMIT, STAR_RATE_WINDOW_MS)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many star/unstar requests. Please slow down." },
        { status: 429, headers: getRateLimitHeaders(rl) },
      )
    }

    const { owner, repo, githubRepoId } = await request.json()

    if (!owner || !repo || !githubRepoId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const tokenResult = await getValidGitHubToken(user.id)
    if (tokenResult.error === "expired") {
      return NextResponse.json(
        { error: "GitHub token expired", code: "GITHUB_AUTH_ERROR" },
        { status: 401 },
      )
    }
    if (tokenResult.error === "not_found" || !tokenResult.token) {
      return NextResponse.json(
        { error: "GitHub token not available. Please re-authenticate." },
        { status: 401 },
      )
    }

    // Unstar on GitHub
    await unstarRepo(tokenResult.token, owner, repo)

    // Drop the local star; tag/collection junctions cascade (foreign_keys = on).
    const userRepoRow = findUserStar(user.id, Number(githubRepoId))
    if (userRepoRow) {
      db.prepare("delete from user_starred_repos where id = ? and user_id = ?").run(
        userRepoRow.id,
        user.id,
      )
    }

    return NextResponse.json({ success: true }, { headers: getRateLimitHeaders(rl) })
  } catch (err) {
    Sentry.captureException(err)
    console.error("Unstar error:", err)
    const message = err instanceof Error ? err.message : "Failed to remove star"
    const status = message.includes("401") ? 401 : message.includes("403") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
