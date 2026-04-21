"use client"

import { Sparkles, ChevronRight } from "lucide-react"
import { SearchResultCard } from "./search-result-card"
import { Skeleton } from "@/components/ui/skeleton"
import type { PersonalizedTheme } from "@/app/api/search/personalized/route"
import type { Tag, Collection } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SearchPersonalizedSectionProps {
  themes: PersonalizedTheme[]
  isLoading?: boolean
  hasRepoSource?: boolean
  tags: Tag[]
  collections: Collection[]
  className?: string
}

export function SearchPersonalizedSection({
  themes,
  isLoading = false,
  hasRepoSource = false,
  tags,
  collections,
  className,
}: SearchPersonalizedSectionProps) {
  if (isLoading) {
    return (
      <div className={cn("space-y-5", className)}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-medium">Based on your stars</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (themes.length === 0) {
    if (!hasRepoSource) return null

    return (
      <div className={cn("rounded-lg border border-dashed border-border/70 p-5", className)}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Based on your stars</h3>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Suggestions are not available yet. Refresh your starred repos, then reopen Discover.
        </p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-8", className)}>
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-400" />
        <h3 className="text-sm font-medium">Based on your stars</h3>
      </div>

      {themes.map(theme => (
        <div key={theme.theme} className="space-y-3">
          <div>
            <div className="flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              <h4 className="text-sm font-medium">{theme.theme}</h4>
            </div>
            <p className="mt-0.5 ml-5 text-xs text-muted-foreground/70">{theme.description}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {theme.repos.slice(0, 4).map(repo => (
              <SearchResultCard
                key={repo.id}
                repo={repo}
                tags={tags}
                collections={collections}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
