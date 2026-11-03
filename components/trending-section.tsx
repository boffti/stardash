"use client"

import { RepoCard } from "./repo-card"
import type { StarredRepo } from "@/lib/types"

interface TrendingSectionProps {
  title: string
  description: string
  repos: StarredRepo[]
  onRepoClick: (repo: StarredRepo) => void
}

// Same card grid as All Stars, so "From your stars" reads as part of the app, not a carousel.
export function TrendingSection({ title, description, repos, onRepoClick }: TrendingSectionProps) {
  if (repos.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {repos.slice(0, 8).map((repo) => (
          <RepoCard key={repo.id} repo={repo} onClick={() => onRepoClick(repo)} />
        ))}
      </div>
    </section>
  )
}
