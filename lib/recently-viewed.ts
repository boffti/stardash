import { useEffect, useState } from "react"
import type { StarredRepo } from "@/lib/types"

const RECENTLY_VIEWED_LIMIT = 24
const RECENTLY_VIEWED_EVENT = "stardash:recently-viewed-updated"

export interface RecentlyViewedEntry {
  repo: StarredRepo
  viewedAt: string
  source: "dashboard" | "trending" | "recently-viewed"
}

function storageKey(userId: string) {
  return `stardash_recently_viewed_${userId}`
}

function isRecentlyViewedEntry(value: unknown): value is RecentlyViewedEntry {
  if (!value || typeof value !== "object") return false

  const candidate = value as Partial<RecentlyViewedEntry>
  return (
    typeof candidate.viewedAt === "string" &&
    typeof candidate.source === "string" &&
    Boolean(candidate.repo && typeof candidate.repo === "object" && typeof candidate.repo.id === "string")
  )
}

function emitRecentlyViewedUpdate() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(RECENTLY_VIEWED_EVENT))
}

export function getRecentlyViewed(userId: string): RecentlyViewedEntry[] {
  if (typeof window === "undefined") return []

  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(isRecentlyViewedEntry)
      .sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime())
      .slice(0, RECENTLY_VIEWED_LIMIT)
  } catch {
    return []
  }
}

export function trackRecentlyViewedRepo(
  userId: string,
  repo: StarredRepo,
  source: RecentlyViewedEntry["source"],
): RecentlyViewedEntry[] {
  if (typeof window === "undefined") return []

  const nextEntry: RecentlyViewedEntry = {
    repo,
    source,
    viewedAt: new Date().toISOString(),
  }

  const existing = getRecentlyViewed(userId).filter((entry) => entry.repo.id !== repo.id)
  const next = [nextEntry, ...existing].slice(0, RECENTLY_VIEWED_LIMIT)

  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(next))
  } catch {
    return next
  }

  emitRecentlyViewedUpdate()
  return next
}

export function useRecentlyViewed(userId?: string) {
  const [entries, setEntries] = useState<RecentlyViewedEntry[]>([])

  useEffect(() => {
    if (!userId) {
      setEntries([])
      return
    }

    const sync = () => {
      setEntries(getRecentlyViewed(userId))
    }

    sync()
    window.addEventListener("storage", sync)
    window.addEventListener(RECENTLY_VIEWED_EVENT, sync)

    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener(RECENTLY_VIEWED_EVENT, sync)
    }
  }, [userId])

  return entries
}
