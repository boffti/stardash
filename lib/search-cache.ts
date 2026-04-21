import type { PersonalizedTheme } from "@/app/api/search/personalized/route"
import type { StarredRepo } from "@/lib/types"

const PERSONALIZED_SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface PersonalizedSearchCache {
  themes: PersonalizedTheme[]
  repoSignature: string
  cachedAt: string
}

function personalizedSearchCacheKey(userId: string) {
  return `stardash-personalized-search-cache-${userId}`
}

function hashString(value: string) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function buildPersonalizedSearchRepoSignature(repos: StarredRepo[]) {
  const sample = repos.slice(0, 100)
  const source = sample
    .map(repo => [
      repo.fullName,
      repo.name,
      repo.description ?? "",
      repo.language ?? "",
      repo.topics.slice(0, 5).join(","),
    ].join(":"))
    .join("|")

  return `${sample.length}:${hashString(source)}`
}

export function getCachedPersonalizedSearch(
  userId: string,
  repoSignature: string,
): { themes: PersonalizedTheme[]; cachedAt: string } | null {
  if (typeof window === "undefined") return null

  try {
    const raw = localStorage.getItem(personalizedSearchCacheKey(userId))
    if (!raw) return null

    const cache: PersonalizedSearchCache = JSON.parse(raw)
    const age = Date.now() - new Date(cache.cachedAt).getTime()
    if (age > PERSONALIZED_SEARCH_CACHE_TTL_MS) return null
    if (cache.repoSignature !== repoSignature) return null
    if (!Array.isArray(cache.themes)) return null

    return { themes: cache.themes, cachedAt: cache.cachedAt }
  } catch {
    return null
  }
}

export function setCachedPersonalizedSearch(
  userId: string,
  repoSignature: string,
  themes: PersonalizedTheme[],
): void {
  if (typeof window === "undefined") return

  try {
    const cache: PersonalizedSearchCache = {
      themes,
      repoSignature,
      cachedAt: new Date().toISOString(),
    }
    localStorage.setItem(personalizedSearchCacheKey(userId), JSON.stringify(cache))
  } catch {
    // localStorage quota exceeded - fail silently
  }
}
