import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { after } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getValidGitHubToken } from '@/lib/tokens'
import { fetchRepoIntelData } from '@/lib/repo-intel'
import { analyzeRepoIntel } from '@/lib/ai-repo-intel'
import { langfuseSpanProcessor } from '@/instrumentation'
import { getAIModel, getProviderOptions, type AIModelConfig } from '@/lib/ai-provider'
import { checkAndIncrementWeeklyLimit, type WeeklyLimitResult } from '@/lib/ai-weekly-limit'
import type { RepoIntel } from '@/lib/types'

export const maxDuration = 60

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const owner = searchParams.get('owner')
    const repo = searchParams.get('repo')
    const refresh = searchParams.get('refresh') === 'true'

    if (!owner || !repo) {
      return NextResponse.json({ error: 'Missing owner or repo' }, { status: 400 })
    }

    const repoFullName = `${owner}/${repo}`

    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Check global cache
    const { data: cached } = await adminClient
      .from('repo_insights')
      .select('*')
      .eq('repo_full_name', repoFullName)
      .single()

    // Return fresh cached data without hitting rate limit
    if (cached && !refresh) {
      const age = Date.now() - new Date(cached.analyzed_at).getTime()
      if (age < CACHE_TTL_MS) {
        return NextResponse.json({ intel: rowToIntel(cached as RepoInsightRow), cached: true })
      }
    }

    // Get GitHub token
    const { token, error: tokenError } = await getValidGitHubToken()
    if (tokenError || !token) {
      return NextResponse.json(
        { error: tokenError === 'expired' ? 'GitHub token expired. Please sign out and sign in again.' : 'GitHub token not found.' },
        { status: 401 }
      )
    }

    // Get AI model config
    let modelConfig: AIModelConfig
    try {
      modelConfig = getAIModel(request)
    } catch {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })
    }

    // Enforce per-user weekly limit only when using server key
    let limitResult: WeeklyLimitResult | undefined
    if (!modelConfig.isUserKey) {
      limitResult = await checkAndIncrementWeeklyLimit(user.id, 'intel')
      if (!limitResult.allowed) {
        if (cached) {
          return NextResponse.json({
            intel: rowToIntel(cached as RepoInsightRow),
            cached: true,
            limitReached: true,
            nextAllowedAt: limitResult.nextAllowedAt,
          })
        }
        return NextResponse.json(
          { error: 'Weekly AI limit reached. Try again next week.', remaining: 0, nextAllowedAt: limitResult.nextAllowedAt },
          { status: 429 }
        )
      }
    }

    // Fetch GitHub data
    const rawData = await fetchRepoIntelData(owner, repo, token)

    // AI synthesis
    const analysis = await analyzeRepoIntel(
      repoFullName,
      rawData.metrics,
      rawData.issueSamples,
      rawData.contributorCount,
      modelConfig.model,
      getProviderOptions(modelConfig.provider),
    )

    // Upsert to global cache
    const { data: upserted, error: upsertError } = await adminClient
      .from('repo_insights')
      .upsert(
        {
          repo_full_name: repoFullName,
          analyzed_at: new Date().toISOString(),
          health_score: analysis.healthScore,
          maintenance_verdict: analysis.maintenanceVerdict,
          community_sentiment: analysis.communitySentiment,
          adoption_readiness: analysis.adoptionReadiness,
          top_pain_points: analysis.topPainPoints,
          summary: analysis.summary,
          recommendation: analysis.recommendation,
          metrics: analysis.metrics,
        },
        { onConflict: 'repo_full_name' }
      )
      .select()
      .single()

    if (upsertError || !upserted) {
      // Return the analysis even if caching failed
      Sentry.captureException(upsertError)
      const intel: RepoIntel = {
        id: crypto.randomUUID(),
        repoFullName,
        analyzedAt: new Date().toISOString(),
        ...analysis,
      }
      return NextResponse.json({ intel, cached: false, remaining: limitResult?.remaining ?? null })
    }

    after(async () => {
      await langfuseSpanProcessor?.forceFlush()
    })

    return NextResponse.json({ intel: rowToIntel(upserted as RepoInsightRow), cached: false, remaining: limitResult?.remaining ?? null })
  } catch (err) {
    Sentry.captureException(err)
    console.error('[repo-intel] error:', err)
    return NextResponse.json(
      { error: 'Failed to analyze repository. Please try again.' },
      { status: 500 }
    )
  }
}
