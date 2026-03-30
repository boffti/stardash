"use client"

import { AlertTriangle, Circle, TrendingUp, Tag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { StarredRepo } from "@/lib/types"
import { cn } from "@/lib/utils"

interface RepoHealthBadgesProps {
  repo: StarredRepo
  className?: string
  size?: "sm" | "md"
}

// Check if repo is dormant (no commits in 12+ months)
function isDormant(pushedAt: string): boolean {
  const lastPush = new Date(pushedAt)
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  return lastPush < twelveMonthsAgo
}

export function RepoHealthBadges({ repo, className, size = "sm" }: RepoHealthBadgesProps) {
  const badges = []

  // Archived badge
  if (repo.archived) {
    badges.push(
      <Badge
        key="archived"
        variant="outline"
        className={cn(
          "gap-1 font-normal",
          size === "sm" ? "text-[10px] px-1.5 py-0 h-4" : "text-xs px-2 py-0.5 h-5",
          "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400 dark:border-amber-500/30"
        )}
      >
        <AlertTriangle className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />
        Archived
      </Badge>
    )
  }

  // Dormant badge
  if (isDormant(repo.pushedAt)) {
    badges.push(
      <Badge
        key="dormant"
        variant="outline"
        className={cn(
          "gap-1 font-normal",
          size === "sm" ? "text-[10px] px-1.5 py-0 h-4" : "text-xs px-2 py-0.5 h-5",
          "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400 dark:border-slate-500/30"
        )}
      >
        <Circle className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />
        Dormant
      </Badge>
    )
  }

  // Trending badge - stars doubled in 30 days
  if (repo.isTrending) {
    badges.push(
      <Badge
        key="trending"
        variant="outline"
        className={cn(
          "gap-1 font-normal",
          size === "sm" ? "text-[10px] px-1.5 py-0 h-4" : "text-xs px-2 py-0.5 h-5",
          "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
        )}
      >
        <TrendingUp className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />
        Trending
      </Badge>
    )
  }

  // New release badge - major release since starred
  if (repo.latestRelease) {
    badges.push(
      <Badge
        key="release"
        variant="outline"
        className={cn(
          "gap-1 font-normal",
          size === "sm" ? "text-[10px] px-1.5 py-0 h-4" : "text-xs px-2 py-0.5 h-5",
          "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400 dark:border-blue-500/30"
        )}
        title={repo.latestRelease.name}
      >
        <Tag className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />
        {repo.latestRelease.tagName}
      </Badge>
    )
  }

  if (badges.length === 0) return null

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {badges}
    </div>
  )
}

// Helper to check if a repo has any health signals
export function hasHealthSignals(repo: StarredRepo): boolean {
  if (repo.archived) return true
  if (isDormant(repo.pushedAt)) return true
  if (repo.isTrending) return true
  if (repo.latestRelease) return true
  return false
}
