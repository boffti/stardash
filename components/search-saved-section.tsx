"use client"

import { Bookmark, Clock, Search, Star, Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { DiscoverSavedSearch } from "@/lib/search-cache"

interface SearchSavedSectionProps {
  searches: DiscoverSavedSearch[]
  isLoading?: boolean
  onSearch: (query: string) => void
  onToggleSaved: (search: DiscoverSavedSearch) => void
  onDelete: (search: DiscoverSavedSearch) => void
  className?: string
}

function lastUsedLabel(search: DiscoverSavedSearch) {
  const date = search.lastOpenedAt ?? search.lastRunAt ?? search.cachedAt
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function SearchSavedSection({
  searches,
  isLoading = false,
  onSearch,
  onToggleSaved,
  onDelete,
  className,
}: SearchSavedSectionProps) {
  if (isLoading) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <div className="flex items-center gap-2">
          <Bookmark className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Saved searches</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (searches.length === 0) return null

  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bookmark className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Saved searches</h3>
        </div>
        <Badge variant="secondary" className="text-xs font-normal">
          {searches.length} cached
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {searches.map(search => (
          <div
            key={search.id}
            className={cn(
              "group rounded-lg border border-border/70 bg-card/60 p-3",
              "hover:border-muted-foreground/30 hover:bg-card transition-colors"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <button
                onClick={() => onSearch(search.query)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm font-medium">{search.query}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Search className="size-3" />
                    {search.resultCount} repos
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {lastUsedLabel(search)}
                  </span>
                </div>
              </button>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant={search.isSaved ? "secondary" : "ghost"}
                  size="icon"
                  className="size-7"
                  aria-label={search.isSaved ? "Unsave search" : "Save search"}
                  onClick={() => onToggleSaved(search)}
                >
                  <Star className={cn("size-3.5", search.isSaved && "fill-current")} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100"
                  aria-label="Delete search"
                  onClick={() => onDelete(search)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
