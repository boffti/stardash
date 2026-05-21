"use client"

import { RepoCard } from "./repo-card"
import { StarredRepo } from "@/lib/types"
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Inbox } from "lucide-react"

interface RepoGridProps {
  repos: StarredRepo[]
  onRepoClick: (repo: StarredRepo) => void
  onRemoveStar?: (repo: StarredRepo) => void
  isLoading?: boolean
}

function RepoCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 h-48">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full shrink-0" />
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      </div>
      {/* Description */}
      <div className="flex flex-col gap-1.5 flex-1">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      {/* Tags */}
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      {/* Footer */}
      <div className="pt-2 border-t border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

export function RepoGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr">
      {Array.from({ length: count }).map((_, i) => (
        <RepoCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function RepoGrid({ repos, onRepoClick, onRemoveStar, isLoading }: RepoGridProps) {
  if (isLoading) {
    return <RepoGridSkeleton />
  }

  if (repos.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyMedia variant="icon">
          <Inbox className="h-10 w-10" />
        </EmptyMedia>
        <EmptyTitle>No repositories found</EmptyTitle>
        <EmptyDescription>
          Try adjusting your search or filters to find what you&apos;re looking for.
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr">
      {repos.map((repo) => (
        <RepoCard key={repo.id} repo={repo} onClick={() => onRepoClick(repo)} onRemoveStar={onRemoveStar} />
      ))}
    </div>
  )
}
