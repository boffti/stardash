import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { getUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { getValidGitHubToken } from "@/lib/tokens"
import {
  fetchRepoContributionIssues,
  rankReposForIssueDiscovery,
  type ContributionOpportunity,
  type ContributionPreferences,
} from "@/lib/contribution-opportunities"
import type { StarredRepo } from "@/lib/types"

export const maxDuration = 60

const SCAN_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes between broad scans per user
const SCAN_BATCH_SIZE = 5

interface RequestBody {
  repos?: StarredRepo[]
  preferences?: ContributionPreferences
  maxRepos?: number
  maxIssuesPerRepo?: number
  minScore?: number
  // Note: `force` is intentionally removed — it was a public bypass of the
  // cooldown with no server-side authorization check.
}

async function fetchContributionIssueBatches(
  token: string | undefined,
  repos: StarredRepo[],
  preferences: ContributionPreferences,
  maxIssuesPerRepo: number,
  minScore: number,
) {
  const opportunities: ContributionOpportunity[] = []

  for (let index = 0; index < repos.length; index += SCAN_BATCH_SIZE) {
    const batch = repos.slice(index, index + SCAN_BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map((repo) =>
        fetchRepoContributionIssues(token, repo, preferences, {
          maxIssues: maxIssuesPerRepo,
          minScore,
        }),
      ),
    )
    opportunities.push(...batchResults.flat())
  }

  return opportunities
}

export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = (await request.json()) as RequestBody
    const repos = body.repos ?? []

    if (!Array.isArray(repos) || repos.length === 0) {
      return NextResponse.json({ opportunities: [], scannedRepos: 0 })
    }

    const isSingleRepoScan = repos.length === 1

    const { token, error: tokenError } = await getValidGitHubToken(user.id)
    if (tokenError === "expired") {
      return NextResponse.json(
        { error: "GitHub token expired. Please sign in again." },
        { status: 401 },
      )
    }

    const now = Date.now()

    // ponytail: self-hosted single-owner build. The per-day single-repo scan cap
    // is gone (hosted quotas come back later); broad scans keep the 5-minute cooldown.
    if (!isSingleRepoScan) {
      const profile = db
        .prepare("select last_contribution_scan_at from profiles where id = ?")
        .get(user.id) as { last_contribution_scan_at: string | null } | undefined

      if (profile?.last_contribution_scan_at) {
        const msSinceLast = now - new Date(profile.last_contribution_scan_at).getTime()
        if (msSinceLast < SCAN_COOLDOWN_MS) {
          const retryAfter = Math.ceil((SCAN_COOLDOWN_MS - msSinceLast) / 1000)
          return NextResponse.json(
            {
              error: "Please wait before scanning for contribution opportunities again.",
              retryAfterSeconds: retryAfter,
            },
            { status: 429, headers: { "Retry-After": String(retryAfter) } },
          )
        }
      }

      // Record broad scan start time before expensive multi-repo GitHub API calls.
      db.prepare("update profiles set last_contribution_scan_at = ? where id = ?").run(
        new Date(now).toISOString(),
        user.id,
      )
    }

    const preferences = body.preferences ?? {}
    const maxRepos = Math.min(Math.max(body.maxRepos ?? 24, 5), 40)
    const maxIssuesPerRepo = Math.min(Math.max(body.maxIssuesPerRepo ?? 100, 20), 500)
    const minScore = Math.min(Math.max(body.minScore ?? (isSingleRepoScan ? 0 : 28), 0), 100)
    const reposToScan = isSingleRepoScan
      ? repos.filter((repo) => !repo.archived)
      : rankReposForIssueDiscovery(repos, preferences).slice(0, maxRepos)
    const opportunities = await fetchContributionIssueBatches(
      token ?? undefined,
      reposToScan,
      preferences,
      maxIssuesPerRepo,
      minScore,
    )

    opportunities.sort(
      (a, b) =>
        b.score - a.score || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )

    return NextResponse.json({
      opportunities: opportunities.slice(0, 80),
      scannedRepos: reposToScan.length,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    Sentry.captureException(error)
    console.error("[contribution-opportunities] error:", error)
    return NextResponse.json(
      { error: "Failed to load contribution opportunities" },
      { status: 500 },
    )
  }
}
