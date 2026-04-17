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
  return cleaned.length > 240 ? `${cleaned.slice(0, 237).trim()}...` : cleaned
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
  const bodyLength = issue.body?.trim().length ?? 0
  const updatedDaysAgo = (Date.now() - new Date(issue.updated_at).getTime()) / (1000 * 60 * 60 * 24)
  let score = 45
  const fitReasons: string[] = []
  const qualitySignals: string[] = []
  const risks: string[] = []

  if (includesAny(labels, STARTER_LABELS)) {
    score += 22
    fitReasons.push('Labeled as beginner-friendly or help wanted')
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

  if (bodyLength >= 180) {
    score += 10
    qualitySignals.push('Issue has enough context to start investigating')
  } else {
    score -= 8
    risks.push('Issue description is short')
  }

  if (updatedDaysAgo <= 30) {
    score += 8
    qualitySignals.push('Recently active')
  } else if (updatedDaysAgo > 180) {
    score -= 16
    risks.push('May be stale')
  }

  if (issue.comments >= 1 && issue.comments <= 8) {
    score += 6
    qualitySignals.push('Some discussion without too much noise')
  } else if (issue.comments > 18) {
    score -= 8
    risks.push('Long discussion thread may indicate ambiguity')
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
  token: string,
  repo: StarredRepo,
  preferences: ContributionPreferences = {},
): Promise<ContributionOpportunity[]> {
  const response = await fetch(
    `https://api.github.com/repos/${repo.owner}/${repo.name}/issues?state=open&sort=updated&direction=desc&per_page=20`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      next: { revalidate: 900 },
    },
  )

  if (!response.ok) {
    return []
  }

  const issues = (await response.json()) as GitHubIssue[]

  return issues
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
