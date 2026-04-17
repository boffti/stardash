import type { RepoIntelMetrics } from './types'

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
  commit: {
    author: {
      date: string
    }
  }
}

interface GHRelease {
  published_at: string
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

async function fetchLatestCommitDate(owner: string, repo: string, token: string): Promise<string | null> {
  try {
    const commits = await ghGet<GHCommit[]>(
      `/repos/${owner}/${repo}/commits?per_page=1`,
      token
    )
    return commits[0]?.commit?.author?.date ?? null
  } catch {
    return null
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

function computeMetrics(
  issues: GHIssue[],
  prs: GHPR[],
  contributors: GHContributor[],
  community: GHCommunityProfile | null,
  latestCommitDate: string | null,
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

  // Avg issue response: days from created_at to closed_at for closed issues
  const issueResponseTimes = issues
    .filter(i => i.state === 'closed' && i.closed_at)
    .map(i => daysBetween(i.created_at, i.closed_at!))
  const avgIssueResponseDays = median(issueResponseTimes)

  // PR merge rate
  const closedPRs = prs.filter(p => p.state === 'closed')
  const mergedPRs = prs.filter(p => p.merged_at !== null)
  const prMergeRate = closedPRs.length > 0 ? mergedPRs.length / closedPRs.length : 0

  // Avg PR merge time
  const prMergeTimes = mergedPRs
    .filter(p => p.closed_at)
    .map(p => daysBetween(p.created_at, p.merged_at!))
  const avgPrMergeDays = median(prMergeTimes)

  // Active contributors in last 90 days — we use top contributors as a proxy
  // (GitHub doesn't expose last-active date on contributors endpoint directly)
  const activeContributors90d = Math.min(contributors.length, 25)

  // Days since last commit/release
  const daysSinceLastCommit = latestCommitDate ? Math.floor(daysBetween(latestCommitDate, now)) : null
  const daysSinceLastRelease = latestReleaseDate ? Math.floor(daysBetween(latestReleaseDate, now)) : null

  return {
    issueCloseRate,
    avgIssueResponseDays,
    staleIssueCount,
    prMergeRate,
    avgPrMergeDays,
    activeContributors90d,
    daysSinceLastCommit,
    daysSinceLastRelease,
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
  const [issues, prs, contributors, community, latestCommitDate, latestReleaseDate, workflowCount] =
    await Promise.all([
      fetchIssues(owner, repo, token),
      fetchPRs(owner, repo, token),
      fetchContributors(owner, repo, token),
      fetchCommunityProfile(owner, repo, token),
      fetchLatestCommitDate(owner, repo, token),
      fetchLatestReleaseDate(owner, repo, token),
      fetchWorkflowCount(owner, repo, token),
    ])

  const metrics = computeMetrics(
    issues,
    prs,
    contributors,
    community,
    latestCommitDate,
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
