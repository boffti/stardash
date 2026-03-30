import { StarredRepo } from "./types"

export interface TrendingCategory {
  id: string
  title: string
  description: string
  repos: StarredRepo[]
}

export interface TrendingAnalysis {
  categories: TrendingCategory[]
  topLanguages: string[]
  topTopics: string[]
  totalAnalyzed: number
}

const RECENT_STAR_COUNT = 25

/**
 * Analyzes the user's last N starred repos and generates recommendations
 * based on patterns found in those repos.
 */
export function analyzeTrending(
  allRepos: StarredRepo[]
): TrendingAnalysis {
  // Sort by starred_at descending (most recent first)
  const sortedRepos = [...allRepos].sort(
    (a, b) => new Date(b.starredAt).getTime() - new Date(a.starredAt).getTime()
  )

  // Get last N starred repos for analysis
  const recentRepos = sortedRepos.slice(0, RECENT_STAR_COUNT)

  if (recentRepos.length === 0) {
    return {
      categories: [],
      topLanguages: [],
      topTopics: [],
      totalAnalyzed: 0,
    }
  }

  // Extract patterns from recent stars
  const languageCounts = new Map<string, number>()
  const topicCounts = new Map<string, number>()

  recentRepos.forEach((repo) => {
    if (repo.language) {
      languageCounts.set(repo.language, (languageCounts.get(repo.language) || 0) + 1)
    }
    repo.topics.forEach((topic) => {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1)
    })
  })

  const topLanguages = Array.from(languageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang]) => lang)

  const topTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic]) => topic)

  // Generate categories from ALL repos (not just recent) based on patterns
  const categories: TrendingCategory[] = [
    generatePopularCategory(allRepos, recentRepos),
    generateUpcomingCategory(allRepos, recentRepos),
    generateHiddenGemsCategory(allRepos, recentRepos),
  ].filter((cat) => cat.repos.length > 0)

  return {
    categories,
    topLanguages,
    topTopics,
    totalAnalyzed: recentRepos.length,
  }
}

/**
 * Popular: High star count repos from user's interests
 */
function generatePopularCategory(
  allRepos: StarredRepo[],
  recentRepos: StarredRepo[]
): TrendingCategory {
  const recentIds = new Set(recentRepos.map((r) => r.id))

  // Get repos with high star counts that match user's recent interests
  const popular = allRepos
    .filter((repo) => !recentIds.has(repo.id)) // Exclude recently starred
    .filter((repo) => repo.stargazersCount >= 1000)
    .sort((a, b) => b.stargazersCount - a.stargazersCount)
    .slice(0, 12)

  return {
    id: "popular",
    title: "Popular in Your Network",
    description: "Highly-starred repositories related to your interests",
    repos: popular,
  }
}

/**
 * Upcoming: Recently active repos with good engagement
 */
function generateUpcomingCategory(
  allRepos: StarredRepo[],
  recentRepos: StarredRepo[]
): TrendingCategory {
  const recentIds = new Set(recentRepos.map((r) => r.id))
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Repos pushed recently with decent engagement (not already super popular)
  const upcoming = allRepos
    .filter((repo) => !recentIds.has(repo.id))
    .filter((repo) => {
      const pushedDate = new Date(repo.pushedAt)
      return pushedDate >= thirtyDaysAgo
    })
    .filter((repo) => repo.stargazersCount >= 50 && repo.stargazersCount < 5000)
    .sort((a, b) => {
      // Score based on recent activity and engagement ratio
      const aScore = a.stargazersCount / (a.forksCount + 1)
      const bScore = b.stargazersCount / (b.forksCount + 1)
      return bScore - aScore
    })
    .slice(0, 12)

  return {
    id: "upcoming",
    title: "Heating Up",
    description: "Recently active repositories gaining traction",
    repos: upcoming,
  }
}

/**
 * Hidden Gems: Lower star count but high quality signals
 */
function generateHiddenGemsCategory(
  allRepos: StarredRepo[],
  recentRepos: StarredRepo[]
): TrendingCategory {
  const recentIds = new Set(recentRepos.map((r) => r.id))

  // Gems: 100-2000 stars, high forks-to-stars ratio indicates utility
  const gems = allRepos
    .filter((repo) => !recentIds.has(repo.id))
    .filter((repo) => repo.stargazersCount >= 100 && repo.stargazersCount < 2000)
    .filter((repo) => {
      const ratio = repo.forksCount / (repo.stargazersCount + 1)
      return ratio > 0.15 // Higher ratio = more forks relative to stars = more utilitarian
    })
    .sort((a, b) => {
      // Score by forks-to-stars ratio and issue activity
      const aRatio = a.forksCount / (a.stargazersCount + 1)
      const bRatio = b.forksCount / (b.stargazersCount + 1)
      const aScore = aRatio * Math.log(a.stargazersCount + 1)
      const bScore = bRatio * Math.log(b.stargazersCount + 1)
      return bScore - aScore
    })
    .slice(0, 12)

  return {
    id: "gems",
    title: "Hidden Gems",
    description: "Under-the-radar tools and libraries worth exploring",
    repos: gems,
  }
}

/**
 * Calculate a "trend score" for sorting within categories
 */
export function calculateTrendScore(repo: StarredRepo): number {
  const starWeight = Math.log(repo.stargazersCount + 1)
  const forkWeight = Math.log(repo.forksCount + 1) * 0.5
  const recentBonus = repo.pushedAt
    ? Math.max(0, 30 - (Date.now() - new Date(repo.pushedAt).getTime()) / (1000 * 60 * 60 * 24)) / 30
    : 0

  return starWeight + forkWeight + recentBonus
}
