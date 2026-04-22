"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import type { User } from "@supabase/supabase-js"
import {
  Brain,
  Clock,
  Activity,
  Users,
  GitPullRequest,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Search,
  Check,
  SlidersHorizontal,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Zap,
  AlertTriangle,
  Wrench,
  Shield,
} from "lucide-react"
import Link from "next/link"
import { computeSubScores } from "@/lib/intel-sub-scores"
import { createClient } from "@/lib/supabase/client"
import { TokenExpiredBanner } from "@/components/token-expired-banner"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppPageHeader } from "@/components/app-page-header"
import { RepoDetailPanel } from "@/components/repo-detail-panel"
import { ReadmeViewer } from "@/components/readme-viewer"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { useCommandPaletteShortcut } from "@/components/use-command-palette-shortcut"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useStarredRepos } from "@/lib/use-starred-repos"
import { trackRecentlyViewedRepo } from "@/lib/recently-viewed"
import type { RepoIntel, StarredRepo, UserMetadata } from "@/lib/types"
import { cn } from "@/lib/utils"

interface IntelDashboardProps {
  user: User | null
}

type SortField = "health_score" | "analyzed_at" | "name"
type SortDir = "asc" | "desc"
type VerdictFilter = "all" | "actively-maintained" | "lightly-maintained" | "stale" | "abandoned"

// ─── Verdict / sentiment / readiness config ───────────────────────────────────

const verdictConfig: Record<string, {
  label: string
  badgeClass: string
  dotClass: string
}> = {
  "actively-maintained": {
    label: "Actively Maintained",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25 ring-emerald-500/10",
    dotClass: "bg-emerald-500",
  },
  "lightly-maintained": {
    label: "Lightly Maintained",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25 ring-amber-500/10",
    dotClass: "bg-amber-500",
  },
  stale: {
    label: "Stale",
    badgeClass: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/25 ring-orange-500/10",
    dotClass: "bg-orange-500",
  },
  abandoned: {
    label: "Abandoned",
    badgeClass: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25 ring-red-500/10",
    dotClass: "bg-red-500",
  },
}

const sentimentConfig: Record<string, { label: string }> = {
  positive: { label: "Positive sentiment" },
  mixed: { label: "Mixed sentiment" },
  frustrated: { label: "Frustrated users" },
}

const readinessConfig: Record<string, { label: string }> = {
  "production-ready": { label: "Production Ready" },
  maturing: { label: "Maturing" },
  experimental: { label: "Experimental" },
  deprecated: { label: "Deprecated" },
}

// ─── Health score helpers ─────────────────────────────────────────────────────

function healthPalette(score: number) {
  if (score >= 70) return {
    score: "text-emerald-600 dark:text-emerald-400",
    ring: "#10b981",
    glow: "rgba(16,185,129,0.18)",
    track: "rgba(16,185,129,0.12)",
    label: "Healthy",
    labelClass: "text-emerald-600 dark:text-emerald-400",
  }
  if (score >= 40) return {
    score: "text-amber-600 dark:text-amber-400",
    ring: "#f59e0b",
    glow: "rgba(245,158,11,0.18)",
    track: "rgba(245,158,11,0.12)",
    label: "Moderate",
    labelClass: "text-amber-600 dark:text-amber-400",
  }
  return {
    score: "text-rose-600 dark:text-rose-400",
    ring: "#f43f5e",
    glow: "rgba(244,63,94,0.18)",
    track: "rgba(244,63,94,0.12)",
    label: "At Risk",
    labelClass: "text-rose-600 dark:text-rose-400",
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreDial({ score, size = 56 }: { score: number; size?: number }) {
  const sw = 4
  const r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const p = healthPalette(score)

  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" style={{ filter: `drop-shadow(0 0 6px ${p.glow})` }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw} stroke={p.track} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={sw}
          stroke={p.ring}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className={cn("text-sm font-bold tabular-nums", p.score)}>{score}</span>
      </div>
    </div>
  )
}

function IntelMetric({ icon: Icon, label, value, detail, toneClass }: {
  icon: React.ElementType
  label: string
  value: string
  detail?: string
  toneClass?: string
}) {
  return (
    <div className="min-w-0 rounded-md border border-border/50 bg-muted/15 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className={cn("h-3 w-3 shrink-0", toneClass)} />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 flex min-h-5 items-baseline gap-1.5">
        <span className="truncate text-sm font-semibold tabular-nums text-foreground">{value}</span>
        {detail && <span className="truncate text-[11px] text-muted-foreground/70">{detail}</span>}
      </div>
    </div>
  )
}

function StatPill({ icon: Icon, value, label, colorClass }: {
  icon: React.ElementType
  value: string | number
  label: string
  colorClass: string
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", colorClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold tabular-nums leading-none text-foreground">{value}</div>
          <div className="mt-1 truncate text-[11px] text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <Empty className="min-h-80 border border-border/60 bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Brain />
        </EmptyMedia>
        <EmptyTitle>No intel collected yet</EmptyTitle>
        <EmptyDescription>
          Open a repository, run an Intel analysis, and your reports will appear here.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">
            <Zap className="h-3.5 w-3.5" />
            Dashboard
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function NoFilteredResults({ onClear }: { onClear: () => void }) {
  return (
    <Empty className="min-h-64 border border-border/60 bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Search />
        </EmptyMedia>
        <EmptyTitle>No matching reports</EmptyTitle>
        <EmptyDescription>
          No repositories match the current Intel filters.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function IntelSectionCard({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        {action}
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  )
}

function IntelListSkeleton() {
  return (
    <IntelSectionCard title="Reports" icon={Brain}>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/60 bg-background/40 p-4">
            <div className="flex gap-3">
              <Skeleton className="size-12 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-3 w-64 max-w-full" />
                  </div>
                  <Skeleton className="h-6 w-32" />
                </div>
                <Skeleton className="mt-4 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-4/5" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-14 rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </IntelSectionCard>
  )
}

function IntelErrorState() {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>Failed to load intel</AlertTitle>
      <AlertDescription>Please refresh and try again.</AlertDescription>
    </Alert>
  )
}

function IntelCard({ intel, onOpenRepo }: {
  intel: RepoIntel
  onOpenRepo: (repoFullName: string) => void
}) {
  const [owner, repo] = intel.repoFullName.split("/")
  const verdict = verdictConfig[intel.maintenanceVerdict] ?? {
    label: intel.maintenanceVerdict,
    badgeClass: "",
    dotClass: "bg-zinc-500",
  }
  const sentiment = sentimentConfig[intel.communitySentiment] ?? { label: intel.communitySentiment }
  const readiness = readinessConfig[intel.adoptionReadiness] ?? { label: intel.adoptionReadiness }

  const issueClose = intel.metrics?.issueCloseRate != null ? Math.round(intel.metrics.issueCloseRate * 100) : null
  const prMerge = intel.metrics?.prMergeRate != null ? Math.round(intel.metrics.prMergeRate * 100) : null
  const contributors = intel.metrics?.activeCommitAuthors90d ?? intel.metrics?.activeContributors90d ?? null
  const daysSince = intel.metrics?.daysSinceLastCommit ?? null
  const p = healthPalette(intel.healthScore)
  const issueTone = issueClose !== null
    ? issueClose >= 50 ? "text-emerald-600 dark:text-emerald-400" : issueClose >= 25 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"
    : undefined
  const prTone = prMerge !== null
    ? prMerge >= 60 ? "text-emerald-600 dark:text-emerald-400" : prMerge >= 30 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"
    : undefined

  const painPoints = intel.topPainPoints ?? []

  return (
    <div className="group overflow-hidden rounded-lg border border-border/60 bg-card transition-colors hover:border-muted-foreground/30">
      <div className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-1 gap-3">
            <ScoreDial score={intel.healthScore} size={48} />

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenRepo(intel.repoFullName)}
                    className="group/link inline-flex min-h-6 max-w-full items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <span className="min-w-0 truncate font-mono text-sm font-medium text-foreground transition-colors group-hover/link:text-primary">
                      <span className="text-muted-foreground">{owner}/</span>{repo}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-all group-hover/link:translate-x-0.5 group-hover/link:text-primary/70" />
                  </button>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground/70">
                    <span className={cn("font-medium", p.labelClass)}>{p.label}</span>
                    <span aria-hidden="true">/</span>
                    <span>{readiness.label}</span>
                    <span aria-hidden="true">/</span>
                    <span>{sentiment.label}</span>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={cn(
                    "h-6 rounded-md px-2 text-[11px] font-medium normal-case tracking-normal",
                    verdict.badgeClass
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", verdict.dotClass)} />
                  {verdict.label}
                </Badge>
              </div>

              <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {intel.summary}
              </p>

            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-border/50 pt-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {issueClose !== null && (
              <IntelMetric icon={Activity} label="Issues" value={`${issueClose}%`} detail="closed" toneClass={issueTone} />
            )}
            {prMerge !== null && (
              <IntelMetric icon={GitPullRequest} label="Pull requests" value={`${prMerge}%`} detail="merged" toneClass={prTone} />
            )}
            {contributors !== null && (
              <IntelMetric icon={Users} label="Authors" value={String(contributors)} detail="90d commits" />
            )}
            {daysSince !== null && (
              <IntelMetric icon={Clock} label="Last commit" value={daysSince === 0 ? "Today" : `${daysSince}d`} detail={daysSince === 0 ? undefined : "ago"} />
            )}
          </div>

          {/* Sub-scores row */}
          {(() => {
            const sub = computeSubScores(intel.metrics)
            const subItems = [
              { label: 'Maint', score: sub.maintenance, icon: Wrench },
              { label: 'Activity', score: sub.activity, icon: Activity },
              { label: 'Community', score: sub.community, icon: Users },
              { label: 'Trust', score: sub.trust, icon: Shield },
            ]
            return (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                {subItems.map(({ label, score, icon: Icon }) => {
                  const c = score >= 70 ? 'text-emerald-600 dark:text-emerald-400'
                          : score >= 40 ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                  return (
                    <div key={label} className="flex items-center gap-1 text-[11px]">
                      <Icon className={cn("h-3 w-3", c)} />
                      <span className="text-muted-foreground">{label}</span>
                      <span className={cn("font-semibold tabular-nums", c)}>{score}</span>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
              <Sparkles className="h-3 w-3" />
              <span>Analyzed {formatDistanceToNow(new Date(intel.analyzedAt), { addSuffix: true })}</span>
            </div>
            <Link
              href={`/intel/${owner}/${repo}`}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={e => e.stopPropagation()}
            >
              Full report
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {painPoints.length > 0 && (
          <Accordion type="single" collapsible className="mt-3 rounded-lg border border-border/60 bg-muted/10">
            <AccordionItem value="pain-points" className="border-b-0">
              <AccordionTrigger className="min-h-11 px-3 py-2 text-xs hover:no-underline">
                <span className="flex min-w-0 items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium text-foreground">Review notes</span>
                  <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[10px]">
                    {painPoints.length}
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3">
                <div className="flex flex-col gap-2">
                  {painPoints.map((point, i) => (
                    <div key={i} className="flex gap-2 rounded-md border border-border/50 bg-background/60 px-3 py-2">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-medium text-muted-foreground">
                        {i + 1}
                      </span>
                      <p className="text-xs leading-relaxed text-muted-foreground">{point}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>
    </div>
  )
}

const LS_TTL = 7 * 24 * 60 * 60 * 1000
const LS_PREFIX = "stardash-intel:"

function getLocalIntel(): RepoIntel[] {
  if (typeof window === "undefined") return []
  const results: RepoIntel[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(LS_PREFIX)) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const { data, ts } = JSON.parse(raw)
      if (Date.now() - ts > LS_TTL) continue
      if (data?.intel) results.push(data.intel)
    }
  } catch {}
  return results
}

const fetcher = (url: string) =>
  fetch(url).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })

const sortLabels: Record<SortField, string> = {
  health_score: "Health score",
  analyzed_at: "Recently analyzed",
  name: "Name A-Z",
}

function includesQuery(value: string | undefined | null, query: string) {
  return Boolean(value?.toLowerCase().includes(query))
}

function IntelCommandPalette({
  open,
  onOpenChange,
  intel,
  filteredIntel,
  search,
  verdictFilter,
  sortField,
  sortDir,
  verdictOptions,
  onSearchChange,
  onVerdictFilterChange,
  onSortChange,
  onOpenRepo,
  onClearFilters,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  intel: RepoIntel[]
  filteredIntel: RepoIntel[]
  search: string
  verdictFilter: VerdictFilter
  sortField: SortField
  sortDir: SortDir
  verdictOptions: { value: VerdictFilter; label: string; dotClass: string }[]
  onSearchChange: (query: string) => void
  onVerdictFilterChange: (filter: VerdictFilter) => void
  onSortChange: (field: SortField) => void
  onOpenRepo: (repoFullName: string) => void
  onClearFilters: () => void
}) {
  const [query, setQuery] = useState("")
  const [selectedValue, setSelectedValue] = useState("")
  useCommandPaletteShortcut(open, onOpenChange)

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("")
      setSelectedValue("")
    }
  }, [open])

  const normalizedQuery = query.trim().toLowerCase()
  const hasActiveFilters = Boolean(search || verdictFilter !== "all")

  const visibleIntel = useMemo(() => {
    const baseIntel = normalizedQuery ? intel : filteredIntel
    const matched = normalizedQuery
      ? intel.filter((item) => (
          includesQuery(item.repoFullName, normalizedQuery) ||
          includesQuery(item.summary, normalizedQuery) ||
          includesQuery(item.recommendation, normalizedQuery) ||
          includesQuery(item.maintenanceVerdict, normalizedQuery) ||
          includesQuery(item.adoptionReadiness, normalizedQuery) ||
          item.topPainPoints?.some((point) => includesQuery(point, normalizedQuery))
        ))
      : baseIntel

    return matched.slice(0, 20)
  }, [filteredIntel, intel, normalizedQuery])

  const orderedItemMatches = useMemo(() => {
    const matches: Array<{ value: string; matchesQuery: boolean }> = []

    if (query.trim()) {
      matches.push({ value: `search-${query}`, matchesQuery: true })
    }

    matches.push({
      value: "clear-filters",
      matchesQuery: hasActiveFilters && "clear active filters reset".includes(normalizedQuery),
    })

    verdictOptions.forEach((option) => {
      matches.push({
        value: `verdict-${option.value}`,
        matchesQuery: option.label.toLowerCase().includes(normalizedQuery),
      })
    })

    Object.entries(sortLabels).forEach(([value, label]) => {
      matches.push({
        value: `sort-${value}`,
        matchesQuery: label.toLowerCase().includes(normalizedQuery),
      })
    })

    visibleIntel.forEach((item) => {
      matches.push({
        value: `repo-${item.repoFullName}`,
        matchesQuery: [
          item.repoFullName,
          item.summary,
          item.recommendation,
          item.maintenanceVerdict,
          item.adoptionReadiness,
          ...(item.topPainPoints ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      })
    })

    return matches
  }, [hasActiveFilters, normalizedQuery, query, verdictOptions, visibleIntel])

  useEffect(() => {
    if (!open) return
    const nextSelection =
      orderedItemMatches.find((item) => item.matchesQuery)?.value ?? orderedItemMatches[0]?.value ?? ""
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedValue(nextSelection)
  }, [open, orderedItemMatches])

  const runAndClose = (action: () => void) => {
    action()
    onOpenChange(false)
  }

  const applySearch = () => {
    if (!query.trim()) return
    runAndClose(() => onSearchChange(query.trim()))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden p-0" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Search Repo Intel</DialogTitle>
          <DialogDescription>
            Search analyzed repositories, change Intel filters, and switch sort order.
          </DialogDescription>
        </DialogHeader>
        <Command
          shouldFilter={false}
          value={selectedValue}
          onValueChange={setSelectedValue}
          className="rounded-none bg-popover text-popover-foreground [&_[data-slot=command-input-wrapper]]:h-14 [&_[data-slot=command-input-wrapper]]:border-b [&_[data-slot=command-input-wrapper]]:border-border/70 [&_[data-slot=command-input-wrapper]]:px-4 [&_[data-slot=command-input-wrapper]_svg]:h-4 [&_[data-slot=command-input-wrapper]_svg]:w-4 [&_[data-slot=command-input]]:h-14 [&_[data-slot=command-input]]:text-sm"
        >
          <div className="border-b border-border/70 bg-secondary/20">
            <div className="flex items-center justify-between gap-3 px-4 py-2 text-xs text-muted-foreground">
              <span className="truncate">Search Intel reports, filters, and sort options</span>
              <KbdGroup className="hidden shrink-0 sm:flex">
                <Kbd>Esc</Kbd>
                <Kbd>Enter</Kbd>
              </KbdGroup>
            </div>
          </div>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search intel, jump to a repo, or change filters..."
          />

          <CommandList className="max-h-[min(72vh,640px)] px-2 py-2">
            <CommandEmpty>No Intel results found.</CommandEmpty>

            {query.trim() && (
              <CommandGroup heading="Search">
                <CommandItem value={`search-${query}`} onSelect={applySearch} className="rounded-md">
                  <Search className="h-4 w-4" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">Filter Intel for &quot;{query.trim()}&quot;</span>
                    <span className="text-xs text-muted-foreground">Updates the Repo Intel list</span>
                  </div>
                  <CommandShortcut>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </CommandShortcut>
                </CommandItem>
              </CommandGroup>
            )}

            <CommandGroup heading="Repositories">
              {visibleIntel.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`repo-${item.repoFullName}`}
                  onSelect={() => runAndClose(() => onOpenRepo(item.repoFullName))}
                  className="rounded-md"
                >
                  <Brain className="h-4 w-4" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-mono text-sm">{item.repoFullName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {item.healthScore} health / {verdictConfig[item.maintenanceVerdict]?.label ?? item.maintenanceVerdict}
                    </span>
                  </div>
                  <CommandShortcut>Open</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Filters">
              {verdictOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`verdict-${option.value}`}
                  onSelect={() => runAndClose(() => onVerdictFilterChange(option.value))}
                  className="rounded-md"
                >
                  <Check className={cn("h-4 w-4", verdictFilter === option.value ? "opacity-100" : "opacity-0")} />
                  <span className={cn("h-1.5 w-1.5 rounded-full", option.dotClass)} />
                  <span className="flex-1">{option.label}</span>
                </CommandItem>
              ))}
              <CommandItem
                value="clear-filters"
                onSelect={() => runAndClose(onClearFilters)}
                disabled={!hasActiveFilters}
                className="rounded-md"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="flex-1">Clear Intel filters</span>
                <CommandShortcut>{hasActiveFilters ? "Reset" : "Idle"}</CommandShortcut>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Sort">
              {(Object.keys(sortLabels) as SortField[]).map((field) => (
                <CommandItem
                  key={field}
                  value={`sort-${field}`}
                  onSelect={() => runAndClose(() => onSortChange(field))}
                  className="rounded-md"
                >
                  <Check className={cn("h-4 w-4", sortField === field ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1">{sortLabels[field]}</span>
                  <CommandShortcut>{sortField === field ? sortDir.toUpperCase() : ""}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

export function IntelDashboard({ user }: IntelDashboardProps) {
  const router = useRouter()
  const [sortField, setSortField] = useState<SortField>("health_score")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("all")
  const [search, setSearch] = useState("")
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState<StarredRepo | null>(null)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)
  const [readmeViewerOpen, setReadmeViewerOpen] = useState(false)

  const { data: starredData } = useStarredRepos(user?.id)

  const { data: metadata } = useSWR<UserMetadata>(
    user?.id ? "/api/user/metadata" : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  const { data, isLoading, error } = useSWR<{ intel: RepoIntel[] }>(
    user?.id ? "/api/intel/all" : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  const repos = useMemo(() => {
    const rawRepos = starredData?.repos ?? []

    return rawRepos.map((repo) => {
      const dbMeta = metadata?.repoMeta[repo.id]
      if (!dbMeta) return repo

      const dbTags = (metadata?.tags ?? []).filter((tag) => dbMeta.tagIds.includes(tag.id))
      return {
        ...repo,
        status: dbMeta.status ?? repo.status,
        isPinned: dbMeta.isPinned,
        notes: dbMeta.notes ?? repo.notes,
        tags: dbTags,
        collections: dbMeta.collectionIds,
      }
    })
  }, [starredData?.repos, metadata])

  const repoByFullName = useMemo(() => {
    return new Map(repos.map((repo) => [repo.fullName, repo]))
  }, [repos])

  const uncategorizedCount = useMemo(() => {
    return repos.filter((repo) => repo.tags.length === 0 && repo.collections.length === 0).length
  }, [repos])

  const handleOpenRepo = (repoFullName: string) => {
    const repo = repoByFullName.get(repoFullName)
    if (!repo) return

    if (user?.id) {
      trackRecentlyViewedRepo(user.id, repo, "intel")
    }

    setSelectedRepo(repo)
    setDetailPanelOpen(true)
  }

  const handleCloseDetail = () => {
    setDetailPanelOpen(false)
    setTimeout(() => setSelectedRepo(null), 200)
  }

  const handleViewReadme = () => {
    setDetailPanelOpen(false)
    setReadmeViewerOpen(true)
  }

  const handleCloseReadme = () => {
    setReadmeViewerOpen(false)
  }

  const handleReconnect = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const isTokenExpired = Boolean(
    error?.message?.includes('token') ||
    error?.message?.includes('expired') ||
    error?.message?.includes('re-authenticate')
  )

  // Merge server data with any locally-cached intel (handles cases where DB upsert failed)
  const allIntel = useMemo(() => {
    const serverIntel = data?.intel ?? []
    const localIntel = getLocalIntel()
    const serverNames = new Set(serverIntel.map(i => i.repoFullName))
    const localOnly = localIntel.filter(i => !serverNames.has(i.repoFullName))
    return [...serverIntel, ...localOnly]
  }, [data?.intel])

  // Stats
  const avgScore = allIntel.length > 0
    ? Math.round(allIntel.reduce((s, i) => s + i.healthScore, 0) / allIntel.length)
    : 0
  const healthyCount = allIntel.filter(i => i.healthScore >= 70).length
  const atRiskCount = allIntel.filter(i => i.healthScore < 40).length

  // Filtered + sorted
  const filtered = useMemo(() => {
    let list = [...allIntel]

    if (verdictFilter !== "all") {
      list = list.filter(i => i.maintenanceVerdict === verdictFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(i => i.repoFullName.toLowerCase().includes(q) || i.summary?.toLowerCase().includes(q))
    }

    list.sort((a, b) => {
      let cmp = 0
      if (sortField === "health_score") cmp = a.healthScore - b.healthScore
      else if (sortField === "analyzed_at") cmp = new Date(a.analyzedAt).getTime() - new Date(b.analyzedAt).getTime()
      else cmp = a.repoFullName.localeCompare(b.repoFullName)
      return sortDir === "desc" ? -cmp : cmp
    })

    return list
  }, [allIntel, verdictFilter, search, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir(field === "name" ? "asc" : "desc")
    }
  }

  const clearIntelFilters = () => {
    setSearch("")
    setVerdictFilter("all")
  }

  // Verdict filter pill options
  const verdictOptions: { value: VerdictFilter; label: string; dotClass: string }[] = [
    { value: "all", label: "All", dotClass: "bg-muted-foreground" },
    { value: "actively-maintained", label: "Active", dotClass: "bg-emerald-500" },
    { value: "lightly-maintained", label: "Lightly Maintained", dotClass: "bg-amber-500" },
    { value: "stale", label: "Stale", dotClass: "bg-orange-500" },
    { value: "abandoned", label: "Abandoned", dotClass: "bg-rose-500" },
  ]

  const searchLabel = search ? `Intel: ${search}` : "Search Intel reports and filters"
  const desktopControlClassName =
    "h-10 rounded-xl border border-border/70 bg-secondary/45 text-muted-foreground shadow-none transition-colors hover:bg-accent/60 hover:text-foreground [&_svg]:text-muted-foreground"
  const mobileControlClassName =
    "h-10 w-full rounded-xl border border-border/70 bg-secondary/45 text-muted-foreground shadow-none [&_svg]:text-muted-foreground"

  const filterControls = allIntel.length > 0 ? (
    <>
      <Select value={verdictFilter} onValueChange={(value) => setVerdictFilter(value as VerdictFilter)}>
        <SelectTrigger className={`w-36 lg:w-44 ${desktopControlClassName}`}>
          <SelectValue placeholder="Verdict" />
        </SelectTrigger>
        <SelectContent>
          {verdictOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={`${sortField}:${sortDir}`}
        onValueChange={(value) => {
          const [field, direction] = value.split(":") as [SortField, SortDir]
          setSortField(field)
          setSortDir(direction)
        }}
      >
        <SelectTrigger className={`w-36 lg:w-44 ${desktopControlClassName}`}>
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="health_score:desc">Health score high</SelectItem>
          <SelectItem value="health_score:asc">Health score low</SelectItem>
          <SelectItem value="analyzed_at:desc">Recently analyzed</SelectItem>
          <SelectItem value="analyzed_at:asc">Oldest analyzed</SelectItem>
          <SelectItem value="name:asc">Name A-Z</SelectItem>
          <SelectItem value="name:desc">Name Z-A</SelectItem>
        </SelectContent>
      </Select>
    </>
  ) : null

  const mobileFilterControls = allIntel.length > 0 ? (
    <>
      <Select value={verdictFilter} onValueChange={(value) => setVerdictFilter(value as VerdictFilter)}>
        <SelectTrigger className={mobileControlClassName}>
          <SelectValue placeholder="Verdict" />
        </SelectTrigger>
        <SelectContent>
          {verdictOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={`${sortField}:${sortDir}`}
        onValueChange={(value) => {
          const [field, direction] = value.split(":") as [SortField, SortDir]
          setSortField(field)
          setSortDir(direction)
        }}
      >
        <SelectTrigger className={mobileControlClassName}>
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="health_score:desc">Health score high</SelectItem>
          <SelectItem value="health_score:asc">Health score low</SelectItem>
          <SelectItem value="analyzed_at:desc">Recently analyzed</SelectItem>
          <SelectItem value="analyzed_at:asc">Oldest analyzed</SelectItem>
          <SelectItem value="name:asc">Name A-Z</SelectItem>
          <SelectItem value="name:desc">Name Z-A</SelectItem>
        </SelectContent>
      </Select>
    </>
  ) : null

  return (
    <SidebarProvider>
      <AppSidebar
        collections={metadata?.collections ?? []}
        tags={metadata?.tags ?? []}
        selectedCollection={null}
        selectedTag={null}
        showUncategorized={false}
        onSelectCollection={() => {}}
        onSelectTag={() => {}}
        onShowUncategorized={() => {}}
        totalStars={repos.length}
        uncategorizedCount={uncategorizedCount}
        userId={user?.id}
        onAICategorize={() => {}}
        onCreateCollection={async () => {}}
        onCreateTag={async () => {}}
      />
      <SidebarInset>
        <AppPageHeader
          searchLabel={searchLabel}
          searchShortcutLabel="⌘"
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          desktopControls={filterControls}
          mobileControls={mobileFilterControls}
          user={user}
          lastSynced={null}
          hideNavActions
        />

        <main className="flex-1 p-6">
          <section className="mb-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight">Repo Intel</h1>
              <p className="text-sm text-muted-foreground">AI-powered health briefs for your starred repos</p>
            </div>

            {/* Stats row — only visible when there's data */}
            {!isLoading && allIntel.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatPill icon={Brain} value={allIntel.length} label="Repos analyzed" colorClass="bg-sky-500/10 text-sky-700 dark:text-sky-400" />
                <StatPill
                  icon={Activity}
                  value={avgScore}
                  label="Avg health score"
                  colorClass={cn(
                    avgScore >= 70 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" :
                    avgScore >= 40 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                    "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                  )}
                />
                <StatPill icon={TrendingUp} value={healthyCount} label="Healthy (≥70)" colorClass="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" />
                <StatPill icon={TrendingDown} value={atRiskCount} label="At risk (<40)" colorClass="bg-rose-500/10 text-rose-700 dark:text-rose-400" />
              </div>
            )}
          </section>

          <div className="flex flex-col gap-3">
            {/* Token expiry banner — always at top when expired */}
            {isTokenExpired && <TokenExpiredBanner onReconnect={handleReconnect} />}

            {isLoading ? (
              <IntelListSkeleton />
            ) : error ? (
              <div className="flex flex-col gap-3">
                {isTokenExpired ? (
                  allIntel.length === 0 ? (
                    <EmptyState />
                  ) : filtered.length === 0 ? (
                    <NoFilteredResults onClear={clearIntelFilters} />
                  ) : (
                    <IntelSectionCard
                      title="Reports"
                      icon={Brain}
                      action={
                        <span className="text-[11px] text-muted-foreground">
                          {filtered.length} of {allIntel.length}
                        </span>
                      }
                    >
                      <div className="flex flex-col gap-3">
                        {filtered.map((intel) => (
                          <IntelCard key={intel.id} intel={intel} onOpenRepo={handleOpenRepo} />
                        ))}
                      </div>
                    </IntelSectionCard>
                  )
                ) : (
                  <IntelErrorState />
                )}
              </div>
            ) : allIntel.length === 0 ? (
              <EmptyState />
            ) : filtered.length === 0 ? (
              <NoFilteredResults onClear={clearIntelFilters} />
            ) : (
              <IntelSectionCard
                title="Reports"
                icon={Brain}
                action={
                  <span className="text-[11px] text-muted-foreground">
                    {filtered.length} of {allIntel.length} analyzed
                  </span>
                }
              >
                <div className="flex flex-col gap-3">
                  {filtered.map((intel) => (
                    <IntelCard key={intel.id} intel={intel} onOpenRepo={handleOpenRepo} />
                  ))}
                </div>
              </IntelSectionCard>
            )}
          </div>
        </main>
      </SidebarInset>

      <IntelCommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        intel={allIntel}
        filteredIntel={filtered}
        search={search}
        verdictFilter={verdictFilter}
        sortField={sortField}
        sortDir={sortDir}
        verdictOptions={verdictOptions}
        onSearchChange={setSearch}
        onVerdictFilterChange={setVerdictFilter}
        onSortChange={toggleSort}
        onOpenRepo={handleOpenRepo}
        onClearFilters={clearIntelFilters}
      />

      <RepoDetailPanel
        repo={selectedRepo}
        open={detailPanelOpen}
        onClose={handleCloseDetail}
        onViewReadme={handleViewReadme}
        collections={metadata?.collections ?? []}
        tags={metadata?.tags ?? []}
        onStatusChange={() => {}}
        onTagToggle={() => {}}
        onTagCreate={() => {}}
        onCollectionToggle={() => {}}
        onCollectionCreate={() => {}}
        onNotesChange={() => {}}
        onPinToggle={() => {}}
      />

      <ReadmeViewer
        repo={selectedRepo}
        open={readmeViewerOpen}
        onClose={handleCloseReadme}
      />
    </SidebarProvider>
  )
}
