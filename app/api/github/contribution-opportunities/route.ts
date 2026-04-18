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

const SCAN_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes between scans per user

interface RequestBody {
  repos?: StarredRepo[]
  preferences?: ContributionPreferences
  maxRepos?: number
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Per-user rate limit: max one contribution scan per 5 minutes
    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('last_contribution_scan_at')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.last_contribution_scan_at) {
      const msSinceLast = Date.now() - new Date(profile.last_contribution_scan_at).getTime()
      if (msSinceLast < SCAN_COOLDOWN_MS) {
        const retryAfter = Math.ceil((SCAN_COOLDOWN_MS - msSinceLast) / 1000)
        return NextResponse.json(
          { error: 'Please wait before scanning for contribution opportunities again.', retryAfterSeconds: retryAfter },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } },
        )
      }
    }

    // Record scan start time before the expensive GitHub API calls
    await adminSupabase
      .from('profiles')
      .update({ last_contribution_scan_at: new Date().toISOString() })
      .eq('id', user.id)

    const body = (await request.json()) as RequestBody
    const repos = body.repos ?? []

    if (!Array.isArray(repos) || repos.length === 0) {
      return NextResponse.json({ opportunities: [], scannedRepos: 0 })
    }

    const { token, error: tokenError } = await getValidGitHubToken(user.id)
    if (tokenError || !token) {
      return NextResponse.json(
        { error: tokenError === 'expired' ? 'GitHub token expired. Please sign in again.' : 'GitHub token not found.' },
        { status: 401 },
      )
    }

    const preferences = body.preferences ?? {}
    const maxRepos = Math.min(Math.max(body.maxRepos ?? 24, 5), 40)
    const reposToScan = rankReposForIssueDiscovery(repos, preferences).slice(0, maxRepos)
    const opportunities: ContributionOpportunity[] = []

    for (const repo of reposToScan) {
      const issues = await fetchRepoContributionIssues(token, repo, preferences)
      opportunities.push(...issues)
    }

    opportunities.sort((a, b) => b.score - a.score || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

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
