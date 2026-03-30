import { StarredRepo, LANGUAGE_COLORS } from './types'

interface GitHubRepo {
  id: number
  name: string
  full_name: string
  owner: {
    login: string
    avatar_url: string
  }
  description: string | null
  language: string | null
  topics: string[]
  homepage: string | null
  license: {
    spdx_id: string
  } | null
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  pushed_at: string
  html_url: string
  archived: boolean
}

// When using application/vnd.github.star+json, the response wraps repo in an object
interface StarredRepoResponse {
  starred_at: string
  repo: GitHubRepo
}

export async function fetchStarredRepos(
  accessToken: string,
  page: number = 1,
  perPage: number = 100
): Promise<{ repos: StarredRepo[]; hasMore: boolean }> {
  const response = await fetch(
    `https://api.github.com/user/starred?page=${page}&per_page=${perPage}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.star+json', // This header returns starred_at timestamp
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`)
  }

  const data: StarredRepoResponse[] = await response.json()
  
  // Check if there are more pages
  const linkHeader = response.headers.get('Link')
  const hasMore = linkHeader?.includes('rel="next"') ?? false

  const repos: StarredRepo[] = data.map((item) => ({
    id: item.repo.id.toString(),
    owner: item.repo.owner.login,
    name: item.repo.name,
    fullName: item.repo.full_name,
    description: item.repo.description || '',
    language: item.repo.language,
    languageColor: item.repo.language ? LANGUAGE_COLORS[item.repo.language] || null : null,
    topics: item.repo.topics || [],
    homepage: item.repo.homepage,
    license: item.repo.license?.spdx_id || null,
    stargazersCount: item.repo.stargazers_count,
    forksCount: item.repo.forks_count,
    openIssuesCount: item.repo.open_issues_count,
    pushedAt: item.repo.pushed_at,
    starredAt: item.starred_at,
    avatarUrl: item.repo.owner.avatar_url,
    // User-specific data (will be stored in DB later)
    status: null,
    isPinned: false,
    notes: null,
    tags: [],
    collections: [],
    readme: null,
    archived: item.repo.archived,
  }))

  return { repos, hasMore }
}

export async function fetchAllStarredRepos(accessToken: string): Promise<StarredRepo[]> {
  const allRepos: StarredRepo[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const { repos, hasMore: more } = await fetchStarredRepos(accessToken, page, 100)
    allRepos.push(...repos)
    hasMore = more
    page++

    // Safety limit to prevent infinite loops
    if (page > 50) break
  }

  return allRepos
}

// Fetch star count for a specific repo (lightweight, no auth required for public repos)
export async function fetchRepoStarCount(
  owner: string,
  repo: string,
  accessToken?: string
): Promise<number | null> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.stargazers_count as number
  } catch {
    return null
  }
}

// Fetch latest release for a repo
export interface ReleaseInfo {
  tagName: string
  name: string
  publishedAt: string
  htmlUrl: string
  isPrerelease: boolean
}

export async function fetchRepoLatestRelease(
  owner: string,
  repo: string,
  accessToken?: string
): Promise<ReleaseInfo | null> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
      { headers }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return {
      tagName: data.tag_name,
      name: data.name,
      publishedAt: data.published_at,
      htmlUrl: data.html_url,
      isPrerelease: data.prerelease,
    }
  } catch {
    return null
  }
}

export interface ReadmeResult {
  content: string | null
  error?: 'auth' | 'not_found' | 'server'
}

export async function fetchRepoReadme(
  accessToken: string,
  owner: string,
  repo: string
): Promise<ReadmeResult> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/readme`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    )

    if (response.status === 401) {
      return { content: null, error: 'auth' }
    }

    if (response.status === 404) {
      return { content: null, error: 'not_found' }
    }

    if (!response.ok) {
      return { content: null, error: 'server' }
    }

    const data = await response.json()
    if (!data.content || data.encoding !== 'base64') {
      return { content: null }
    }

    // GitHub API base64-encodes content with newlines — strip them before decoding
    return {
      content: Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
    }
  } catch {
    return { content: null, error: 'server' }
  }
}
