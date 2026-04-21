"use client"

import { TrendingUp, Star } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { SearchStarPopover } from "./search-star-popover"
import type { SearchRepo } from "@/app/api/search/repos/route"
import type { Tag, Collection } from "@/lib/types"
import { LANGUAGE_COLORS } from "@/lib/types"
import { cn } from "@/lib/utils"

interface TrendingRepo extends SearchRepo {
  starDelta?: number
}

interface SearchTrendingStripProps {
  repos: TrendingRepo[]
  tags: Tag[]
  collections: Collection[]
  className?: string
}

function formatNumber(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : n.toString()
}

export function SearchTrendingStrip({ repos, tags, collections, className }: SearchTrendingStripProps) {
  if (repos.length === 0) return null

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Trending this week</h3>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {repos.map(repo => {
          const langColor = repo.language ? (LANGUAGE_COLORS[repo.language] ?? "#64748b") : null
          return (
            <div
              key={repo.id}
              className={cn(
                "shrink-0 w-48 rounded-lg border border-border/60 bg-card p-3",
                "flex flex-col gap-2 hover:border-muted-foreground/30 hover:bg-card/80 transition-all"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarImage src={repo.avatarUrl} alt={repo.owner} />
                  <AvatarFallback className="text-[10px]">{repo.owner[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground/60 truncate">{repo.owner}</p>
                  <p className="text-xs font-mono font-medium truncate">{repo.name}</p>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed flex-1">
                {repo.description ?? "No description"}
              </p>

              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {langColor && (
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: langColor }} />
                    </div>
                  )}
                  <div className="flex items-center gap-0.5">
                    <Star className="h-3 w-3" />
                    <span>{formatNumber(repo.stargazersCount)}</span>
                  </div>
                  {repo.starDelta && repo.starDelta > 0 && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1 py-0 h-4 text-emerald-500 border-emerald-500/30 bg-emerald-500/5"
                    >
                      +{formatNumber(repo.starDelta)}
                    </Badge>
                  )}
                </div>

                <SearchStarPopover
                  repo={repo}
                  tags={tags}
                  collections={collections}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
