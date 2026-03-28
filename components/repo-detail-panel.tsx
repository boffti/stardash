"use client"

import { useState } from "react"
import {
  Star,
  GitFork,
  Eye,
  AlertCircle,
  Clock,
  ExternalLink,
  X,
  Pin,
  FolderPlus,
  Tag as TagIcon,
  FileText,
  GitCommit,
  Scale,
  Globe,
  Github,
  Copy,
  Check,
  BookOpen,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StarredRepo, STATUS_LABELS, RepoStatus, Collection, Tag } from "@/lib/types"
import { formatDistanceToNow, format } from "date-fns"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

interface RepoDetailPanelProps {
  repo: StarredRepo | null
  open: boolean
  onClose: () => void
  onViewReadme: () => void
  collections: Collection[]
  tags: Tag[]
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k"
  }
  return num.toString()
}

export function RepoDetailPanel({
  repo,
  open,
  onClose,
  onViewReadme,
  collections,
  tags,
}: RepoDetailPanelProps) {
  const [notes, setNotes] = useState(repo?.notes || "")
  const [copied, setCopied] = useState(false)

  if (!repo) return null

  const statusConfig = repo.status ? STATUS_LABELS[repo.status] : null

  const handleCopyClone = () => {
    navigator.clipboard.writeText(`git clone https://github.com/${repo.fullName}.git`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg p-0 border-l border-border">
        <ScrollArea className="h-full">
          <div className="p-6">
            <SheetHeader className="space-y-0 pb-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={repo.avatarUrl} alt={repo.owner} />
                    <AvatarFallback>
                      {repo.owner[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{repo.owner}</p>
                    <SheetTitle className="font-mono text-lg truncate">
                      {repo.name}
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                      Repository details and organization options
                    </SheetDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </SheetHeader>

            {/* Description */}
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              {repo.description || "No description available"}
            </p>

            {/* Quick Actions */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <a
                  href={`https://github.com/${repo.fullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="h-3.5 w-3.5" />
                  View on GitHub
                </a>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5"
                onClick={onViewReadme}
              >
                <BookOpen className="h-3.5 w-3.5" />
                View README
              </Button>
              {repo.homepage && (
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href={repo.homepage} target="_blank" rel="noopener noreferrer">
                    <Globe className="h-3.5 w-3.5" />
                    Homepage
                  </a>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
              >
                <Pin className={cn("h-4 w-4", repo.isPinned && "fill-accent text-accent")} />
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-6 grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <Star className="h-4 w-4" />
                </div>
                <p className="mt-1 text-lg font-semibold">{formatNumber(repo.stargazersCount)}</p>
                <p className="text-xs text-muted-foreground">Stars</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <GitFork className="h-4 w-4" />
                </div>
                <p className="mt-1 text-lg font-semibold">{formatNumber(repo.forksCount)}</p>
                <p className="text-xs text-muted-foreground">Forks</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <Eye className="h-4 w-4" />
                </div>
                <p className="mt-1 text-lg font-semibold">--</p>
                <p className="text-xs text-muted-foreground">Watchers</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <p className="mt-1 text-lg font-semibold">{formatNumber(repo.openIssuesCount)}</p>
                <p className="text-xs text-muted-foreground">Issues</p>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Meta Info */}
            <div className="space-y-3">
              {repo.language && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Language</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: repo.languageColor || "#64748b" }}
                    />
                    <span>{repo.language}</span>
                  </div>
                </div>
              )}
              {repo.license && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">License</span>
                  <div className="flex items-center gap-1.5">
                    <Scale className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{repo.license}</span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last Updated</span>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{formatDistanceToNow(new Date(repo.pushedAt), { addSuffix: true })}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Starred</span>
                <span>{format(new Date(repo.starredAt), "MMM d, yyyy")}</span>
              </div>
            </div>

            {/* Clone URL */}
            <div className="mt-6">
              <p className="text-sm font-medium mb-2">Clone</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md font-mono truncate">
                  git clone https://github.com/{repo.fullName}.git
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleCopyClone}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* GitHub Topics */}
            {repo.topics.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-medium mb-2">Topics</p>
                <div className="flex flex-wrap gap-1.5">
                  {repo.topics.map((topic) => (
                    <Badge key={topic} variant="secondary" className="text-xs">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator className="my-6" />

            {/* Personal Organization */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Your Organization</h3>

              {/* Status */}
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Status</label>
                <Select defaultValue={repo.status || "none"}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Set status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Status</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Collections */}
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Collections</label>
                <div className="flex flex-wrap gap-1.5">
                  {collections.map((collection) => {
                    const isActive = repo.collections.includes(collection.id)
                    return (
                      <Badge
                        key={collection.id}
                        variant={isActive ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer text-xs",
                          isActive && "bg-accent text-accent-foreground"
                        )}
                      >
                        {collection.emoji} {collection.name}
                      </Badge>
                    )
                  })}
                  <Badge variant="outline" className="cursor-pointer text-xs gap-1">
                    <FolderPlus className="h-3 w-3" />
                    Add
                  </Badge>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {repo.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className="text-xs border-0"
                      style={{
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                      }}
                    >
                      {tag.label}
                    </Badge>
                  ))}
                  <Badge variant="outline" className="cursor-pointer text-xs gap-1">
                    <TagIcon className="h-3 w-3" />
                    Add
                  </Badge>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Notes</label>
                <Textarea
                  placeholder="Add your personal notes about this repo..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Markdown supported
                </p>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Quick Links */}
            <div>
              <h3 className="text-sm font-medium mb-3">Quick Links</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="justify-start gap-2" asChild>
                  <a
                    href={`https://github.com/${repo.fullName}/issues`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    Issues
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="justify-start gap-2" asChild>
                  <a
                    href={`https://github.com/${repo.fullName}/pulls`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <GitCommit className="h-3.5 w-3.5" />
                    Pull Requests
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="justify-start gap-2" asChild>
                  <a
                    href={`https://github.com/${repo.fullName}/releases`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Releases
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="justify-start gap-2" asChild>
                  <a
                    href={`https://github.com/${repo.fullName}#readme`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    README
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
