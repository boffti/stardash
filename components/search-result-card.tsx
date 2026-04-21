"use client"

import { Star, GitFork, CheckCircle2, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SearchStarPopover } from "./search-star-popover"
import type { SearchRepo } from "@/app/api/search/repos/route"
import type { Tag, Collection } from "@/lib/types"
import { LANGUAGE_COLORS } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

interface SearchResultCardProps {
  repo: SearchRepo
  tags: Tag[]
  collections: Collection[]
  onStarred?: (repo: SearchRepo) => void
  className?: string
}

function formatNumber(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : n.toString()
}

export function SearchResultCard({ repo, tags, collections, onStarred, className }: SearchResultCardProps) {
  const langColor = repo.language ? (LANGUAGE_COLORS[repo.language] ?? "#64748b") : null
  const updatedAgo = formatDistanceToNow(new Date(repo.pushedAt), { addSuffix: true })

  return (
    <Card className={cn(
      "group relative overflow-hidden border-border bg-card",
      "hover:border-muted-foreground/30 hover:bg-card/80 transition-all duration-200",
      className
    )}>
      <CardContent className="p-4 flex flex-col gap-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarImage src={repo.avatarUrl} alt={repo.owner} />
              <AvatarFallback className="text-xs">{repo.owner[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{repo.owner}</p>
              <h3 className="font-mono font-medium text-sm truncate">{repo.name}</h3>
            </div>
          </div>
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="shrink-0 p-1 rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors opacity-0 group-hover:opacity-100"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Description */}
        <p className="mt-3 text-sm text-muted-foreground line-clamp-2 leading-relaxed min-h-[2.5rem]">
          {repo.description ?? "No description available"}
        </p>

        {/* Topics */}
        {repo.topics.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {repo.topics.slice(0, 4).map(topic => (
              <Badge key={topic} variant="secondary" className="text-xs px-1.5 py-0 h-5 font-normal">
                {topic}
              </Badge>
            ))}
          </div>
        )}

        {/* Evidence strip */}
        {repo.evidence.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/40 space-y-1">
            {repo.evidence.map((e, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground/70">
                <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5 text-emerald-500/60" />
                <span className="leading-tight">{e}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {langColor && (
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: langColor }} />
                <span>{repo.language}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              <span>{formatNumber(repo.stargazersCount)}</span>
            </div>
            <div className="flex items-center gap-1">
              <GitFork className="h-3 w-3" />
              <span>{formatNumber(repo.forksCount)}</span>
            </div>
          </div>

          <SearchStarPopover
            repo={repo}
            tags={tags}
            collections={collections}
            onStarred={onStarred}
          />
        </div>

        <p className="mt-1.5 text-[11px] text-muted-foreground/40">Updated {updatedAgo}</p>
      </CardContent>
    </Card>
  )
}
