import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { fetchRepoStarCount } from "@/lib/github"
import { getAnyValidGitHubToken } from "@/lib/tokens"
import { isCronAuthorized } from "@/lib/cron-auth"

// This route is called by Vercel Cron to snapshot star counts daily
// It processes repos in batches to avoid rate limits

const BATCH_SIZE = 100
const DELAY_BETWEEN_BATCHES_MS = 1000

const upsertSnapshot = db.prepare(
  `insert into repo_star_snapshots (repo_github_id, owner, name, star_count, snapshot_date)
   values (?, ?, ?, ?, ?)
   on conflict (repo_github_id, snapshot_date) do update set
     owner = excluded.owner, name = excluded.name, star_count = excluded.star_count`,
)

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const tokenResult = await getAnyValidGitHubToken()
    const accessToken = tokenResult.token ?? undefined

    // Get all repos from the global repos table
    const reposToProcess = db
      .prepare("select github_repo_id, owner, name from repos")
      .all() as unknown as { github_repo_id: number; owner: string; name: string }[]
    const totalRepos = reposToProcess.length
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    }

    // Process repos in batches
    for (let i = 0; i < totalRepos; i += BATCH_SIZE) {
      const batch = reposToProcess.slice(i, i + BATCH_SIZE)

      await Promise.all(
        batch.map(async (repo) => {
          try {
            const starCount = await fetchRepoStarCount(repo.owner, repo.name, accessToken)

            if (starCount !== null) {
              // Upsert the snapshot (insert or update if exists for today)
              upsertSnapshot.run(
                repo.github_repo_id,
                repo.owner,
                repo.name,
                starCount,
                new Date().toISOString().split("T")[0],
              )
              results.succeeded++
            } else {
              results.failed++
              results.errors.push(`Failed to fetch stars for ${repo.owner}/${repo.name}`)
            }
          } catch (error) {
            results.failed++
            results.errors.push(
              `Error processing ${repo.owner}/${repo.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
            )
          }
        }),
      )

      results.processed += batch.length

      // Delay between batches to avoid rate limits
      if (i + BATCH_SIZE < totalRepos) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS))
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} repos: ${results.succeeded} succeeded, ${results.failed} failed`,
      details: results,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
