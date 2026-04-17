import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { getValidGitHubToken } from '@/lib/tokens'
import {
  fetchRepoContributionIssues,
  rankReposForIssueDiscovery,
  type ContributionOpportunity,
  type ContributionPreferences,
} from '@/lib/contribution-opportunities'
import type { StarredRepo } from '@/lib/types'

export const maxDuration = 60

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
