"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import {
  Star, GitFork, AlertCircle, Clock, ExternalLink,
  X, Pin, FolderPlus, Tag as TagIcon, FileText, GitCommit,
  Scale, Globe, Github, Copy, Check, Plus, Loader2,
  ChevronLeft, AlertTriangle, Zap, Play, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { RepoIntelTab } from "@/components/repo-intel-tab"
import { StarredRepo, STATUS_LABELS, RepoStatus, UserMetadata } from "@/lib/types"
import { useStarredRepos } from "@/lib/use-starred-repos"
import { setCachedRepos } from "@/lib/repo-cache"
import { createClient } from "@/lib/supabase/client"
import {
  updateRepoStatus, updateRepoNotes, togglePin,
  createTag, assignTag, removeTag,
  createCollection, assignCollection, removeCollection,
  pickTagColor,
} from "@/lib/user-metadata"
import { formatDistanceToNow, format } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import type { User } from "@supabase/supabase-js"
import type { ContributionOpportunity } from "@/lib/contribution-opportunities"

interface RepoDetailPageProps {
  user: User | null
  owner: string
  repo: string
}

function formatNumber(num: number): string {
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k"
  return num.toString()
}

function resolveImageUrl(src: string | undefined, owner: string, repoName: string): string {
  if (!src) return ""
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) return src
  const path = src.startsWith("/") ? src.slice(1) : src.startsWith("./") ? src.slice(2) : src
  return `https://raw.githubusercontent.com/${owner}/${repoName}/HEAD/${path}`
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  children,
  collapsible = false,
  defaultOpen = true,
  action,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  action?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 border-b border-border/40",
          collapsible && "cursor-pointer hover:bg-muted/30 transition-colors"
        )}
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {action}
          {collapsible && (
            open
              ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </div>
      {(!collapsible || open) && <div className="px-4 py-4">{children}</div>}
    </div>
  )
}

// ─── README ───────────────────────────────────────────────────────────────────

function ReadmeSection({
  owner,
  repoName,
  cachedReadme,
  onReadmeLoaded,
}: {
  owner: string
  repoName: string
  cachedReadme: string | null
  onReadmeLoaded?: (readme: string) => void
}) {
  const shouldFetch = cachedReadme == null
  const { data, isLoading } = useSWR<{ readme: string | null; error?: string }>(
    shouldFetch ? `/api/github/readme?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repoName)}` : null,
    async (url: string) => {
      const response = await fetch(url)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Failed to fetch README")
      return body
    },
    { revalidateOnFocus: false }
  )

  const content = cachedReadme ?? data?.readme

  useEffect(() => {
    if (data?.readme) onReadmeLoaded?.(data.readme)
  }, [data?.readme, onReadmeLoaded])

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    )
  }

  if (!content) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No README available.
      </p>
    )
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none
      prose-headings:font-semibold prose-headings:text-foreground prose-headings:mt-6 prose-headings:mb-3
      prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:my-2
      prose-code:text-accent prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
      prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0 prose-pre:my-3
      prose-a:text-accent prose-a:no-underline hover:prose-a:underline
      prose-strong:text-foreground
      prose-blockquote:border-l-2 prose-blockquote:border-accent/30 prose-blockquote:text-muted-foreground prose-blockquote:not-italic
      prose-li:text-muted-foreground prose-li:my-0.5
      prose-img:rounded-lg prose-img:max-w-full prose-img:my-3
      prose-hr:border-border/40 prose-hr:my-6
      prose-table:text-sm prose-th:text-foreground prose-td:text-muted-foreground
      prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
    ">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          code({ className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "")
            const isInline = !match
            if (isInline) return <code className={className} {...props}>{children}</code>
            return (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                customStyle={{ borderRadius: "0.5rem", fontSize: "0.75rem", margin: 0 }}
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            )
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          img({ src, alt }: any) {
            const resolved = resolveImageUrl(src as string | undefined, owner, repoName)
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={resolved} alt={alt ?? ""} className="rounded-lg max-w-full" />
          },
          a({ href, children }) {
            return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

// ─── Intel section ────────────────────────────────────────────────────────────

function IntelSection({ owner, repoName }: { owner: string; repoName: string }) {
  const [triggered, setTriggered] = useState(false)

  if (!triggered) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
          AI-powered analysis of health, maintenance, sentiment, and adoption readiness.
        </p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTriggered(true)}>
          <Play className="h-3.5 w-3.5" />
          Run Analysis
        </Button>
      </div>
    )
  }

  return <RepoIntelTab owner={owner} name={repoName} />
}

// ─── Contributions section ────────────────────────────────────────────────────

const CONTRIBUTION_CACHE_PREFIX = "stardash-contribution-opportunities-v2"

function ContributionsSection({ owner, repoName, userId }: { owner: string; repoName: string; userId?: string }) {
  const fullName = `${owner}/${repoName}`
  const [opportunities, setOpportunities] = useState<ContributionOpportunity[] | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (!userId || typeof window === "undefined") return
    const task = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(`${CONTRIBUTION_CACHE_PREFIX}-${userId}`)
        if (!raw) { setOpportunities([]); return }
        const parsed = JSON.parse(raw) as { opportunities: ContributionOpportunity[] }
        setOpportunities(parsed.opportunities.filter(o => o.repoFullName === fullName))
      } catch { setOpportunities([]) }
    }, 0)
    return () => window.clearTimeout(task)
  }, [userId, fullName])

  if (opportunities === null) {
    return (
      <div className="space-y-2 py-2">
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
      </div>
    )
  }

  if (opportunities.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
          Scans open issues for beginner-friendly contribution opportunities.
        </p>
        <Button size="sm" variant="outline" className="gap-1.5" asChild>
          <a href="/contribute">
            <RefreshCw className="h-3.5 w-3.5" />
            Scan All Repos
          </a>
        </Button>
      </div>
    )
  }

  const visible = showAll ? opportunities : opportunities.slice(0, 3)

  return (
    <div className="space-y-2">
      {visible.map(opp => (
        <MiniContribCard key={opp.id} opp={opp} />
      ))}
      {opportunities.length > 3 && (
        <button
          className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 transition-colors"
          onClick={() => setShowAll(s => !s)}
        >
          {showAll ? "Show less" : `+${opportunities.length - 3} more`}
        </button>
      )}
    </div>
  )
}

function MiniContribCard({ opp }: { opp: ContributionOpportunity }) {
  const scoreTone =
    opp.score >= 80 ? "text-emerald-400" : opp.score >= 60 ? "text-sky-400" : "text-amber-400"

  return (
    <a
      href={opp.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-md border border-border/50 bg-background/40 px-3 py-2.5 hover:border-border hover:bg-muted/30 transition-all group"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-snug line-clamp-2 flex-1">{opp.title}</p>
        <span className={cn("text-xs font-mono shrink-0 font-semibold", scoreTone)}>{opp.score}%</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border/40 text-muted-foreground">
          {opp.difficulty}
        </Badge>
        {opp.contributionTypes.slice(0, 1).map(t => (
          <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{t}</Badge>
        ))}
        <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </a>
  )
}

// ─── Organize section ─────────────────────────────────────────────────────────

interface OrganizeSectionProps {
  repo: StarredRepo
  collections: NonNullable<UserMetadata["collections"]>
  tags: NonNullable<UserMetadata["tags"]>
  onStatusChange: (status: RepoStatus | null) => void
  onPinToggle: () => void
  onTagToggle: (tagId: string) => void
  onTagCreate: (label: string) => void
  onCollectionToggle: (collectionId: string) => void
  onCollectionCreate: (name: string, emoji: string, color: string) => void
  onNotesChange: (notes: string) => void
}

function OrganizeSection({
  repo, collections, tags,
  onStatusChange, onPinToggle, onTagToggle, onTagCreate,
  onCollectionToggle, onCollectionCreate, onNotesChange,
}: OrganizeSectionProps) {
  const [notes, setNotes] = useState(repo.notes || "")
  const [savingNotes, setSavingNotes] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false)
  const [collectionPopoverOpen, setCollectionPopoverOpen] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState("")
  const [newCollectionEmoji, setNewCollectionEmoji] = useState("📁")
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const task = window.setTimeout(() => setNotes(repo.notes || ""), 0)
    return () => window.clearTimeout(task)
  }, [repo.id, repo.notes])
  useEffect(() => () => { if (notesTimer.current) clearTimeout(notesTimer.current) }, [])

  const handleNotesChange = (value: string) => {
    setNotes(value)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(async () => {
      setSavingNotes(true); await onNotesChange(value); setSavingNotes(false)
    }, 800)
  }

  const flushNotes = async (value: string) => {
    if (notesTimer.current) { clearTimeout(notesTimer.current); notesTimer.current = null }
    setSavingNotes(true); await onNotesChange(value); setSavingNotes(false)
  }

  const handleTagKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !tagInput.trim()) return
    const label = tagInput.trim().toLowerCase()
    const existing = tags.find(t => t.label === label)
    if (existing) onTagToggle(existing.id)
    else onTagCreate(label)
    setTagInput(""); setTagPopoverOpen(false)
  }

  const filteredTags = tags.filter(t => !tagInput || t.label.toLowerCase().includes(tagInput.toLowerCase()))
  const unassignedTags = filteredTags.filter(t => !repo.tags.some(rt => rt.id === t.id))

  return (
    <div className="space-y-4">
      {/* Pin */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Pinned</span>
        <button
          onClick={onPinToggle}
          className={cn(
            "flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all",
            repo.isPinned
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-border text-muted-foreground hover:border-muted-foreground"
          )}
        >
          <Pin className={cn("h-3 w-3", repo.isPinned && "fill-accent")} />
          {repo.isPinned ? "Pinned" : "Pin"}
        </button>
      </div>

      <Separator className="opacity-50" />

      {/* Status */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Status</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => (
            <button
              key={key}
              onClick={() => onStatusChange(repo.status === key ? null : key as RepoStatus)}
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

      <Separator className="opacity-50" />

      {/* Collections */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Collections</p>
        <div className="flex flex-wrap gap-1.5">
          {repo.collections.map(colId => {
            const col = collections.find(c => c.id === colId)
            if (!col) return null
            return (
              <Badge key={colId} variant="secondary" className="gap-1 cursor-pointer pr-1 text-xs" onClick={() => onCollectionToggle(colId)}>
                {col.emoji} {col.name}<X className="h-2.5 w-2.5 opacity-50 hover:opacity-100" />
              </Badge>
            )
          })}
          <Popover open={collectionPopoverOpen} onOpenChange={setCollectionPopoverOpen}>
            <PopoverTrigger asChild>
              <Badge variant="outline" className="cursor-pointer text-xs gap-1 hover:bg-muted">
                <FolderPlus className="h-3 w-3" />Add
              </Badge>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-2" align="start">
              <div className="space-y-0.5 max-h-44 overflow-y-auto">
                {collections.filter(c => !repo.collections.includes(c.id)).map(col => (
                  <button key={col.id} className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted text-left"
                    onClick={() => { onCollectionToggle(col.id); setCollectionPopoverOpen(false) }}>
                    <span>{col.emoji}</span><span>{col.name}</span>
                  </button>
                ))}
                {collections.filter(c => !repo.collections.includes(c.id)).length === 0 && (
                  <p className="text-xs text-muted-foreground px-2 py-1">All collections assigned</p>
                )}
              </div>
              <Separator className="my-2" />
              <div className="flex gap-1.5">
                <Input placeholder="📁" value={newCollectionEmoji} onChange={e => setNewCollectionEmoji(e.target.value)} className="w-12 text-center px-1" />
                <Input placeholder="New collection" value={newCollectionName}
                  onChange={e => setNewCollectionName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && newCollectionName.trim()) { onCollectionCreate(newCollectionName.trim(), newCollectionEmoji, "#64748b"); setNewCollectionName(""); setNewCollectionEmoji("📁") } }}
                  className="flex-1" />
                <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0"
                  onClick={() => { if (!newCollectionName.trim()) return; onCollectionCreate(newCollectionName.trim(), newCollectionEmoji, "#64748b"); setNewCollectionName(""); setNewCollectionEmoji("📁") }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Tags */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Tags</p>
        <div className="flex flex-wrap gap-1.5">
          {repo.tags.map(tag => (
            <Badge key={tag.id} variant="outline" className="text-xs border-0 gap-1 cursor-pointer pr-1"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
              onClick={() => onTagToggle(tag.id)}>
              {tag.label}<X className="h-2.5 w-2.5 opacity-50 hover:opacity-100" />
            </Badge>
          ))}
          <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
            <PopoverTrigger asChild>
              <Badge variant="outline" className="cursor-pointer text-xs gap-1 hover:bg-muted">
                <TagIcon className="h-3 w-3" />Add
              </Badge>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2" align="start">
              <Input autoFocus placeholder="Search or create tag…" value={tagInput}
                onChange={e => setTagInput(e.target.value)} onKeyDown={handleTagKey} className="mb-2" />
              <div className="space-y-0.5 max-h-36 overflow-y-auto">
                {unassignedTags.map(tag => (
                  <button key={tag.id} className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted text-left"
                    onClick={() => { onTagToggle(tag.id); setTagPopoverOpen(false) }}>
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />{tag.label}
                  </button>
                ))}
                {tagInput.trim() && !tags.find(t => t.label === tagInput.trim().toLowerCase()) && (
                  <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted text-left text-muted-foreground"
                    onClick={() => { onTagCreate(tagInput.trim()); setTagInput(""); setTagPopoverOpen(false) }}>
                    <Plus className="h-3 w-3" />Create &quot;{tagInput.trim()}&quot;
                  </button>
                )}
                {filteredTags.length === 0 && !tagInput.trim() && (
                  <p className="text-xs text-muted-foreground px-2 py-1">No tags yet.</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Notes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground">Notes</p>
          {savingNotes && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <Textarea placeholder="Add personal notes…" value={notes}
          onChange={e => handleNotesChange(e.target.value)}
          onBlur={() => flushNotes(notes)}
          className="min-h-[90px] resize-none text-sm" />
        <p className="text-[10px] text-muted-foreground mt-1">Saves automatically</p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function RepoDetailPage({ user, owner, repo: repoName }: RepoDetailPageProps) {
  const router = useRouter()
  const supabase = createClient()
  const [copied, setCopied] = useState(false)
  const userId = user?.id

  const { data: reposData, isLoading: reposLoading, mutate: mutateRepos } = useStarredRepos(userId)
  const { data: metadata, mutate: mutateMetadata } = useSWR<UserMetadata>(
    user?.id ? "/api/user/metadata" : null,
    (url: string) => fetch(url).then(r => r.json()),
    { revalidateOnFocus: false }
  )

  const rawRepo = useMemo(() =>
    reposData?.repos.find(r => r.fullName === `${owner}/${repoName}`) ?? null,
    [reposData, owner, repoName]
  )

  const repo = useMemo((): StarredRepo | null => {
    if (!rawRepo) return null
    const dbMeta = metadata?.repoMeta[rawRepo.id]
    if (!dbMeta) return rawRepo
    const dbTags = (metadata?.tags ?? []).filter(t => dbMeta.tagIds.includes(t.id))
    return {
      ...rawRepo,
      status: dbMeta.status ?? rawRepo.status,
      isPinned: dbMeta.isPinned,
      notes: dbMeta.notes ?? rawRepo.notes,
      tags: dbTags,
      collections: dbMeta.collectionIds,
    }
  }, [rawRepo, metadata])

  const collections = metadata?.collections ?? []
  const allTags = metadata?.tags ?? []

  const handleReadmeLoaded = useCallback((readme: string) => {
    if (!userId) return

    mutateRepos(prev => {
      if (!prev) return prev

      const targetFullName = `${owner}/${repoName}`
      const repos = prev.repos.map(item =>
        item.fullName === targetFullName ? { ...item, readme } : item
      )

      setCachedRepos(userId, repos)
      return { ...prev, repos }
    }, { revalidate: false })
  }, [mutateRepos, owner, repoName, userId])

  // ── Mutations ─────────────────────────────────────────────────────────────

  const buildRepoMetaEntry = (
    prev: UserMetadata | undefined,
    repoId: string,
    dbId: string,
    overrides: Partial<{ status: RepoStatus | null; isPinned: boolean; notes: string | null; tagIds: string[]; collectionIds: string[] }> = {}
  ): UserMetadata => ({
    tags: prev?.tags ?? [],
    collections: prev?.collections ?? [],
    repoMeta: {
      ...(prev?.repoMeta ?? {}),
      [repoId]: {
        dbId,
        status: overrides.status ?? prev?.repoMeta?.[repoId]?.status ?? null,
        isPinned: overrides.isPinned ?? prev?.repoMeta?.[repoId]?.isPinned ?? false,
        notes: overrides.notes ?? prev?.repoMeta?.[repoId]?.notes ?? null,
        tagIds: overrides.tagIds ?? prev?.repoMeta?.[repoId]?.tagIds ?? [],
        collectionIds: overrides.collectionIds ?? prev?.repoMeta?.[repoId]?.collectionIds ?? [],
      },
    },
  })

  const getDbId = async (r: StarredRepo): Promise<string> => {
    const existing = metadata?.repoMeta[r.id]?.dbId
    if (existing) return existing
    const response = await fetch(`/api/user/repo-id?githubRepoId=${r.id}`)
    if (!response.ok) throw new Error("Repo metadata missing. Refresh your stars and try again.")
    const { dbId } = await response.json()
    mutateMetadata(prev => buildRepoMetaEntry(prev, r.id, dbId), { revalidate: false })
    return dbId
  }

  const handleStatusChange = async (status: RepoStatus | null) => {
    if (!repo) return
    try {
      const dbId = await getDbId(repo)
      mutateMetadata(prev => buildRepoMetaEntry(prev, repo.id, dbId, { status }), { revalidate: false })
      await updateRepoStatus(supabase, dbId, status)
    } catch { mutateMetadata(); toast.error("Failed to update status") }
  }

  const handlePinToggle = async () => {
    if (!repo) return
    try {
      const dbId = await getDbId(repo)
      const isPinned = !(metadata?.repoMeta[repo.id]?.isPinned ?? repo.isPinned)
      mutateMetadata(prev => buildRepoMetaEntry(prev, repo.id, dbId, { isPinned }), { revalidate: false })
      await togglePin(supabase, dbId, isPinned)
    } catch { mutateMetadata(); toast.error("Failed to update pin") }
  }

  const handleTagToggle = async (tagId: string) => {
    if (!repo || !user?.id) return
    try {
      const dbId = await getDbId(repo)
      const current = metadata?.repoMeta[repo.id]?.tagIds ?? []
      const isAssigned = current.includes(tagId)
      const newTagIds = isAssigned ? current.filter(id => id !== tagId) : [...current, tagId]
      mutateMetadata(prev => buildRepoMetaEntry(prev, repo.id, dbId, { tagIds: newTagIds }), { revalidate: false })
      if (isAssigned) await removeTag(supabase, dbId, user.id, tagId)
      else await assignTag(supabase, dbId, user.id, tagId)
    } catch { mutateMetadata(); toast.error("Failed to update tag") }
  }

  const handleTagCreate = async (label: string) => {
    if (!repo || !user?.id) return
    try {
      const newTag = await createTag(supabase, user.id, label, pickTagColor(label))
      const dbId = await getDbId(repo)
      await assignTag(supabase, dbId, user.id, newTag.id)
      mutateMetadata()
    } catch (err) {
      const msg = (err as Error).message
      toast.error(msg.includes("unique") ? "Tag already exists" : "Failed to create tag")
    }
  }

  const handleCollectionToggle = async (collectionId: string) => {
    if (!repo || !user?.id) return
    try {
      const dbId = await getDbId(repo)
      const current = metadata?.repoMeta[repo.id]?.collectionIds ?? []
      const isAssigned = current.includes(collectionId)
      const newCollectionIds = isAssigned ? current.filter(id => id !== collectionId) : [...current, collectionId]
      mutateMetadata(prev => buildRepoMetaEntry(prev, repo.id, dbId, { collectionIds: newCollectionIds }), { revalidate: false })
      if (isAssigned) await removeCollection(supabase, dbId, user.id, collectionId)
      else await assignCollection(supabase, dbId, user.id, collectionId)
    } catch { mutateMetadata(); toast.error("Failed to update collection") }
  }

  const handleCollectionCreate = async (name: string, emoji: string, color: string) => {
    if (!user?.id) return
    try {
      await createCollection(supabase, user.id, name, emoji, color)
      mutateMetadata()
    } catch (err) {
      const msg = (err as Error).message
      toast.error(msg.includes("unique") ? "Collection already exists" : "Failed to create collection")
    }
  }

  const handleNotesChange = async (notes: string) => {
    if (!repo) return
    try {
      const dbId = await getDbId(repo)
      await updateRepoNotes(supabase, dbId, notes)
      mutateMetadata(prev => buildRepoMetaEntry(prev, repo.id, dbId, { notes }), { revalidate: false })
    } catch { toast.error("Failed to save notes") }
  }

  const handleCopyClone = () => {
    if (!repo) return
    navigator.clipboard.writeText(`git clone https://github.com/${repo.fullName}.git`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Loading / not found states ────────────────────────────────────────────

  const sidebarProps = {
    collections, tags: allTags, selectedCollection: null, selectedTag: null,
    showUncategorized: false, onSelectCollection: () => {}, onSelectTag: () => {},
    onShowUncategorized: () => {}, totalStars: reposData?.repos.length ?? 0,
    uncategorizedCount: 0, userId: user?.id,
  }

  if (reposLoading && !reposData) {
    return (
      <SidebarProvider>
        <AppSidebar {...{ ...sidebarProps, collections: [], tags: [], totalStars: 0 }} />
        <SidebarInset className="overflow-x-hidden">
          <div className="w-full px-4 sm:px-6 pt-6 pb-8 space-y-5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <div className="grid grid-cols-[1fr_340px] gap-5">
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-48 w-full rounded-lg" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-32 w-full rounded-lg" />
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (!repo) {
    return (
      <SidebarProvider>
        <AppSidebar {...sidebarProps} />
        <SidebarInset className="overflow-x-hidden">
          <div className="flex flex-col items-center justify-center gap-4 h-[60vh] text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Repository not found</p>
              <p className="text-sm text-muted-foreground mt-1">{owner}/{repoName} is not in your starred repos.</p>
            </div>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              <ChevronLeft className="h-4 w-4 mr-1" />Back to Dashboard
            </Button>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar {...sidebarProps} />
      <SidebarInset className="overflow-x-hidden">
        <div className="w-full px-4 sm:px-6 pt-6 pb-8">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-5">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Dashboard
            </button>
            <span className="text-border">/</span>
            <span className="text-sm text-muted-foreground">{owner}</span>
            <span className="text-border">/</span>
            <span className="text-sm font-mono font-medium">{repoName}</span>
          </div>

          {/* Hero */}
          <div className="rounded-xl border border-border/60 bg-card mb-5 overflow-hidden">
            {repo.archived && (
              <div className="flex items-center gap-2 px-5 py-2 bg-orange-500/10 border-b border-orange-500/20 text-orange-400 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Archived — no longer actively maintained.
              </div>
            )}
            <div className="px-5 pt-4 pb-0">
              {/* Name + actions */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0 rounded-lg">
                    <AvatarImage src={repo.avatarUrl} alt={repo.owner} />
                    <AvatarFallback className="rounded-lg">{repo.owner[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{repo.owner}</p>
                    <h1 className="font-mono text-xl font-semibold leading-tight">{repo.name}</h1>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePinToggle} title={repo.isPinned ? "Unpin" : "Pin"}>
                    <Pin className={cn("h-4 w-4", repo.isPinned && "fill-accent text-accent")} />
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 h-8" asChild>
                    <a href={`https://github.com/${repo.fullName}`} target="_blank" rel="noopener noreferrer">
                      <Github className="h-3.5 w-3.5" />GitHub
                    </a>
                  </Button>
                </div>
              </div>

              {/* Description */}
              {repo.description && (
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {repo.description}
                </p>
              )}

              {/* Stats + badges */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Star className="h-3.5 w-3.5" />
                  <span className="font-mono font-semibold text-foreground">{formatNumber(repo.stargazersCount)}</span>
                  <span className="text-xs">stars</span>
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <GitFork className="h-3.5 w-3.5" />
                  <span className="font-mono font-semibold text-foreground">{formatNumber(repo.forksCount)}</span>
                  <span className="text-xs">forks</span>
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span className="font-mono font-semibold text-foreground">{formatNumber(repo.openIssuesCount)}</span>
                  <span className="text-xs">issues</span>
                </span>
                {repo.language && (
                  <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: repo.languageColor || "#64748b" }} />
                    {repo.language}
                  </span>
                )}
                {repo.license && (
                  <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <Scale className="h-3.5 w-3.5" />{repo.license}
                  </span>
                )}
                {repo.isTrending && (
                  <Badge variant="outline" className="text-xs gap-1 border-amber-500/30 bg-amber-500/10 text-amber-400 h-5">
                    <Zap className="h-3 w-3" />Trending
                  </Badge>
                )}
                {repo.status && (
                  <Badge variant="outline" className={cn("text-xs h-5", STATUS_LABELS[repo.status].color)}>
                    {STATUS_LABELS[repo.status].label}
                  </Badge>
                )}
                <span className="flex items-center gap-1.5 text-muted-foreground text-xs ml-auto">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDistanceToNow(new Date(repo.pushedAt), { addSuffix: true })}
                </span>
              </div>
            </div>

            <Separator className="mt-4 opacity-60" />

            {/* Meta strip */}
            <div className="px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Star className="h-3 w-3" />
                Starred {format(new Date(repo.starredAt), "MMM d, yyyy")}
              </span>
              {repo.homepage && (
                <a href={repo.homepage} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-accent hover:underline">
                  <Globe className="h-3 w-3" />
                  {repo.homepage.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              )}
              {/* Clone */}
              <div className="flex items-center gap-1.5 ml-auto min-w-0">
                <code className="font-mono bg-muted px-2 py-1 rounded text-xs truncate max-w-[280px]">
                  git clone https://github.com/{repo.fullName}.git
                </code>
                <button onClick={handleCopyClone} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Topics + quick links */}
            {(repo.topics.length > 0 || true) && (
              <>
                <Separator className="opacity-60" />
                <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {repo.topics.slice(0, 10).map(t => (
                      <Badge key={t} variant="secondary" className="text-xs h-5">{t}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {[
                      { icon: AlertCircle, label: "Issues", path: "issues" },
                      { icon: GitCommit, label: "PRs", path: "pulls" },
                      { icon: FileText, label: "Releases", path: "releases" },
                    ].map(({ icon: Icon, label, path }) => (
                      <Button key={label} variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground" asChild>
                        <a href={`https://github.com/${repo.fullName}/${path}`} target="_blank" rel="noopener noreferrer">
                          <Icon className="h-3 w-3" />{label}
                        </a>
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Two-column body */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_380px] xl:grid-cols-[minmax(0,0.75fr)_420px] 2xl:grid-cols-[minmax(0,780px)_minmax(440px,1fr)] gap-5 items-start">

            {/* Left: README only */}
            <div className="space-y-5 min-w-0">

              {/* README */}
              <SectionCard
                title="README"
                icon={FileText}
                collapsible
                defaultOpen
                action={
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-muted-foreground" asChild onClick={e => e.stopPropagation()}>
                    <a href={`https://github.com/${repo.fullName}#readme`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />GitHub
                    </a>
                  </Button>
                }
              >
                <ReadmeSection
                  owner={repo.owner}
                  repoName={repo.name}
                  cachedReadme={repo.readme ?? null}
                  onReadmeLoaded={handleReadmeLoaded}
                />
              </SectionCard>
            </div>

            {/* Right: Organize + Intel + Contributions */}
            <div className="space-y-4 sticky top-6 self-start">
              <SectionCard title="Organize" icon={TagIcon} collapsible defaultOpen>
                <OrganizeSection
                  repo={repo}
                  collections={collections}
                  tags={allTags}
                  onStatusChange={handleStatusChange}
                  onPinToggle={handlePinToggle}
                  onTagToggle={handleTagToggle}
                  onTagCreate={handleTagCreate}
                  onCollectionToggle={handleCollectionToggle}
                  onCollectionCreate={handleCollectionCreate}
                  onNotesChange={handleNotesChange}
                />
              </SectionCard>

              <SectionCard title="Intel" icon={Zap} collapsible defaultOpen>
                <IntelSection owner={repo.owner} repoName={repo.name} />
              </SectionCard>

              <SectionCard title="Contributions" icon={GitCommit} collapsible defaultOpen>
                <ContributionsSection owner={repo.owner} repoName={repo.name} userId={user?.id} />
              </SectionCard>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
