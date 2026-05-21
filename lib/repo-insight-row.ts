import type { RepoIntel } from './types'

/**
 * Canonical shape of a row from the `repo_insights` Supabase table.
 * Nullable columns match the DB schema (all analysis columns are nullable
 * because a row can be inserted as a placeholder before analysis completes).
 */
export interface RepoInsightRow {
  id: string
  repo_full_name: string
  analyzed_at: string
  // All columns below are nullable per the DB schema
  health_score: number | null
  maintenance_verdict: string | null
  community_sentiment: string | null
  adoption_readiness: string | null
  top_pain_points: string[] | null
  summary: string | null
  recommendation: string | null
  metrics: RepoIntel['metrics'] | null
}

export function rowToIntel(row: RepoInsightRow): RepoIntel {
  return {
    id: row.id,
    repoFullName: row.repo_full_name,
    analyzedAt: row.analyzed_at,
    healthScore: row.health_score ?? 0,
    maintenanceVerdict: (row.maintenance_verdict ?? 'unknown') as RepoIntel['maintenanceVerdict'],
    communitySentiment: (row.community_sentiment ?? 'unknown') as RepoIntel['communitySentiment'],
    adoptionReadiness: (row.adoption_readiness ?? 'unknown') as RepoIntel['adoptionReadiness'],
    topPainPoints: row.top_pain_points ?? [],
    summary: row.summary ?? '',
    recommendation: row.recommendation ?? '',
    metrics: row.metrics ?? null,
  }
}
