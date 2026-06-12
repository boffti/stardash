import type { RepoIntel, RepoIntelMetrics } from "./types"

/**
 * Fallback metrics for placeholder rows whose `metrics` column is still null.
 * Consumers (`intel.metrics.hasCommunityFiles`, `computeSubScores`) assume a
 * non-null object, so we default to a zeroed shape rather than risk a runtime
 * crash on a partially-analyzed row.
 */
const EMPTY_METRICS: RepoIntelMetrics = {
  issueCloseRate: 0,
  avgIssueResponseDays: null,
  staleIssueCount: 0,
  prMergeRate: 0,
  avgPrMergeDays: null,
  activeContributors90d: 0,
  daysSinceLastCommit: null,
  daysSinceLastRelease: null,
  hasCommunityFiles: {
    contributingGuide: false,
    codeOfConduct: false,
    ci: false,
  },
}

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
  metrics: RepoIntel["metrics"] | null
}

export function rowToIntel(row: RepoInsightRow): RepoIntel {
  return {
    id: row.id,
    repoFullName: row.repo_full_name,
    analyzedAt: row.analyzed_at,
    healthScore: row.health_score ?? 0,
    maintenanceVerdict: (row.maintenance_verdict ?? "unknown") as RepoIntel["maintenanceVerdict"],
    communitySentiment: (row.community_sentiment ?? "unknown") as RepoIntel["communitySentiment"],
    adoptionReadiness: (row.adoption_readiness ?? "unknown") as RepoIntel["adoptionReadiness"],
    topPainPoints: row.top_pain_points ?? [],
    summary: row.summary ?? "",
    recommendation: row.recommendation ?? "",
    metrics: row.metrics ?? EMPTY_METRICS,
  }
}
