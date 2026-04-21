import type { StarredRepo } from '@/lib/types'

export type ContributionDifficulty = 'beginner' | 'intermediate' | 'advanced'
export type ContributionType =
  | 'bugfix'
  | 'docs'
  | 'tests'
  | 'frontend'
  | 'backend'
  | 'infra'
  | 'feature'
  | 'maintenance'

export interface ContributionPreferences {
  languages?: string[]
  difficulty?: ContributionDifficulty | 'all'
  contributionTypes?: ContributionType[]
}

export interface ContributionOpportunity {
  id: string
  repoId: string
  repoFullName: string
  repoOwner: string
  repoName: string
  repoDescription: string
  repoLanguage: string | null
  repoTopics: string[]
  repoStars: number
  issueNumber: number
  title: string
  bodyPreview: string
  labels: string[]
  htmlUrl: string
  comments: number
  createdAt: string
  updatedAt: string
  difficulty: ContributionDifficulty
  contributionTypes: ContributionType[]
  score: number
  fitReasons: string[]
  qualitySignals: string[]
  risks: string[]
}

interface GitHubIssueLabel {
  name: string
}

interface GitHubIssue {
  id: number
  number: number
  title: string
  body: string | null
  html_url: string
  comments: number
  created_at: string
  updated_at: string
  labels: GitHubIssueLabel[]
  pull_request?: unknown
}

interface FetchRepoContributionIssuesOptions {
  maxIssues?: number
}

const STARTER_LABELS = [
  'good first issue',
  'good-first-issue',
  'first-timers-only',
  'first timers only',
  'beginner',
  'starter',
  'easy',
  'help wanted',
]

const DOC_LABELS = ['documentation', 'docs', 'doc']
const TEST_LABELS = ['test', 'tests', 'testing']
const INFRA_LABELS = ['ci', 'build', 'devops', 'infrastructure', 'github actions', 'docker']
const BUG_LABELS = ['bug', 'fix', 'defect']
const FEATURE_LABELS = ['enhancement', 'feature', 'request']
const FRONTEND_HINTS = ['ui', 'ux', 'css', 'frontend', 'react', 'next', 'component']
const BACKEND_HINTS = ['api', 'server', 'database', 'backend', 'auth', 'postgres']
const VAGUE_HINTS = ['needs discussion', 'needs design', 'proposal', 'investigate', 'research', 'tracking']
const SMALL_SCOPE_HINTS = ['typo', 'readme', 'docs', 'example', 'copy', 'label', 'lint', 'test', 'snapshot']
const BLOCKED_LABELS = ['blocked', 'wontfix', 'invalid', 'duplicate', 'question', 'support']

function normalize(value: string) {
  return value.toLowerCase().trim()
}

function includesAny(haystack: string[], needles: string[]) {
  return haystack.some((item) => needles.some((needle) => item.includes(needle)))
}

function bodyPreview(body: string | null) {
  const cleaned = (body ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return 'No issue description provided.'
  return cleaned.length > 280 ? `${cleaned.slice(0, 277).trim()}...` : cleaned
}

function inferTypes(issue: GitHubIssue, repo: StarredRepo): ContributionType[] {
  const labels = issue.labels.map((label) => normalize(label.name))
  const text = normalize(`${issue.title} ${issue.body ?? ''} ${repo.topics.join(' ')}`)
  const types = new Set<ContributionType>()

  if (includesAny(labels, DOC_LABELS) || /\b(readme|docs?|documentation|guide)\b/.test(text)) types.add('docs')
  if (includesAny(labels, TEST_LABELS) || /\b(test|spec|coverage)\b/.test(text)) types.add('tests')
  if (includesAny(labels, BUG_LABELS) || /\bbug|fix|error|crash|broken|regression\b/.test(text)) types.add('bugfix')
  if (includesAny(labels, INFRA_LABELS) || /\b(ci|workflow|docker|build|deploy|lint)\b/.test(text)) types.add('infra')
  if (includesAny(labels, FEATURE_LABELS) || /\b(add|support|feature|enhancement)\b/.test(text)) types.add('feature')
  if (FRONTEND_HINTS.some((hint) => text.includes(hint))) types.add('frontend')
  if (BACKEND_HINTS.some((hint) => text.includes(hint))) types.add('backend')

  if (types.size === 0) types.add('maintenance')
  return Array.from(types).slice(0, 3)
}

function inferDifficulty(issue: GitHubIssue): ContributionDifficulty {
  const labels = issue.labels.map((label) => normalize(label.name))
  const text = normalize(`${issue.title} ${issue.body ?? ''}`)
  const bodyLength = issue.body?.length ?? 0

  if (includesAny(labels, STARTER_LABELS) || includesAny(labels, DOC_LABELS) || includesAny(labels, TEST_LABELS)) {
    return 'beginner'
  }

  if (
    labels.some((label) => label.includes('breaking') || label.includes('architecture')) ||
    /\b(rfc|architecture|migration|refactor|performance|security)\b/.test(text) ||
    issue.comments > 20
  ) {
    return 'advanced'
  }

  if (bodyLength > 1000 || issue.comments > 8) return 'intermediate'
  return 'intermediate'
}

function scoreIssue(
  issue: GitHubIssue,
  repo: StarredRepo,
  preferences: ContributionPreferences,
  difficulty: ContributionDifficulty,
  contributionTypes: ContributionType[],
) {
  const labels = issue.labels.map((label) => normalize(label.name))
  const text = normalize(`${issue.title} ${issue.body ?? ''} ${labels.join(' ')}`)
  const bodyLength = issue.body?.trim().length ?? 0
  const updatedDaysAgo = (Date.now() - new Date(issue.updated_at).getTime()) / (1000 * 60 * 60 * 24)
  const createdDaysAgo = (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24)
  let score = 38
  const fitReasons: string[] = []
  const qualitySignals: string[] = []
  const risks: string[] = []

  if (includesAny(labels, STARTER_LABELS)) {
    score += 24
    fitReasons.push('Labeled as beginner-friendly or help wanted')
  }

  if (labels.some((label) => label.includes('good first issue'))) {
    score += 8
    fitReasons.push('Explicit good first issue signal')
  }

  if (preferences.languages?.length && repo.language && preferences.languages.includes(repo.language)) {
    score += 18
    fitReasons.push(`Matches your ${repo.language} preference`)
  }

  const preferredTypeMatch = preferences.contributionTypes?.some((type) => contributionTypes.includes(type))
  if (preferredTypeMatch) {
    score += 14
    fitReasons.push('Matches your preferred contribution type')
  }

  if (preferences.difficulty && preferences.difficulty !== 'all' && preferences.difficulty === difficulty) {
    score += 10
    fitReasons.push(`Fits ${difficulty} difficulty`)
  }

  if (difficulty === 'beginner') {
    score += 8
  } else if (difficulty === 'advanced') {
    score -= 8
  }

  if (bodyLength >= 900) {
    score += 13
    qualitySignals.push('Issue has substantial context')
  } else if (bodyLength >= 360) {
    score += 10
    qualitySignals.push('Issue has enough context to start investigating')
  } else if (bodyLength >= 180) {
    score += 6
    qualitySignals.push('Issue has basic context')
  } else {
    score -= 8
    risks.push('Issue description is short')
  }

  if (labels.length >= 2) {
    score += 4
    qualitySignals.push('Maintainers have classified the issue')
  }

  if (updatedDaysAgo <= 3) {
    score += 12
    qualitySignals.push('Very recently active')
  } else if (updatedDaysAgo <= 14) {
    score += 9
    qualitySignals.push('Recently active')
  } else if (updatedDaysAgo <= 45) {
    score += 5
    qualitySignals.push('Active in the last month')
  } else if (updatedDaysAgo <= 120) {
    score += 1
  } else if (updatedDaysAgo > 180) {
    score -= 16
    risks.push('May be stale')
  }

  if (createdDaysAgo <= 14 && updatedDaysAgo <= 14) {
    score += 6
    qualitySignals.push('Recently opened and still active')
  } else if (createdDaysAgo > 730 && updatedDaysAgo > 120) {
    score -= 10
    risks.push('Long-running issue with limited recent activity')
  }

  if (issue.comments === 0) {
    score += 2
    qualitySignals.push('No discussion to untangle yet')
  } else if (issue.comments <= 3) {
    score += 8
    qualitySignals.push('Some discussion without too much noise')
  } else if (issue.comments <= 8) {
    score += 5
    qualitySignals.push('Moderate discussion')
  } else if (issue.comments <= 18) {
    score -= 2
  } else {
    score -= 8
    risks.push('Long discussion thread may indicate ambiguity')
  }

  if (SMALL_SCOPE_HINTS.some((hint) => text.includes(hint))) {
    score += 6
    qualitySignals.push('Looks like a smaller scoped contribution')
  }

  if (VAGUE_HINTS.some((hint) => text.includes(hint))) {
    score -= 6
    risks.push('May need clarification before coding')
  }

  if (includesAny(labels, BLOCKED_LABELS)) {
    score -= 18
    risks.push('Issue label suggests it may be blocked or unsuitable')
  }

  if (repo.isPinned) {
    score += 4
    fitReasons.push('Comes from a pinned repo')
  }

  if (repo.stargazersCount >= 10000) {
    score += 3
  } else if (repo.stargazersCount < 100) {
    score -= 3
  }

  if (repo.archived) {
    score -= 50
    risks.push('Repository is archived')
  }

  if (!repo.openIssuesCount) score -= 6

  if (fitReasons.length === 0) {
    fitReasons.push('Relevant open issue from a repository you starred')
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    fitReasons,
    qualitySignals,
    risks,
  }
}

export async function fetchRepoContributionIssues(
  token: string | undefined,
  repo: StarredRepo,
  preferences: ContributionPreferences = {},
  options: FetchRepoContributionIssuesOptions = {},
): Promise<ContributionOpportunity[]> {
  const maxIssues = Math.min(Math.max(options.maxIssues ?? 100, 20), 500)
  const perPage = 100
  const pages = Math.ceil(maxIssues / perPage)
  const issues: GitHubIssue[] = []

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  for (let page = 1; page <= pages; page += 1) {
    const response = await fetch(
      `https://api.github.com/repos/${repo.owner}/${repo.name}/issues?state=open&sort=updated&direction=desc&per_page=${perPage}&page=${page}`,
      {
        headers,
        next: { revalidate: 900 },
      },
    )

    if (!response.ok) {
      return []
    }

    const pageIssues = (await response.json()) as GitHubIssue[]
    issues.push(...pageIssues)
    if (pageIssues.length < perPage || issues.length >= maxIssues) break
  }

  return issues
    .slice(0, maxIssues)
    .filter((issue) => !issue.pull_request)
    .map((issue) => {
      const labels = issue.labels.map((label) => label.name)
      const difficulty = inferDifficulty(issue)
      const contributionTypes = inferTypes(issue, repo)
      const scored = scoreIssue(issue, repo, preferences, difficulty, contributionTypes)

      return {
        id: `${repo.id}:${issue.id}`,
        repoId: repo.id,
        repoFullName: repo.fullName,
        repoOwner: repo.owner,
        repoName: repo.name,
        repoDescription: repo.description,
        repoLanguage: repo.language,
        repoTopics: repo.topics,
        repoStars: repo.stargazersCount,
        issueNumber: issue.number,
        title: issue.title,
        bodyPreview: bodyPreview(issue.body),
        labels,
        htmlUrl: issue.html_url,
        comments: issue.comments,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        difficulty,
        contributionTypes,
        ...scored,
      }
    })
    .filter((issue) => issue.score >= 28)
}

export function rankReposForIssueDiscovery(repos: StarredRepo[], preferences: ContributionPreferences = {}) {
  return [...repos]
    .filter((repo) => !repo.archived && repo.openIssuesCount > 0)
    .sort((a, b) => {
      const languageBoostA = a.language && preferences.languages?.includes(a.language) ? 1 : 0
      const languageBoostB = b.language && preferences.languages?.includes(b.language) ? 1 : 0
      const pinnedBoostA = a.isPinned ? 1 : 0
      const pinnedBoostB = b.isPinned ? 1 : 0
      return (
        languageBoostB - languageBoostA ||
        pinnedBoostB - pinnedBoostA ||
        b.openIssuesCount - a.openIssuesCount ||
        b.stargazersCount - a.stargazersCount
      )
    })
}
