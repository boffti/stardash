import { generateObject } from "ai"
import type { LanguageModel } from "ai"
import { z } from "zod"
import type {
  RepoIntel,
  RepoIntelMetrics,
  MaintenanceVerdict,
  CommunitySentiment,
  AdoptionReadiness,
  RepoMaintenanceAssessment,
} from "./types"
import type { IssueSample } from "./repo-intel"
import { db, fromJson, nowIso, toJson } from "./db"
import type { RepoInsightRow } from "./repo-insight-row"

export const RepoIntelSchema = z.object({
  healthScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Overall health score 0–100. 70+ = healthy, 40–69 = moderate, <40 = concerning"),
  communitySentiment: z
    .enum(["positive", "mixed", "frustrated"])
    .describe(
      "positive: issues are feature requests and constructive discussion. " +
        "mixed: mix of helpful and frustrated tones. " +
        "frustrated: many bug reports, complaints, or unanswered issues",
    ),
  adoptionReadiness: z
    .enum(["production-ready", "maturing", "experimental", "deprecated"])
    .describe(
      "production-ready: stable API, active maintenance, community trust. " +
        "maturing: actively developed but may have breaking changes. " +
        "experimental: early stage or unstable. " +
        "deprecated: project is winding down",
    ),
  topPainPoints: z
    .array(z.string().transform((s) => s.slice(0, 160)))
    .describe(
      "Up to 3 short pain points inferred from open issue titles. " +
        "Each should be a plain-English sentence under 120 characters. " +
        "Return fewer if the issues look healthy.",
    ),
  summary: z
    .string()
    .transform((s) => s.slice(0, 600))
    .describe(
      "2–3 sentence prose summary of the repo's health and community. " +
        "Be specific and data-driven, not generic.",
    ),
  recommendation: z
    .string()
    .transform((s) => s.slice(0, 300))
    .describe(
      '1 actionable sentence starting with "Worth adopting if…", "Best suited for…", or "Avoid if…". ' +
        "Speak directly to someone evaluating whether to use this project.",
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
  const days = (v: number | null) => (v === null ? "unknown" : `${v} days`)

  const issueList =
    issueSamples.length > 0
      ? issueSamples
          .map((i, idx) => `  ${idx + 1}. "${i.title}" (${i.agedays}d old, ${i.comments} comments)`)
          .join("\n")
      : "  (no open issues)"

  return `Repository: ${repoFullName}

HEALTH METRICS
- Issue close rate: ${pct(metrics.issueCloseRate)}
- Median issue close time: ${days(metrics.medianIssueCloseDays ?? metrics.avgIssueResponseDays)}
- Stale open issues (no activity > 90 days): ${metrics.staleIssueCount}
- PR merge rate: ${pct(metrics.prMergeRate)}
- Avg PR merge time: ${days(metrics.avgPrMergeDays)}
- Stale open PRs (no activity > 90 days): ${metrics.stalePrCount ?? "unknown"}
- Top contributors fetched: ${metrics.topContributorCount ?? metrics.activeContributors90d}
- Contributor count from GitHub sample: ${contributorCount}
- Top contributor share: ${metrics.topContributorShare == null ? "unknown" : pct(metrics.topContributorShare)}
- Top 3 contributor share: ${metrics.topThreeContributorShare == null ? "unknown" : pct(metrics.topThreeContributorShare)}
- Commits in last 30 days: ${metrics.commits30d ?? "unknown"}
- Commits in last 90 days: ${metrics.commits90d ?? "unknown"}
- Commit authors in last 90 days: ${metrics.activeCommitAuthors90d ?? "unknown"}
- Days since last commit: ${days(metrics.daysSinceLastCommit)}
- Days since last release: ${days(metrics.daysSinceLastRelease)}
- Stable releases in last 6 months: ${metrics.releases6mo ?? "unknown"}
- Stable releases in last 12 months: ${metrics.releases12mo ?? "unknown"}
- Median release cadence: ${days(metrics.releaseCadenceDays ?? null)}

DETERMINISTIC MAINTENANCE ASSESSMENT
- Verdict: ${maintenanceAssessment.verdict}
- Confidence: ${Math.round(maintenanceAssessment.confidence * 100)}%
- Score: ${maintenanceAssessment.score}/100
- Signals: commit recency ${maintenanceAssessment.signals.commitRecency}, commit velocity ${maintenanceAssessment.signals.commitVelocity}, issue responsiveness ${maintenanceAssessment.signals.issueResponsiveness}, PR activity ${maintenanceAssessment.signals.prActivity}, release recency ${maintenanceAssessment.signals.releaseRecency}
- Reasons:
${maintenanceAssessment.reasons.map((reason) => `  - ${reason}`).join("\n")}

COMMUNITY FILES
- README: ${metrics.hasCommunityFiles.readme ? "yes" : "no"}
- License: ${metrics.hasCommunityFiles.license ? "yes" : "no"}
- Contributing guide: ${metrics.hasCommunityFiles.contributingGuide ? "yes" : "no"}
- Code of conduct: ${metrics.hasCommunityFiles.codeOfConduct ? "yes" : "no"}
- Security policy: ${metrics.hasCommunityFiles.securityPolicy ? "yes" : "no"}
- Issue templates: ${metrics.hasCommunityFiles.issueTemplate ? "yes" : "no"}
- PR template: ${metrics.hasCommunityFiles.pullRequestTemplate ? "yes" : "no"}
- CI/CD workflows: ${metrics.hasCommunityFiles.ci ? "yes" : "no"}

RECENT OPEN ISSUES (sample for pain point analysis)
${issueList}`
}

export const INTEL_SYSTEM = `You are an expert open-source project analyst. Given structured health metrics, a deterministic maintenance assessment, and a sample of open issues for a GitHub repository, produce a concise, data-driven analysis. Use the deterministic maintenance verdict as fixed input; do not override it. Be honest — if a project looks abandoned or unhealthy, say so clearly. Avoid generic statements.`

/** Everything needed to run the analysis, in-app or by the user's agent. */
export interface IntelInput {
  repoFullName: string
  metrics: RepoIntelMetrics
  issueSamples: IssueSample[]
  contributorCount: number
}

function assessmentOf(metrics: RepoIntelMetrics): RepoMaintenanceAssessment {
  return (
    metrics.maintenanceAssessment ?? {
      verdict: "lightly-maintained" as MaintenanceVerdict,
      confidence: 0.35,
      score: 45,
      reasons: ["Maintenance assessment was unavailable for this cached record."],
      signals: {
        commitRecency: "unknown" as const,
        commitVelocity: "unknown" as const,
        issueResponsiveness: "unknown" as const,
        prActivity: "unknown" as const,
        releaseRecency: "unknown" as const,
      },
    }
  )
}

export const buildIntelPrompt = (input: IntelInput) =>
  formatMetricsForPrompt(
    input.repoFullName,
    input.metrics,
    input.issueSamples,
    input.contributorCount,
    assessmentOf(input.metrics),
  )

/** Turns the model's (or agent's) object into stored intel. */
export function finishIntel(
  input: IntelInput,
  object: z.output<typeof RepoIntelSchema>,
): Omit<RepoIntel, "id" | "repoFullName" | "analyzedAt"> {
  const maintenanceAssessment = assessmentOf(input.metrics)
  // Anchor the AI's health score to the deterministic maintenance score so the
  // two signals can't diverge. The blend weights the deterministic score at 60%
  // and the AI's qualitative read at 40%, then clamps to 0–100.
  const anchoredHealthScore = Math.max(
    0,
    Math.min(100, Math.round(object.healthScore * 0.4 + maintenanceAssessment.score * 0.6)),
  )

  return {
    healthScore: anchoredHealthScore,
    maintenanceVerdict: maintenanceAssessment.verdict,
    communitySentiment: object.communitySentiment as CommunitySentiment,
    adoptionReadiness: object.adoptionReadiness as AdoptionReadiness,
    topPainPoints: object.topPainPoints.slice(0, 3),
    summary: object.summary,
    recommendation: object.recommendation,
    metrics: input.metrics,
  }
}

export async function analyzeRepoIntel(
  input: IntelInput,
  model: LanguageModel,
  providerOptions: Record<string, Record<string, string>> = {},
) {
  const { object } = await generateObject({
    model,
    schema: RepoIntelSchema,
    providerOptions,
    experimental_telemetry: { isEnabled: true, functionId: "repo-intel-analysis" },
    system: INTEL_SYSTEM,
    prompt: buildIntelPrompt(input),
  })
  return finishIntel(input, object)
}

type StoredInsightRow = Omit<RepoInsightRow, "top_pain_points" | "metrics"> & {
  top_pain_points: string | null
  metrics: string | null
}

export function parseInsightRow(row: StoredInsightRow): RepoInsightRow {
  return {
    ...row,
    top_pain_points: fromJson<string[] | null>(row.top_pain_points, null),
    metrics: fromJson<RepoIntel["metrics"] | null>(row.metrics, null),
  }
}

export function getCachedInsight(repoFullName: string): RepoInsightRow | undefined {
  const row = db
    .prepare("select * from repo_insights where repo_full_name = ?")
    .get(repoFullName) as StoredInsightRow | undefined
  return row ? parseInsightRow(row) : undefined
}

export function saveRepoInsight(
  repoFullName: string,
  analysis: Omit<RepoIntel, "id" | "repoFullName" | "analyzedAt">,
): RepoInsightRow | undefined {
  const row = db
    .prepare(
      `insert into repo_insights (repo_full_name, analyzed_at, health_score, maintenance_verdict,
         community_sentiment, adoption_readiness, top_pain_points, summary, recommendation, metrics)
       values (@repo_full_name, @analyzed_at, @health_score, @maintenance_verdict,
         @community_sentiment, @adoption_readiness, @top_pain_points, @summary, @recommendation, @metrics)
       on conflict (repo_full_name) do update set
         analyzed_at = excluded.analyzed_at, health_score = excluded.health_score,
         maintenance_verdict = excluded.maintenance_verdict, community_sentiment = excluded.community_sentiment,
         adoption_readiness = excluded.adoption_readiness, top_pain_points = excluded.top_pain_points,
         summary = excluded.summary, recommendation = excluded.recommendation, metrics = excluded.metrics
       returning *`,
    )
    .get({
      repo_full_name: repoFullName,
      analyzed_at: nowIso(),
      health_score: analysis.healthScore,
      maintenance_verdict: analysis.maintenanceVerdict,
      community_sentiment: analysis.communitySentiment,
      adoption_readiness: analysis.adoptionReadiness,
      top_pain_points: toJson(analysis.topPainPoints),
      summary: analysis.summary,
      recommendation: analysis.recommendation,
      metrics: toJson(analysis.metrics),
    }) as StoredInsightRow | undefined
  return row ? parseInsightRow(row) : undefined
}
