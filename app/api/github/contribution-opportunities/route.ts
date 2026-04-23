import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidGitHubToken } from '@/lib/tokens'
import {
  fetchRepoContributionIssues,
  rankReposForIssueDiscovery,
  type ContributionOpportunity,
  type ContributionPreferences,
} from '@/lib/contribution-opportunities'
import type { StarredRepo } from '@/lib/types'

export const maxDuration = 60

const SCAN_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes between broad scans per user
const SINGLE_REPO_SCAN_DAY_LIMIT = 20    // max single-repo scans per user per day
const DAY_MS = 24 * 60 * 60 * 1000
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
      batch.map((repo) => fetchRepoContributionIssues(token, repo, preferences, { maxIssues: maxIssuesPerRepo, minScore })),
    )
    opportunities.push(...batchResults.flat())
  }

  return opportunities
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as RequestBody
    const repos = body.repos ?? []

    if (!Array.isArray(repos) || repos.length === 0) {
      return NextResponse.json({ opportunities: [], scannedRepos: 0 })
    }

    const isSingleRepoScan = repos.length === 1

    const { token, error: tokenError } = await getValidGitHubToken()
    if (tokenError === 'expired') {
      return NextResponse.json(
        { error: 'GitHub token expired. Please sign in again.' },
        { status: 401 },
      )
    }

    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('last_contribution_scan_at, single_repo_scan_day_start, single_repo_scan_day_count')
      .eq('id', user.id)
      .maybeSingle()

    const now = Date.now()

    if (isSingleRepoScan) {
      // ── Daily cap for single-repo scans (20 per user per day) ─────────────
      const dayStart = profile?.single_repo_scan_day_start
        ? new Date(profile.single_repo_scan_day_start).getTime()
        : null
      const isNewDay = !dayStart || now - dayStart >= DAY_MS
      const dayCount = isNewDay ? 0 : (profile?.single_repo_scan_day_count ?? 0)

      if (dayCount >= SINGLE_REPO_SCAN_DAY_LIMIT) {
        const nextAllowedAt = new Date(dayStart! + DAY_MS).toISOString()
        const retryAfter = Math.ceil((dayStart! + DAY_MS - now) / 1000)
        return NextResponse.json(
          {
            error: 'Daily single-repo scan limit reached. Try again tomorrow.',
            nextAllowedAt,
            retryAfterSeconds: retryAfter,
          },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } },
        )
      }

      // Increment single-repo scan counter
      await adminSupabase
        .from('profiles')
        .update({
          single_repo_scan_day_start: isNewDay ? new Date(now).toISOString() : profile!.single_repo_scan_day_start,
          single_repo_scan_day_count: dayCount + 1,
        })
        .eq('id', user.id)
    } else {
      // ── 5-minute cooldown for broad (multi-repo) scans ────────────────────
      if (profile?.last_contribution_scan_at) {
        const msSinceLast = now - new Date(profile.last_contribution_scan_at).getTime()
        if (msSinceLast < SCAN_COOLDOWN_MS) {
          const retryAfter = Math.ceil((SCAN_COOLDOWN_MS - msSinceLast) / 1000)
          return NextResponse.json(
            {
              error: 'Please wait before scanning for contribution opportunities again.',
              retryAfterSeconds: retryAfter,
            },
            { status: 429, headers: { 'Retry-After': String(retryAfter) } },
          )
        }
      }

      // Record broad scan start time before expensive multi-repo GitHub API calls.
      await adminSupabase
        .from('profiles')
        .update({ last_contribution_scan_at: new Date(now).toISOString() })
        .eq('id', user.id)
    }

    const preferences = body.preferences ?? {}
    const maxRepos = Math.min(Math.max(body.maxRepos ?? 24, 5), 40)
    const maxIssuesPerRepo = Math.min(Math.max(body.maxIssuesPerRepo ?? 100, 20), 500)
    const minScore = Math.min(Math.max(body.minScore ?? (isSingleRepoScan ? 0 : 28), 0), 100)
    const reposToScan = isSingleRepoScan
      ? repos.filter((repo) => !repo.archived)
      : rankReposForIssueDiscovery(repos, preferences).slice(0, maxRepos)
    const opportunities = await fetchContributionIssueBatches(token ?? undefined, reposToScan, preferences, maxIssuesPerRepo, minScore)

    opportunities.sort(
      (a, b) => b.score - a.score || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )

    return NextResponse.json({
      opportunities: opportunities.slice(0, 80),
      scannedRepos: reposToScan.length,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    Sentry.captureException(error)
    console.error('[contribution-opportunities] error:', error)
    return NextResponse.json({ error: 'Failed to load contribution opportunities' }, { status: 500 })
  }
}
