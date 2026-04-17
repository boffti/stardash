import type {
  MaintenanceSignalStrength,
  MaintenanceVerdict,
  RepoIntelMetrics,
  RepoMaintenanceAssessment,
} from './types'

const GITHUB_API = 'https://api.github.com'
const HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
})

// ─── GitHub API shapes ────────────────────────────────────────────────────────

interface GHIssue {
  number: number
  title: string
  state: 'open' | 'closed'
  created_at: string
  closed_at: string | null
  updated_at: string
  pull_request?: unknown // present on PRs returned via issues endpoint
  comments: number
}

interface GHPR {
  number: number
  state: 'open' | 'closed'
  merged_at: string | null
  created_at: string
  closed_at: string | null
  review_comments: number
}

interface GHContributor {
  login: string
  contributions: number
}

interface GHCommunityProfile {
  files: {
    contributing: { url: string } | null
    code_of_conduct: { url: string } | null
  }
}

interface GHCommit {
  sha: string
  author: {
    login: string
  } | null
  commit: {
    author: {
      date: string
      email?: string | null
    }
  }
}

interface GHRelease {
  published_at: string
}

interface RecentCommitStats {
  latestCommitDate: string | null
  commits30d: number
  commits90d: number
  activeCommitAuthors90d: number
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function ghGet<T>(path: string, token: string, fallbackOn404?: T): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: HEADERS(token) })
  if (!res.ok) {
    if (res.status === 404 && fallbackOn404 !== undefined) return fallbackOn404
    throw new Error(`GitHub API ${res.status}: ${path}`)
  }
  return res.json() as Promise<T>
}

async function fetchIssues(owner: string, repo: string, token: string): Promise<GHIssue[]> {
  // Fetch last 100 closed + up to 100 open to get a representative sample
  const [open, closed] = await Promise.all([
    ghGet<GHIssue[]>(
      `/repos/${owner}/${repo}/issues?state=open&per_page=100&sort=updated&direction=desc`,
      token,
      []
    ),
    ghGet<GHIssue[]>(
      `/repos/${owner}/${repo}/issues?state=closed&per_page=100&sort=updated&direction=desc`,
      token,
      []
    ),
  ])
  // Filter out pull requests (GitHub issues endpoint returns PRs too)
  return [...open, ...closed].filter(i => !i.pull_request)
}

async function fetchPRs(owner: string, repo: string, token: string): Promise<GHPR[]> {
  const [open, closed] = await Promise.all([
    ghGet<GHPR[]>(
      `/repos/${owner}/${repo}/pulls?state=open&per_page=50&sort=updated&direction=desc`,
      token,
      []
    ),
    ghGet<GHPR[]>(
      `/repos/${owner}/${repo}/pulls?state=closed&per_page=50&sort=updated&direction=desc`,
      token,
      []
    ),
  ])
  return [...open, ...closed]
}

async function fetchContributors(owner: string, repo: string, token: string): Promise<GHContributor[]> {
  return ghGet<GHContributor[]>(
    `/repos/${owner}/${repo}/contributors?per_page=25&anon=false`,
    token,
    []
  )
}

async function fetchCommunityProfile(owner: string, repo: string, token: string): Promise<GHCommunityProfile | null> {
  try {
    return await ghGet<GHCommunityProfile>(
      `/repos/${owner}/${repo}/community/profile`,
      token
    )
  } catch {
    return null
  }
}

async function fetchRecentCommitStats(owner: string, repo: string, token: string): Promise<RecentCommitStats> {
  const empty = {
    latestCommitDate: null,
    commits30d: 0,
    commits90d: 0,
    activeCommitAuthors90d: 0,
  }

  try {
    const now = new Date()
    const since90d = new Date(now)
    since90d.setDate(since90d.getDate() - 90)
    const since30d = new Date(now)
    since30d.setDate(since30d.getDate() - 30)

    const commits: GHCommit[] = []
    for (let page = 1; page <= 3; page++) {
      const pageCommits = await ghGet<GHCommit[]>(
        `/repos/${owner}/${repo}/commits?since=${encodeURIComponent(since90d.toISOString())}&per_page=100&page=${page}`,
        token,
        []
      )
      commits.push(...pageCommits)
      if (pageCommits.length < 100) break
    }

    const authorIds = new Set<string>()
    let commits30d = 0

    for (const commit of commits) {
      const date = commit.commit?.author?.date
      if (date && new Date(date) >= since30d) commits30d += 1

      const authorId = commit.author?.login
        ?? commit.commit?.author?.email
        ?? commit.sha
      authorIds.add(authorId)
    }

    if (commits.length > 0) {
      return {
        latestCommitDate: commits[0]?.commit?.author?.date ?? null,
        commits30d,
        commits90d: commits.length,
        activeCommitAuthors90d: authorIds.size,
      }
    }

    const latest = await ghGet<GHCommit[]>(
      `/repos/${owner}/${repo}/commits?per_page=1`,
      token,
      []
    )

    return {
      ...empty,
      latestCommitDate: latest[0]?.commit?.author?.date ?? null,
    }
  } catch {
    return empty
  }
}

async function fetchLatestReleaseDate(owner: string, repo: string, token: string): Promise<string | null> {
  try {
    const release = await ghGet<GHRelease>(
      `/repos/${owner}/${repo}/releases/latest`,
      token
    )
    return release?.published_at ?? null
  } catch {
    return null
  }
}

async function fetchWorkflowCount(owner: string, repo: string, token: string): Promise<number> {
  try {
    const res = await ghGet<{ total_count: number }>(
      `/repos/${owner}/${repo}/actions/workflows?per_page=1`,
      token
    )
    return res.total_count ?? 0
  } catch {
    return 0
  }
}

// ─── Metric computation ────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function boundedScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

function signalFromScore(score: number, maxScore: number): MaintenanceSignalStrength {
  if (score >= maxScore * 0.75) return 'strong'
  if (score >= maxScore * 0.45) return 'ok'
  if (score > 0) return 'weak'
  return 'bad'
}

function optionalSignalFromScore(score: number, maxScore: number, hasSignal: boolean): MaintenanceSignalStrength {
  return hasSignal ? signalFromScore(score, maxScore) : 'unknown'
}

function verdictFromScore(score: number): MaintenanceVerdict {
  if (score >= 72) return 'actively-maintained'
  if (score >= 45) return 'lightly-maintained'
  if (score >= 20) return 'stale'
  return 'abandoned'
}

function formatReasonDays(days: number | null): string {
  if (days === null) return 'unknown'
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function computeMaintenanceAssessment(input: {
  daysSinceLastCommit: number | null
  daysSinceLastRelease: number | null
  medianIssueCloseDays: number | null
  staleIssueCount: number
  prMergeRate: number
  avgPrMergeDays: number | null
  commits30d: number
  commits90d: number
  activeCommitAuthors90d: number
  hasReleaseSignal: boolean
  hasIssueSignal: boolean
  hasPrSignal: boolean
}): RepoMaintenanceAssessment {
  let commitRecencyScore = 0
  if (input.daysSinceLastCommit === null) commitRecencyScore = 0
  else if (input.daysSinceLastCommit <= 14) commitRecencyScore = 28
  else if (input.daysSinceLastCommit <= 30) commitRecencyScore = 24
  else if (input.daysSinceLastCommit <= 90) commitRecencyScore = 18
  else if (input.daysSinceLastCommit <= 180) commitRecencyScore = 11
  else if (input.daysSinceLastCommit <= 365) commitRecencyScore = 5

  let commitVelocityScore = 0
  if (input.commits90d >= 30 || (input.commits30d >= 6 && input.activeCommitAuthors90d >= 2)) {
    commitVelocityScore = 24
  } else if (input.commits90d >= 10 || input.commits30d >= 3) {
    commitVelocityScore = 18
  } else if (input.commits90d >= 3) {
    commitVelocityScore = 11
  } else if (input.commits90d >= 1) {
    commitVelocityScore = 6
  }

  let issueScore = 0
  if (input.hasIssueSignal) {
    if ((input.medianIssueCloseDays !== null && input.medianIssueCloseDays <= 14 && input.staleIssueCount <= 3)
      || (input.staleIssueCount === 0 && input.medianIssueCloseDays !== null && input.medianIssueCloseDays <= 30)) {
      issueScore = 20
    } else if ((input.medianIssueCloseDays !== null && input.medianIssueCloseDays <= 45)
      || input.staleIssueCount <= 5) {
      issueScore = 14
    } else if ((input.medianIssueCloseDays !== null && input.medianIssueCloseDays <= 90)
      || input.staleIssueCount <= 15) {
      issueScore = 7
    }
  }

  let prScore = 0
  if (input.hasPrSignal) {
    if (input.prMergeRate >= 0.7 && (input.avgPrMergeDays === null || input.avgPrMergeDays <= 14)) {
      prScore = 18
    } else if (input.prMergeRate >= 0.45 && (input.avgPrMergeDays === null || input.avgPrMergeDays <= 45)) {
      prScore = 13
    } else if (input.prMergeRate >= 0.2) {
      prScore = 7
    }
  }

  let releaseScore = 0
  if (input.hasReleaseSignal) {
    if (input.daysSinceLastRelease !== null && input.daysSinceLastRelease <= 90) releaseScore = 10
    else if (input.daysSinceLastRelease !== null && input.daysSinceLastRelease <= 365) releaseScore = 7
    else if (input.daysSinceLastRelease !== null && input.daysSinceLastRelease <= 730) releaseScore = 3
  }

  const optionalSignals = [input.hasIssueSignal, input.hasPrSignal, input.hasReleaseSignal]
  const knownOptionalSignals = optionalSignals.filter(Boolean).length
  const unknownPenalty = (optionalSignals.length - knownOptionalSignals) * 3
  let score = boundedScore(commitRecencyScore + commitVelocityScore + issueScore + prScore + releaseScore - unknownPenalty)
  if (
    input.daysSinceLastCommit !== null
    && input.daysSinceLastCommit > 365
    && input.commits90d === 0
    && (!input.hasReleaseSignal || (input.daysSinceLastRelease !== null && input.daysSinceLastRelease > 365))
  ) {
    score = Math.min(score, 19)
  } else if (input.daysSinceLastCommit !== null && input.daysSinceLastCommit > 180 && input.commits90d === 0) {
    score = Math.min(score, 44)
  }
  const verdict = verdictFromScore(score)

  const reasons = [
    `Last commit was ${formatReasonDays(input.daysSinceLastCommit)}.`,
    `${input.commits90d} commits from ${input.activeCommitAuthors90d} author${input.activeCommitAuthors90d === 1 ? '' : 's'} in the last 90 days.`,
  ]

  if (input.hasIssueSignal) {
    reasons.push(
      input.medianIssueCloseDays === null
        ? `${input.staleIssueCount} stale open issue${input.staleIssueCount === 1 ? '' : 's'} in the sampled issue set.`
        : `Median issue close time is ${Math.round(input.medianIssueCloseDays)} days with ${input.staleIssueCount} stale open issue${input.staleIssueCount === 1 ? '' : 's'}.`
    )
  } else {
    reasons.push('Issue activity is too sparse to score responsiveness.')
  }

  if (input.hasPrSignal) {
    reasons.push(`PR merge rate is ${Math.round(input.prMergeRate * 100)}%${input.avgPrMergeDays !== null ? ` with a ${Math.round(input.avgPrMergeDays)} day median merge time` : ''}.`)
  } else {
    reasons.push('PR activity is too sparse to score review throughput.')
  }

  if (input.hasReleaseSignal) {
    reasons.push(`Latest GitHub release was ${formatReasonDays(input.daysSinceLastRelease)}.`)
  }

  const confidence = Math.max(0.35, Math.min(0.95, 0.5 + knownOptionalSignals * 0.12 + (input.commits90d > 0 ? 0.09 : 0)))

  return {
    verdict,
    confidence: Number(confidence.toFixed(2)),
    score,
    reasons,
    signals: {
      commitRecency: signalFromScore(commitRecencyScore, 28),
      commitVelocity: signalFromScore(commitVelocityScore, 24),
      issueResponsiveness: optionalSignalFromScore(issueScore, 20, input.hasIssueSignal),
      prActivity: optionalSignalFromScore(prScore, 18, input.hasPrSignal),
      releaseRecency: optionalSignalFromScore(releaseScore, 10, input.hasReleaseSignal),
    },
  }
}

function computeMetrics(
  issues: GHIssue[],
  prs: GHPR[],
  contributors: GHContributor[],
  community: GHCommunityProfile | null,
  commitStats: RecentCommitStats,
  latestReleaseDate: string | null,
  workflowCount: number,
): RepoIntelMetrics {
  const now = new Date().toISOString()

  // Issue close rate
  const totalIssues = issues.length
  const closedIssues = issues.filter(i => i.state === 'closed').length
  const issueCloseRate = totalIssues > 0 ? closedIssues / totalIssues : 0

  // Stale issues: open with no update in 90 days
  const staleIssueCount = issues.filter(i => {
    if (i.state !== 'open') return false
    return daysBetween(i.updated_at, now) > 90
  }).length

  // Median issue close time: days from created_at to closed_at for closed issues
  const issueResponseTimes = issues
    .filter(i => i.state === 'closed' && i.closed_at)
    .map(i => daysBetween(i.created_at, i.closed_at!))
  const medianIssueCloseDays = median(issueResponseTimes)
  const avgIssueResponseDays = medianIssueCloseDays

  // PR merge rate
  const closedPRs = prs.filter(p => p.state === 'closed')
  const mergedPRs = prs.filter(p => p.merged_at !== null)
  const prMergeRate = closedPRs.length > 0 ? mergedPRs.length / closedPRs.length : 0

  // Avg PR merge time
  const prMergeTimes = mergedPRs
    .filter(p => p.closed_at)
    .map(p => daysBetween(p.created_at, p.merged_at!))
  const avgPrMergeDays = median(prMergeTimes)

  // Keep legacy field populated while exposing true recent commit authors separately.
  const topContributorCount = Math.min(contributors.length, 25)
  const activeContributors90d = topContributorCount

  // Days since last commit/release
  const daysSinceLastCommit = commitStats.latestCommitDate ? Math.floor(daysBetween(commitStats.latestCommitDate, now)) : null
  const daysSinceLastRelease = latestReleaseDate ? Math.floor(daysBetween(latestReleaseDate, now)) : null
  const hasIssueSignal = totalIssues > 0
  const hasPrSignal = closedPRs.length > 0
  const hasReleaseSignal = latestReleaseDate !== null
  const maintenanceAssessment = computeMaintenanceAssessment({
    daysSinceLastCommit,
    daysSinceLastRelease,
    medianIssueCloseDays,
    staleIssueCount,
    prMergeRate,
    avgPrMergeDays,
    commits30d: commitStats.commits30d,
    commits90d: commitStats.commits90d,
    activeCommitAuthors90d: commitStats.activeCommitAuthors90d,
    hasReleaseSignal,
    hasIssueSignal,
    hasPrSignal,
  })

  return {
    issueCloseRate,
    avgIssueResponseDays,
    medianIssueCloseDays,
    staleIssueCount,
    prMergeRate,
    avgPrMergeDays,
    activeContributors90d,
    topContributorCount,
    commits30d: commitStats.commits30d,
    commits90d: commitStats.commits90d,
    activeCommitAuthors90d: commitStats.activeCommitAuthors90d,
    daysSinceLastCommit,
    daysSinceLastRelease,
    maintenanceAssessment,
    hasCommunityFiles: {
      contributingGuide: community?.files?.contributing !== null && community?.files?.contributing !== undefined,
      codeOfConduct: community?.files?.code_of_conduct !== null && community?.files?.code_of_conduct !== undefined,
      ci: workflowCount > 0,
    },
  }
}

// ─── Summarisable issue content for AI ────────────────────────────────────────

export interface IssueSample {
  title: string
  agedays: number
  comments: number
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface RepoIntelRawData {
  metrics: RepoIntelMetrics
  issueSamples: IssueSample[]
  prMergeRate: number
  contributorCount: number
}

export async function fetchRepoIntelData(
  owner: string,
  repo: string,
  token: string,
): Promise<RepoIntelRawData> {
  const [issues, prs, contributors, community, commitStats, latestReleaseDate, workflowCount] =
    await Promise.all([
      fetchIssues(owner, repo, token),
      fetchPRs(owner, repo, token),
      fetchContributors(owner, repo, token),
      fetchCommunityProfile(owner, repo, token),
      fetchRecentCommitStats(owner, repo, token),
      fetchLatestReleaseDate(owner, repo, token),
      fetchWorkflowCount(owner, repo, token),
    ])

  const metrics = computeMetrics(
    issues,
    prs,
    contributors,
    community,
    commitStats,
    latestReleaseDate,
    workflowCount,
  )

  // Build a sample of recent open issues for the AI to synthesize pain points
  const now = new Date().toISOString()
  const issueSamples: IssueSample[] = issues
    .filter(i => i.state === 'open')
    .slice(0, 30)
    .map(i => ({
      title: i.title,
      agedays: Math.floor(daysBetween(i.created_at, now)),
      comments: i.comments,
    }))

  return {
    metrics,
    issueSamples,
    prMergeRate: metrics.prMergeRate,
    contributorCount: contributors.length,
  }
}
