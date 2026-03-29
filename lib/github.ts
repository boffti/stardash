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

export async function fetchRepoReadme(
  accessToken: string,
  owner: string,
  repo: string
): Promise<string | null> {
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

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    if (!data.content || data.encoding !== 'base64') {
      return null
    }

    // GitHub API base64-encodes content with newlines — strip them before decoding
    return Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
  } catch {
    return null
  }
}
