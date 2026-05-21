import type { RepoIntel } from './types'

/**
 * Canonical shape of a row from the `repo_insights` Supabase table.
 * Used by both the single-repo and bulk intel API routes so the two stay in
 * sync automatically.
 */
export interface RepoInsightRow {
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

export function rowToIntel(row: RepoInsightRow): RepoIntel {
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
