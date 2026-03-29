"use client"

import { useState, useRef, useEffect } from "react"
import {
  Star, GitFork, AlertCircle, Clock, ExternalLink, X,
  Pin, FolderPlus, Tag as TagIcon, FileText, GitCommit,
  Scale, Globe, Github, Copy, Check, BookOpen, Plus, Loader2,
} from "lucide-react"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import { StarredRepo, STATUS_LABELS, RepoStatus, Collection, Tag } from "@/lib/types"
import { formatDistanceToNow, format } from "date-fns"
import { cn } from "@/lib/utils"

interface RepoDetailPanelProps {
  repo: StarredRepo | null
  open: boolean
  onClose: () => void
  onViewReadme: () => void
  collections: Collection[]
  tags: Tag[]
  onStatusChange?: (repo: StarredRepo, status: RepoStatus | null) => void
  onTagToggle?: (repo: StarredRepo, tagId: string) => void
  onTagCreate?: (repo: StarredRepo, label: string) => void
  onCollectionToggle?: (repo: StarredRepo, collectionId: string) => void
  onCollectionCreate?: (name: string, emoji: string, color: string) => void
  onNotesChange?: (repo: StarredRepo, notes: string) => void
  onPinToggle?: (repo: StarredRepo) => void
}

function formatNumber(num: number): string {
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k"
  return num.toString()
}

export function RepoDetailPanel({
  repo,
  open,
  onClose,
  onViewReadme,
  collections,
  tags,
  onStatusChange,
  onTagToggle,
  onTagCreate,
  onCollectionToggle,
  onCollectionCreate,
  onNotesChange,
  onPinToggle,
}: RepoDetailPanelProps) {
  const [notes, setNotes] = useState(repo?.notes || "")
  const [copied, setCopied] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false)
  const [collectionPopoverOpen, setCollectionPopoverOpen] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState("")
  const [newCollectionEmoji, setNewCollectionEmoji] = useState("📁")
  const [savingNotes, setSavingNotes] = useState(false)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync notes when repo changes
  useEffect(() => {
    setNotes(repo?.notes || "")
  }, [repo?.id, repo?.notes])

  if (!repo) return null

  const handleCopyClone = () => {
    navigator.clipboard.writeText(`git clone https://github.com/${repo.fullName}.git`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleNotesChange = (value: string) => {
    setNotes(value)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(async () => {
      setSavingNotes(true)
      await onNotesChange?.(repo, value)
      setSavingNotes(false)
    }, 800)
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      const label = tagInput.trim().toLowerCase()
      const existing = tags.find(t => t.label === label)
      if (existing) {
        onTagToggle?.(repo, existing.id)
      } else {
        onTagCreate?.(repo, label)
      }
      setTagInput("")
      setTagPopoverOpen(false)
    }
  }

  const handleCollectionCreate = () => {
    if (!newCollectionName.trim()) return
    onCollectionCreate?.(newCollectionName.trim(), newCollectionEmoji, "#64748b")
    setNewCollectionName("")
    setNewCollectionEmoji("📁")
  }

  const filteredTags = tags.filter(t =>
    !tagInput || t.label.toLowerCase().includes(tagInput.toLowerCase())
  )
  const unassignedTags = filteredTags.filter(t => !repo.tags.some(rt => rt.id === t.id))

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-full sm:max-w-lg p-0 border-l border-border overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="h-full overflow-y-auto overflow-x-hidden">
          <div className="p-6">
            <SheetHeader className="space-y-0 pb-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 pr-8">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={repo.avatarUrl} alt={repo.owner} />
                    <AvatarFallback>{repo.owner[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground truncate">{repo.owner}</p>
                    <SheetTitle className="font-mono text-lg truncate">{repo.name}</SheetTitle>
                    <SheetDescription className="sr-only">Repository details</SheetDescription>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              {repo.description || "No description available"}
            </p>

            {/* Quick Actions */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <a href={`https://github.com/${repo.fullName}`} target="_blank" rel="noopener noreferrer">
                  <Github className="h-3.5 w-3.5" />
                  View on GitHub
                </a>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onViewReadme}>
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
                onClick={() => onPinToggle?.(repo)}
                title={repo.isPinned ? "Unpin" : "Pin"}
              >
                <Pin className={cn("h-4 w-4", repo.isPinned && "fill-accent text-accent")} />
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center text-muted-foreground">
                  <Star className="h-4 w-4" />
                </div>
                <p className="mt-1 text-lg font-semibold">{formatNumber(repo.stargazersCount)}</p>
                <p className="text-xs text-muted-foreground">Stars</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center text-muted-foreground">
                  <GitFork className="h-4 w-4" />
                </div>
                <p className="mt-1 text-lg font-semibold">{formatNumber(repo.forksCount)}</p>
                <p className="text-xs text-muted-foreground">Forks</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center text-muted-foreground">
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
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground shrink-0">Language</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: repo.languageColor || "#64748b" }} />
                    <span className="truncate">{repo.language}</span>
                  </div>
                </div>
              )}
              {repo.license && (
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground shrink-0">License</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Scale className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{repo.license}</span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground shrink-0">Last Updated</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{formatDistanceToNow(new Date(repo.pushedAt), { addSuffix: true })}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground shrink-0">Starred</span>
                <span className="truncate text-right">{format(new Date(repo.starredAt), "MMM d, yyyy")}</span>
              </div>
            </div>

            {/* Clone */}
            <div className="mt-6 min-w-0">
              <p className="text-sm font-medium mb-2">Clone</p>
              <div className="flex items-center gap-2 min-w-0">
                <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md font-mono break-all min-w-0 block">
                  git clone https://github.com/{repo.fullName}.git
                </code>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopyClone}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* GitHub Topics */}
            {repo.topics.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-medium mb-2">Topics</p>
                <div className="flex flex-wrap gap-1.5">
                  {repo.topics.map((topic) => (
                    <Badge key={topic} variant="secondary" className="text-xs">{topic}</Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator className="my-6" />

            {/* Personal Organization */}
            <div className="space-y-5">
              <h3 className="text-sm font-medium">Your Organization</h3>

              {/* Status */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Status</label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => (
                    <button
                      key={key}
                      onClick={() => onStatusChange?.(repo, repo.status === key ? null : key as RepoStatus)}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-full border transition-all",
                        repo.status === key
                          ? color
                          : "border-border text-muted-foreground hover:border-muted-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Collections */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Collections</label>
                <div className="flex flex-wrap gap-1.5">
                  {repo.collections.map(colId => {
                    const col = collections.find(c => c.id === colId)
                    if (!col) return null
                    return (
                      <Badge
                        key={colId}
                        variant="secondary"
                        className="gap-1 cursor-pointer pr-1"
                        onClick={() => onCollectionToggle?.(repo, colId)}
                      >
                        {col.emoji} {col.name}
                        <X className="h-3 w-3 opacity-50 hover:opacity-100" />
                      </Badge>
                    )
                  })}
                  <Popover open={collectionPopoverOpen} onOpenChange={setCollectionPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Badge variant="outline" className="cursor-pointer text-xs gap-1 hover:bg-muted">
                        <FolderPlus className="h-3 w-3" />
                        Add
                      </Badge>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2" align="start">
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {collections.filter(c => !repo.collections.includes(c.id)).map(col => (
                          <button
                            key={col.id}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted text-left"
                            onClick={() => {
                              onCollectionToggle?.(repo, col.id)
                              setCollectionPopoverOpen(false)
                            }}
                          >
                            <span>{col.emoji}</span>
                            <span>{col.name}</span>
                          </button>
                        ))}
                        {collections.filter(c => !repo.collections.includes(c.id)).length === 0 && (
                          <p className="text-xs text-muted-foreground px-2 py-1">All collections assigned</p>
                        )}
                      </div>
                      <Separator className="my-2" />
                      <div className="flex gap-1.5">
                        <Input
                          placeholder="Emoji"
                          value={newCollectionEmoji}
                          onChange={e => setNewCollectionEmoji(e.target.value)}
                          className="w-14 text-center px-1"
                        />
                        <Input
                          placeholder="New collection"
                          value={newCollectionName}
                          onChange={e => setNewCollectionName(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && handleCollectionCreate()}
                          className="flex-1"
                        />
                        <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={handleCollectionCreate}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {repo.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className="text-xs border-0 gap-1 cursor-pointer pr-1"
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                      onClick={() => onTagToggle?.(repo, tag.id)}
                    >
                      {tag.label}
                      <X className="h-3 w-3 opacity-50 hover:opacity-100" />
                    </Badge>
                  ))}
                  <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Badge variant="outline" className="cursor-pointer text-xs gap-1 hover:bg-muted">
                        <TagIcon className="h-3 w-3" />
                        Add
                      </Badge>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="start">
                      <Input
                        autoFocus
                        placeholder="Search or create tag…"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={handleTagInputKeyDown}
                        className="mb-2"
                      />
                      <div className="space-y-0.5 max-h-40 overflow-y-auto">
                        {unassignedTags.map(tag => (
                          <button
                            key={tag.id}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted text-left"
                            onClick={() => {
                              onTagToggle?.(repo, tag.id)
                              setTagInput("")
                              setTagPopoverOpen(false)
                            }}
                          >
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                            {tag.label}
                          </button>
                        ))}
                        {tagInput.trim() && !tags.find(t => t.label === tagInput.trim().toLowerCase()) && (
                          <button
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted text-left text-muted-foreground"
                            onClick={() => {
                              onTagCreate?.(repo, tagInput.trim())
                              setTagInput("")
                              setTagPopoverOpen(false)
                            }}
                          >
                            <Plus className="h-3 w-3" />
                            Create &quot;{tagInput.trim()}&quot;
                          </button>
                        )}
                        {filteredTags.length === 0 && !tagInput.trim() && (
                          <p className="text-xs text-muted-foreground px-2 py-1">No tags yet. Type to create one.</p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Notes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted-foreground">Notes</label>
                  {savingNotes && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
                <Textarea
                  placeholder="Add your personal notes about this repo..."
                  value={notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1.5">Saves automatically</p>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Quick Links */}
            <div>
              <h3 className="text-sm font-medium mb-3">Quick Links</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="justify-start gap-2" asChild>
                  <a href={`https://github.com/${repo.fullName}/issues`} target="_blank" rel="noopener noreferrer">
                    <AlertCircle className="h-3.5 w-3.5" />Issues
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="justify-start gap-2" asChild>
                  <a href={`https://github.com/${repo.fullName}/pulls`} target="_blank" rel="noopener noreferrer">
                    <GitCommit className="h-3.5 w-3.5" />Pull Requests
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="justify-start gap-2" asChild>
                  <a href={`https://github.com/${repo.fullName}/releases`} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-3.5 w-3.5" />Releases
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="justify-start gap-2" asChild>
                  <a href={`https://github.com/${repo.fullName}#readme`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />README
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
