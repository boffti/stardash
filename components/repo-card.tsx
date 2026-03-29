"use client"

import { Star, GitFork, Clock, Pin, StickyNote, FolderPlus, MoreHorizontal } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StarredRepo, STATUS_LABELS } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { useDraggable } from "@dnd-kit/core"

interface RepoCardProps {
  repo: StarredRepo
  onClick: () => void
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k"
  }
  return num.toString()
}

export function RepoCard({ repo, onClick }: RepoCardProps) {
  const statusConfig = repo.status ? STATUS_LABELS[repo.status] : null
  const [timeString, setTimeString] = useState("recently")
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: repo.id })

  useEffect(() => {
    setTimeString(formatDistanceToNow(new Date(repo.pushedAt), { addSuffix: true }))
  }, [repo.pushedAt])

  return (
    <div ref={setNodeRef} className={cn(isDragging && "opacity-40")}>
    <Card
      className={cn(
        "group relative cursor-pointer transition-all duration-200 h-full py-0",
        "hover:border-muted-foreground/30 hover:bg-card/80",
        "border-border bg-card"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarImage src={repo.avatarUrl} alt={repo.owner} />
              <AvatarFallback className="text-xs">
                {repo.owner[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{repo.owner}</p>
              <h3 className="font-mono font-medium text-sm truncate">{repo.name}</h3>
            </div>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            {repo.isPinned && (
              <Pin className="h-3 w-3 text-accent fill-accent" />
            )}
            <button
              {...listeners}
              {...attributes}
              onClick={e => e.stopPropagation()}
              className="h-6 w-6 opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground"
              aria-label="Drag to assign"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="5" cy="4" r="1.5"/><circle cx="11" cy="4" r="1.5"/>
                <circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>
                <circle cx="5" cy="12" r="1.5"/><circle cx="11" cy="12" r="1.5"/>
              </svg>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem>
                  <StickyNote className="mr-2 h-4 w-4" />
                  Add Note
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Add to Collection
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Pin className="mr-2 h-4 w-4" />
                  {repo.isPinned ? "Unpin" : "Pin"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  Remove Star
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Description - fixed height area */}
        <div className="mt-3 flex-1 min-h-[2.75rem]">
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {repo.description || "No description available"}
          </p>
        </div>

        {/* Tags + Topics */}
        <div className="mt-3 min-h-5">
          {(repo.tags.length > 0 || repo.topics.length > 0) && (
            <div className="flex flex-wrap gap-1">
              {repo.tags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="text-xs px-1.5 py-0 h-5 border-0"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                  }}
                >
                  {tag.label}
                </Badge>
              ))}
              {repo.topics.slice(0, 3 - Math.min(repo.tags.length, 3)).map((topic) => (
                <Badge
                  key={topic}
                  variant="secondary"
                  className="text-xs px-1.5 py-0 h-5 font-normal"
                >
                  {topic}
                </Badge>
              ))}
              {repo.tags.length + repo.topics.length > 3 && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                  +{repo.tags.length + repo.topics.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Footer - always at bottom */}
        <div className="mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {repo.language && (
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: repo.languageColor || "#64748b" }}
                  />
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

            {statusConfig && (
              <Badge
                variant="outline"
                className={cn("text-xs px-1.5 py-0 h-5", statusConfig.color)}
              >
                {statusConfig.label}
              </Badge>
            )}
          </div>

          {/* Last Updated */}
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground/60">
            <Clock className="h-3 w-3" />
            <span>Updated {timeString}</span>
          </div>
        </div>
      </CardContent>
    </Card>
    </div>
  )
}
