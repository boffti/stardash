import { generateObject } from 'ai'
import type { LanguageModel } from 'ai'
import { z } from 'zod'
import type {
  RepoIntel,
  RepoIntelMetrics,
  MaintenanceVerdict,
  CommunitySentiment,
  AdoptionReadiness,
  RepoMaintenanceAssessment,
} from './types'
import type { IssueSample } from './repo-intel'

const RepoIntelSchema = z.object({
  healthScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('Overall health score 0–100. 70+ = healthy, 40–69 = moderate, <40 = concerning'),
  communitySentiment: z
    .enum(['positive', 'mixed', 'frustrated'])
    .describe(
      'positive: issues are feature requests and constructive discussion. ' +
      'mixed: mix of helpful and frustrated tones. ' +
      'frustrated: many bug reports, complaints, or unanswered issues'
    ),
  adoptionReadiness: z
    .enum(['production-ready', 'maturing', 'experimental', 'deprecated'])
    .describe(
      'production-ready: stable API, active maintenance, community trust. ' +
      'maturing: actively developed but may have breaking changes. ' +
      'experimental: early stage or unstable. ' +
      'deprecated: project is winding down'
    ),
  topPainPoints: z
    .array(z.string().max(160).transform(s => s.slice(0, 160)))
    .max(3)
    .describe(
      'Up to 3 short pain points inferred from open issue titles. ' +
      'Each should be a plain-English sentence under 120 characters. ' +
      'Return fewer if the issues look healthy.'
    ),
  summary: z
    .string()
    .transform(s => s.slice(0, 600))
    .describe(
      '2–3 sentence prose summary of the repo\'s health and community. ' +
      'Be specific and data-driven, not generic.'
    ),
  recommendation: z
    .string()
    .transform(s => s.slice(0, 300))
    .describe(
      '1 actionable sentence starting with "Worth adopting if…", "Best suited for…", or "Avoid if…". ' +
      'Speak directly to someone evaluating whether to use this project.'
    ),
})

function formatMetricsForPrompt(
  repoFullName: string,
  metrics: RepoIntelMetrics,
  issueSamples: IssueSample[],
  contributorCount: number,
  maintenanceAssessment: RepoMaintenanceAssessment,
): string {
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const days = (v: number | null) => v === null ? 'unknown' : `${v} days`

  const issueList = issueSamples.length > 0
    ? issueSamples.map((i, idx) => `  ${idx + 1}. "${i.title}" (${i.agedays}d old, ${i.comments} comments)`).join('\n')
    : '  (no open issues)'

  return `Repository: ${repoFullName}

HEALTH METRICS
- Issue close rate: ${pct(metrics.issueCloseRate)}
- Median issue close time: ${days(metrics.medianIssueCloseDays ?? metrics.avgIssueResponseDays)}
- Stale open issues (no activity > 90 days): ${metrics.staleIssueCount}
- PR merge rate: ${pct(metrics.prMergeRate)}
- Avg PR merge time: ${days(metrics.avgPrMergeDays)}
- Stale open PRs (no activity > 90 days): ${metrics.stalePrCount ?? 'unknown'}
- Top contributors fetched: ${metrics.topContributorCount ?? metrics.activeContributors90d}
- Contributor count from GitHub sample: ${contributorCount}
- Top contributor share: ${metrics.topContributorShare == null ? 'unknown' : pct(metrics.topContributorShare)}
- Top 3 contributor share: ${metrics.topThreeContributorShare == null ? 'unknown' : pct(metrics.topThreeContributorShare)}
- Commits in last 30 days: ${metrics.commits30d ?? 'unknown'}
- Commits in last 90 days: ${metrics.commits90d ?? 'unknown'}
- Commit authors in last 90 days: ${metrics.activeCommitAuthors90d ?? 'unknown'}
- Days since last commit: ${days(metrics.daysSinceLastCommit)}
- Days since last release: ${days(metrics.daysSinceLastRelease)}
- Stable releases in last 6 months: ${metrics.releases6mo ?? 'unknown'}
- Stable releases in last 12 months: ${metrics.releases12mo ?? 'unknown'}
- Median release cadence: ${days(metrics.releaseCadenceDays ?? null)}

DETERMINISTIC MAINTENANCE ASSESSMENT
- Verdict: ${maintenanceAssessment.verdict}
- Confidence: ${Math.round(maintenanceAssessment.confidence * 100)}%
- Score: ${maintenanceAssessment.score}/100
- Signals: commit recency ${maintenanceAssessment.signals.commitRecency}, commit velocity ${maintenanceAssessment.signals.commitVelocity}, issue responsiveness ${maintenanceAssessment.signals.issueResponsiveness}, PR activity ${maintenanceAssessment.signals.prActivity}, release recency ${maintenanceAssessment.signals.releaseRecency}
- Reasons:
${maintenanceAssessment.reasons.map(reason => `  - ${reason}`).join('\n')}

COMMUNITY FILES
- README: ${metrics.hasCommunityFiles.readme ? 'yes' : 'no'}
- License: ${metrics.hasCommunityFiles.license ? 'yes' : 'no'}
- Contributing guide: ${metrics.hasCommunityFiles.contributingGuide ? 'yes' : 'no'}
- Code of conduct: ${metrics.hasCommunityFiles.codeOfConduct ? 'yes' : 'no'}
- Security policy: ${metrics.hasCommunityFiles.securityPolicy ? 'yes' : 'no'}
- Issue templates: ${metrics.hasCommunityFiles.issueTemplate ? 'yes' : 'no'}
- PR template: ${metrics.hasCommunityFiles.pullRequestTemplate ? 'yes' : 'no'}
- CI/CD workflows: ${metrics.hasCommunityFiles.ci ? 'yes' : 'no'}

RECENT OPEN ISSUES (sample for pain point analysis)
${issueList}`
}

export async function analyzeRepoIntel(
  repoFullName: string,
  metrics: RepoIntelMetrics,
  issueSamples: IssueSample[],
  contributorCount: number,
  model: LanguageModel,
  providerOptions: Record<string, Record<string, string>> = {},
): Promise<Omit<RepoIntel, 'id' | 'repoFullName' | 'analyzedAt'>> {
  const maintenanceAssessment = metrics.maintenanceAssessment ?? {
    verdict: 'lightly-maintained' as MaintenanceVerdict,
    confidence: 0.35,
    score: 45,
    reasons: ['Maintenance assessment was unavailable for this cached record.'],
    signals: {
      commitRecency: 'unknown' as const,
      commitVelocity: 'unknown' as const,
      issueResponsiveness: 'unknown' as const,
      prActivity: 'unknown' as const,
      releaseRecency: 'unknown' as const,
    },
  }

  const prompt = formatMetricsForPrompt(repoFullName, metrics, issueSamples, contributorCount, maintenanceAssessment)

  const { object } = await generateObject({
    model,
    schema: RepoIntelSchema,
    providerOptions,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'repo-intel-analysis',
      metadata: { repoFullName },
    },
    system: `You are an expert open-source project analyst. Given structured health metrics, a deterministic maintenance assessment, and a sample of open issues for a GitHub repository, produce a concise, data-driven analysis. Use the deterministic maintenance verdict as fixed input; do not override it. Be honest — if a project looks abandoned or unhealthy, say so clearly. Avoid generic statements.`,
    prompt,
  })

  return {
    healthScore: object.healthScore,
    maintenanceVerdict: maintenanceAssessment.verdict,
    communitySentiment: object.communitySentiment as CommunitySentiment,
    adoptionReadiness: object.adoptionReadiness as AdoptionReadiness,
    topPainPoints: object.topPainPoints,
    summary: object.summary,
    recommendation: object.recommendation,
    metrics,
  }
}
