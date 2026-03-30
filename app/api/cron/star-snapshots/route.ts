import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchRepoStarCount } from '@/lib/github'
import { getAnyValidGitHubToken } from '@/lib/tokens'

// This route is called by Vercel Cron to snapshot star counts daily
// It processes repos in batches to avoid rate limits

const BATCH_SIZE = 100
const DELAY_BETWEEN_BATCHES_MS = 1000

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Create service role client for database operations
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const tokenResult = await getAnyValidGitHubToken()
    const accessToken = tokenResult.token ?? undefined

    // Get all repos from the global repos table
    const { data: repos, error: reposError } = await supabase
      .from('repos')
      .select('github_repo_id, owner, name')

    if (reposError) {
      throw reposError
    }

    const reposToProcess = repos || []
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
              const { error } = await supabase
                .from('repo_star_snapshots')
                .upsert(
                  {
                    repo_github_id: repo.github_repo_id,
                    owner: repo.owner,
                    name: repo.name,
                    star_count: starCount,
                    snapshot_date: new Date().toISOString().split('T')[0],
                  },
                  {
                    onConflict: 'repo_github_id,snapshot_date',
                  }
                )

              if (error) {
                throw error
              }

              results.succeeded++
            } else {
              results.failed++
              results.errors.push(`Failed to fetch stars for ${repo.owner}/${repo.name}`)
            }
          } catch (error) {
            results.failed++
            results.errors.push(
              `Error processing ${repo.owner}/${repo.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          }
        })
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
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
