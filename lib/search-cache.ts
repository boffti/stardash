import type { PersonalizedTheme } from "@/app/api/search/personalized/route"
import type { StarredRepo } from "@/lib/types"

const PERSONALIZED_SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000
export const DISCOVER_SEARCH_CACHE_VERSION = "v1"
export const DISCOVER_SEARCH_CACHE_TTL_DAYS = 7

export interface DiscoverSavedSearch {
  id: string
  query: string
  normalizedQuery: string
  contextHash: string | null
  resultCount: number
  cachedAt: string
  lastRunAt: string
  lastOpenedAt: string | null
  expiresAt: string
  isSaved: boolean
}

export function isDiscoverSearchesMissingTableError(error: unknown) {
  if (!error || typeof error !== "object") return false

  const maybeError = error as { code?: unknown; message?: unknown }
  const code = typeof maybeError.code === "string" ? maybeError.code : null
  const message = typeof maybeError.message === "string" ? maybeError.message : ""

  return (
    code === "PGRST205" ||
    code === "42P01" ||
    message.includes("discover_searches") && message.includes("schema cache")
  )
}

interface PersonalizedSearchCache {
  themes: PersonalizedTheme[]
  repoSignature: string
  cachedAt: string
}

function personalizedSearchCacheKey(userId: string) {
  return `stardash-personalized-search-cache-${userId}`
}

export function normalizeDiscoverSearchQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ")
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

// ---------------------------------------------------------------------------
// User context utilities for context-aware query expansion and cache keying
// ---------------------------------------------------------------------------

/**
 * Derives the top languages, topics, and collection names from the user's
 * starred repos to inject into the AI query expansion prompt. Keeps output
 * compact so it fits cleanly in the prompt.
 */
export function buildUserContextSummary(repos: StarredRepo[]): string {
  const langCounts: Record<string, number> = {}
  const topicCounts: Record<string, number> = {}

  for (const repo of repos) {
    if (repo.language) langCounts[repo.language] = (langCounts[repo.language] ?? 0) + 1
    for (const t of repo.topics.slice(0, 5)) {
      topicCounts[t] = (topicCounts[t] ?? 0) + 1
    }
  }

  const topLangs = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([l]) => l)

  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([t]) => t)

  const parts: string[] = []
  if (topLangs.length) parts.push(`Languages: ${topLangs.join(", ")}`)
  if (topTopics.length) parts.push(`Frequent topics: ${topTopics.join(", ")}`)

  return parts.join(" | ")
}

/**
 * Produces a short stable hash that captures the user's current interest
 * profile (top languages + topics). Used as an additional dimension in the
 * discover_searches cache key so that results are invalidated when interests
 * materially change — not just on TTL expiry.
 */
export function buildStarContextHash(repos: StarredRepo[]): string {
  if (!repos.length) return "empty"

  const langCounts: Record<string, number> = {}
  const topicCounts: Record<string, number> = {}

  for (const repo of repos) {
    if (repo.language) langCounts[repo.language] = (langCounts[repo.language] ?? 0) + 1
    for (const t of repo.topics.slice(0, 5)) {
      topicCounts[t] = (topicCounts[t] ?? 0) + 1
    }
  }

  const topLangs = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([l]) => l)
    .join(",")

  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([t]) => t)
    .join(",")

  return hashString(`${topLangs}|${topTopics}|${repos.length}`)
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
