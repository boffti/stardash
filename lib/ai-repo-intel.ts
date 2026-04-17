import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateObject } from 'ai'
import { z } from 'zod'
import type {
  RepoIntel,
  RepoIntelMetrics,
  MaintenanceVerdict,
  CommunitySentiment,
  AdoptionReadiness,
} from './types'
import type { IssueSample } from './repo-intel'

const MODEL = 'google/gemini-2.0-flash-001'

const RepoIntelSchema = z.object({
  healthScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('Overall health score 0–100. 70+ = healthy, 40–69 = moderate, <40 = concerning'),
  maintenanceVerdict: z
    .enum(['actively-maintained', 'lightly-maintained', 'stale', 'abandoned'])
    .describe(
      'actively-maintained: regular commits + fast issue responses. ' +
      'lightly-maintained: periodic activity. ' +
      'stale: little activity in 6+ months. ' +
      'abandoned: no meaningful activity in 12+ months'
    ),
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
): string {
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const days = (v: number | null) => v === null ? 'unknown' : `${v} days`

  const issueList = issueSamples.length > 0
    ? issueSamples.map((i, idx) => `  ${idx + 1}. "${i.title}" (${i.agedays}d old, ${i.comments} comments)`).join('\n')
    : '  (no open issues)'

  return `Repository: ${repoFullName}

HEALTH METRICS
- Issue close rate: ${pct(metrics.issueCloseRate)}
- Avg issue response/close time: ${days(metrics.avgIssueResponseDays)}
- Stale open issues (no activity > 90 days): ${metrics.staleIssueCount}
- PR merge rate: ${pct(metrics.prMergeRate)}
- Avg PR merge time: ${days(metrics.avgPrMergeDays)}
- Active contributors (top 25 fetched): ${metrics.activeContributors90d}
- Days since last commit: ${days(metrics.daysSinceLastCommit)}
- Days since last release: ${days(metrics.daysSinceLastRelease)}

COMMUNITY FILES
- Contributing guide: ${metrics.hasCommunityFiles.contributingGuide ? 'yes' : 'no'}
- Code of conduct: ${metrics.hasCommunityFiles.codeOfConduct ? 'yes' : 'no'}
- CI/CD workflows: ${metrics.hasCommunityFiles.ci ? 'yes' : 'no'}

RECENT OPEN ISSUES (sample for pain point analysis)
${issueList}`
}

export async function analyzeRepoIntel(
  repoFullName: string,
  metrics: RepoIntelMetrics,
  issueSamples: IssueSample[],
  contributorCount: number,
  apiKey: string,
): Promise<Omit<RepoIntel, 'id' | 'repoFullName' | 'analyzedAt'>> {
  const openrouter = createOpenRouter({ apiKey })

  const prompt = formatMetricsForPrompt(repoFullName, metrics, issueSamples, contributorCount)

  const { object } = await generateObject({
    model: openrouter(MODEL),
    schema: RepoIntelSchema,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'repo-intel-analysis',
      metadata: { repoFullName },
    },
    system: `You are an expert open-source project analyst. Given structured health metrics and a sample of open issues for a GitHub repository, produce a concise, data-driven analysis. Be honest — if a project looks abandoned or unhealthy, say so clearly. Avoid generic statements.`,
    prompt,
  })

  return {
    healthScore: object.healthScore,
    maintenanceVerdict: object.maintenanceVerdict as MaintenanceVerdict,
    communitySentiment: object.communitySentiment as CommunitySentiment,
    adoptionReadiness: object.adoptionReadiness as AdoptionReadiness,
    topPainPoints: object.topPainPoints,
    summary: object.summary,
    recommendation: object.recommendation,
    metrics,
  }
}
