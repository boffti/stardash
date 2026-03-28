"use client"

import { RepoCard } from "./repo-card"
import { StarredRepo } from "@/lib/types"
import { Empty, EmptyIcon, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Inbox } from "lucide-react"

interface RepoGridProps {
  repos: StarredRepo[]
  onRepoClick: (repo: StarredRepo) => void
}

export function RepoGrid({ repos, onRepoClick }: RepoGridProps) {
  if (repos.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyIcon>
          <Inbox className="h-10 w-10" />
        </EmptyIcon>
        <EmptyTitle>No repositories found</EmptyTitle>
        <EmptyDescription>
          Try adjusting your search or filters to find what you&apos;re looking for.
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {repos.map((repo) => (
        <RepoCard key={repo.id} repo={repo} onClick={() => onRepoClick(repo)} />
      ))}
    </div>
  )
}
