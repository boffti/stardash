"use client"

import { useDraggable } from "@dnd-kit/core"
import { Star, Pin } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { StarredRepo } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"

interface RepoListProps {
  repos: StarredRepo[]
  onRepoClick: (repo: StarredRepo) => void
}

function formatNumber(num: number) {
  return num >= 1000 ? `${(num / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(num)
}

export function RepoList({ repos, onRepoClick }: RepoListProps) {
  const { t } = useI18n()
  if (!repos.length) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        {t("No repositories found", "没有找到仓库")}
      </div>
    )
  }
  return (
    <div className="divide-y divide-border/70 border-y border-border/70">
      {repos.map((repo) => (
        <RepoRow key={repo.id} repo={repo} onRepoClick={onRepoClick} />
      ))}
    </div>
  )
}

function RepoRow({
  repo,
  onRepoClick,
}: {
  repo: StarredRepo
  onRepoClick: (repo: StarredRepo) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: repo.id })
  const { t } = useI18n()
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative flex items-start gap-3 py-4 transition-colors hover:bg-muted/30",
        isDragging && "opacity-40",
      )}
    >
      <button
        {...listeners}
        {...attributes}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 cursor-grab p-1 text-muted-foreground/40 hover:text-foreground active:cursor-grabbing"
        aria-label={t("Drag to assign", "拖动以归类")}
      >
        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="4" r="1.5" />
          <circle cx="11" cy="4" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="11" cy="12" r="1.5" />
        </svg>
      </button>
      <Avatar className="mt-0.5 h-8 w-8 shrink-0 rounded-md">
        <AvatarImage src={repo.avatarUrl} alt="" />
        <AvatarFallback className="rounded-md text-xs">
          {repo.owner[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <button
        type="button"
        onClick={() => onRepoClick(repo)}
        className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
      >
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <span className="truncate">
            <span className="text-muted-foreground">{repo.owner} / </span>
            {repo.name}
          </span>
          {repo.isPinned && <Pin className="h-3 w-3 shrink-0 text-foreground" />}
        </span>
        {repo.description && (
          <span className="mt-1 block line-clamp-1 text-sm text-muted-foreground">
            {repo.description}
          </span>
        )}
        <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {repo.language && (
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: repo.languageColor || "#64748b" }}
              />
              {repo.language}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            {formatNumber(repo.stargazersCount)}
          </span>
          {repo.tags.slice(0, 2).map((tag) => (
            <span key={tag.id}>{tag.label}</span>
          ))}
        </span>
      </button>
    </div>
  )
}
