import type { RepoIntelMetrics, IntelSubScores } from './types'

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function commitVelocityPoints(commits90d: number | undefined, commits30d: number | undefined): number {
  const c90 = commits90d ?? 0
  const c30 = commits30d ?? 0
  if (c90 >= 30 || c30 >= 10) return 40
  if (c90 >= 10 || c30 >= 3) return 28
  if (c90 >= 3) return 15
  if (c90 >= 1) return 7
  return 0
}

function contributorPoints(authors90d: number | undefined): number {
  const n = authors90d ?? 0
  if (n >= 5) return 30
  if (n >= 3) return 22
  if (n >= 2) return 13
  if (n >= 1) return 6
  return 0
}

function busFactorTrustPoints(authors90d: number | undefined): number {
  const n = authors90d ?? 0
  if (n >= 4) return 50
  if (n >= 3) return 38
  if (n >= 2) return 24
  if (n >= 1) return 10
  return 0
}

export function computeSubScores(metrics: RepoIntelMetrics): IntelSubScores {
  // ── Maintenance ──────────────────────────────────────────────────────────
  const maintenance = clamp(metrics.maintenanceAssessment?.score ?? 0)

  // ── Activity ─────────────────────────────────────────────────────────────
  const issuePoints = clamp(metrics.issueCloseRate * 30)
  const prPoints = clamp(metrics.prMergeRate * 30)
  const commitPoints = commitVelocityPoints(metrics.commits90d, metrics.commits30d)
  const activity = clamp(issuePoints + prPoints + commitPoints)

  // ── Community ────────────────────────────────────────────────────────────
  const cf = metrics.hasCommunityFiles
  const filePoints =
    (cf.contributingGuide ? 22 : 0) +
    (cf.codeOfConduct ? 18 : 0) +
    (cf.ci ? 10 : 0)
  const contribPoints = contributorPoints(
    metrics.activeCommitAuthors90d ?? metrics.activeContributors90d
  )
  const stalePoints =
    metrics.staleIssueCount === 0 ? 20
    : metrics.staleIssueCount <= 5 ? 12
    : metrics.staleIssueCount <= 15 ? 6
    : 0
  const community = clamp(filePoints + contribPoints + stalePoints)

  // ── Trust (inverse risk) ─────────────────────────────────────────────────
  const busTrust = busFactorTrustPoints(
    metrics.activeCommitAuthors90d ?? metrics.activeContributors90d
  )
  const govTrust =
    (cf.contributingGuide ? 20 : 0) +
    (cf.codeOfConduct ? 15 : 0) +
    (cf.ci ? 15 : 0)
  const trust = clamp(busTrust + govTrust)

  return { maintenance, activity, community, trust }
}
