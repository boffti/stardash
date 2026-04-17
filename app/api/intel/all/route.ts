import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import type { RepoIntel } from '@/lib/types'

interface RepoInsightRow {
  id: string
  repo_full_name: string
  analyzed_at: string
  health_score: number
  maintenance_verdict: string
  community_sentiment: string
  adoption_readiness: string
  top_pain_points: string[]
  summary: string
  recommendation: string
  metrics: RepoIntel['metrics']
}

function rowToIntel(row: RepoInsightRow): RepoIntel {
  return {
    id: row.id,
    repoFullName: row.repo_full_name,
    analyzedAt: row.analyzed_at,
    healthScore: row.health_score,
    maintenanceVerdict: row.maintenance_verdict as RepoIntel['maintenanceVerdict'],
    communitySentiment: row.community_sentiment as RepoIntel['communitySentiment'],
    adoptionReadiness: row.adoption_readiness as RepoIntel['adoptionReadiness'],
    topPainPoints: row.top_pain_points ?? [],
    summary: row.summary,
    recommendation: row.recommendation,
    metrics: row.metrics,
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all repo full_names starred by this user
    const { data: starredRepos, error: starredError } = await supabase
      .from('user_starred_repos')
      .select('repos(full_name)')
      .eq('user_id', user.id)

    if (starredError) {
      Sentry.captureException(starredError)
      return NextResponse.json({ error: 'Failed to fetch starred repos' }, { status: 500 })
    }

    const fullNames: string[] = (starredRepos ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => r.repos?.full_name)
      .filter(Boolean)

    if (fullNames.length === 0) {
      return NextResponse.json({ intel: [] })
    }

    // Fetch insights for repos the user has starred
    const adminClient = createAdminClient()
    const { data: insights, error: insightsError } = await adminClient
      .from('repo_insights')
      .select('*')
      .in('repo_full_name', fullNames)
      .order('health_score', { ascending: false })

    if (insightsError) {
      Sentry.captureException(insightsError)
      return NextResponse.json({ error: 'Failed to fetch intel' }, { status: 500 })
    }

    return NextResponse.json({ intel: (insights ?? []).map(row => rowToIntel(row as RepoInsightRow)) })
  } catch (err) {
    Sentry.captureException(err)
    console.error('[intel/all] error:', err)
    return NextResponse.json({ error: 'Failed to fetch intel' }, { status: 500 })
  }
}
