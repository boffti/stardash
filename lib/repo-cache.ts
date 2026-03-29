import { StarredRepo } from './types'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface RepoCache {
  repos: StarredRepo[]
  cachedAt: string
}

function cacheKey(userId: string) {
  return `stardash-repos-cache-${userId}`
}

export function getCachedRepos(userId: string): { repos: StarredRepo[]; cachedAt: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(cacheKey(userId))
    if (!raw) return null
    const cache: RepoCache = JSON.parse(raw)
    const age = Date.now() - new Date(cache.cachedAt).getTime()
    if (age > CACHE_TTL_MS) return null
    return { repos: cache.repos, cachedAt: cache.cachedAt }
  } catch {
    return null
  }
}

export function setCachedRepos(userId: string, repos: StarredRepo[]): void {
  if (typeof window === 'undefined') return
  try {
    const cache: RepoCache = { repos, cachedAt: new Date().toISOString() }
    localStorage.setItem(cacheKey(userId), JSON.stringify(cache))
  } catch {
    // localStorage quota exceeded — fail silently
  }
}

export function clearCachedRepos(userId: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(cacheKey(userId))
}
