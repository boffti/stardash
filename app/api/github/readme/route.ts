import { getUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { fetchRepoReadme } from "@/lib/github"
import { getValidGitHubToken } from "@/lib/tokens"
import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit"

// Only uncached (first-time) README fetches count toward this limit.
// 50 live GitHub fetches per user per hour is generous for manual browsing
// but prevents a user with 5,000 repos from triggering 5,000 API calls in a burst.
const README_RATE_LIMIT = 50
const README_RATE_WINDOW_MS = 60 * 60_000 // 1 hour

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const owner = searchParams.get("owner")
    const repo = searchParams.get("repo")

    if (!owner || !repo) {
      return NextResponse.json({ error: "Missing owner or repo parameter" }, { status: 400 })
    }

    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const fullName = `${owner}/${repo}`
    const cached = db
      .prepare(
        `select r.readme from repos r
         join user_starred_repos usr on usr.repo_id = r.id and usr.user_id = ?
         where r.full_name = ?`,
      )
      .get(user.id, fullName) as { readme: string | null } | undefined

    if (cached?.readme) {
      return NextResponse.json({ readme: cached.readme })
    }

    // Cache miss — this will hit the GitHub API. Apply per-user rate limit.
    const rl = checkRateLimit(`${user.id}:readme`, README_RATE_LIMIT, README_RATE_WINDOW_MS)
    if (!rl.allowed) {
      return NextResponse.json(
        { readme: null, error: "README fetch limit reached. Try again later." },
        { status: 429, headers: getRateLimitHeaders(rl) },
      )
    }

    const tokenResult = await getValidGitHubToken(user.id)

    if (tokenResult.error === "expired") {
      return NextResponse.json(
        { error: "GitHub token expired", code: "GITHUB_AUTH_ERROR" },
        { status: 401 },
      )
    }

    const result = await fetchRepoReadme(tokenResult.token ?? undefined, owner, repo)

    if (result.error === "auth") {
      return NextResponse.json(
        { error: "GitHub token expired", code: "GITHUB_AUTH_ERROR" },
        { status: 401 },
      )
    }

    if (result.content) {
      db.prepare("update repos set readme = ? where full_name = ?").run(result.content, fullName)
    }

    return NextResponse.json(
      {
        readme: result.content,
        error: result.error === "server" ? "Failed to fetch README" : undefined,
      },
      { headers: getRateLimitHeaders(rl) },
    )
  } catch (error) {
    console.error("[github/readme] error:", error)
    return NextResponse.json({ error: "Failed to fetch README" }, { status: 500 })
  }
}
