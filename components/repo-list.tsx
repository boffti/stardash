"use client"

import { Star, GitFork, Clock, Pin, ExternalLink } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { StarredRepo, STATUS_LABELS } from "@/lib/types"
import { formatDistanceToNow, format } from "date-fns"
import { cn } from "@/lib/utils"
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Inbox } from "lucide-react"

interface RepoListProps {
  repos: StarredRepo[]
  onRepoClick: (repo: StarredRepo) => void
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k"
  }
  return num.toString()
}

export function RepoList({ repos, onRepoClick }: RepoListProps) {
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
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="w-[35%]">Repository</TableHead>
            <TableHead className="w-[12%]">Language</TableHead>
            <TableHead className="w-[8%] text-right">Stars</TableHead>
            <TableHead className="w-[15%]">Last Updated</TableHead>
            <TableHead className="w-[12%]">Date Starred</TableHead>
            <TableHead className="w-[10%]">Status</TableHead>
            <TableHead className="w-[8%]">Tags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {repos.map((repo) => {
            const statusConfig = repo.status ? STATUS_LABELS[repo.status] : null
            return (
              <TableRow
                key={repo.id}
                className="cursor-pointer border-border hover:bg-muted/50"
                onClick={() => onRepoClick(repo)}
              >
                <TableCell className="py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage src={repo.avatarUrl} alt={repo.owner} />
                      <AvatarFallback className="text-xs">
                        {repo.owner[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm font-medium truncate">
                          {repo.owner}/{repo.name}
                        </span>
                        {repo.isPinned && (
                          <Pin className="h-3 w-3 text-accent fill-accent shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  {repo.language && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: repo.languageColor || "#64748b" }}
                      />
                      <span className="text-sm">{repo.language}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1 text-sm">
                    <Star className="h-3 w-3 text-muted-foreground" />
                    <span>{formatNumber(repo.stargazersCount)}</span>
                  </div>
                </TableCell>
                <TableCell className="py-3 text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(repo.pushedAt), { addSuffix: true })}
                </TableCell>
                <TableCell className="py-3 text-sm text-muted-foreground">
                  {format(new Date(repo.starredAt), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="py-3">
                  {statusConfig && (
                    <Badge
                      variant="outline"
                      className={cn("text-xs", statusConfig.color)}
                    >
                      {statusConfig.label}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {repo.tags.slice(0, 2).map((tag) => (
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
                    {repo.tags.length > 2 && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                        +{repo.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
