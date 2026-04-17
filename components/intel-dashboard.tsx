"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import type { User } from "@supabase/supabase-js"
import {
  Brain,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Clock,
  Activity,
  Users,
  GitPullRequest,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Search,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppPageHeader } from "@/components/app-page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { RepoIntel, UserMetadata } from "@/lib/types"
import { cn } from "@/lib/utils"

interface IntelDashboardProps {
  user: User | null
}

type SortField = "health_score" | "analyzed_at" | "name"
type SortDir = "asc" | "desc"
type VerdictFilter = "all" | "actively-maintained" | "lightly-maintained" | "stale" | "abandoned"

const verdictConfig: Record<string, { label: string; className: string; icon: string }> = {
  "actively-maintained": {
    label: "Active",
    className: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/25",
    icon: "✓",
  },
  "lightly-maintained": {
    label: "Light",
    className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/25",
    icon: "~",
  },
  stale: {
    label: "Stale",
    className: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/25",
    icon: "!",
  },
  abandoned: {
    label: "Abandoned",
    className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25",
    icon: "✗",
  },
}

const sentimentConfig: Record<string, { label: string; className: string }> = {
  positive: {
    label: "Positive",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  },
  mixed: {
    label: "Mixed",
    className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/25",
  },
  frustrated: {
    label: "Frustrated",
    className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25",
  },
}

const readinessConfig: Record<string, { label: string; className: string }> = {
  "production-ready": {
    label: "Production",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25",
  },
  maturing: {
    label: "Maturing",
    className: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/25",
  },
  experimental: {
    label: "Experimental",
    className: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/25",
  },
  deprecated: {
    label: "Deprecated",
    className: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/25",
  },
}

function healthColor(score: number) {
  if (score >= 70) return { ring: "text-green-600 dark:text-green-400", bg: "bg-green-500/10", text: "text-green-700 dark:text-green-400" }
  if (score >= 40) return { ring: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10", text: "text-yellow-700 dark:text-yellow-400" }
  return { ring: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", text: "text-red-700 dark:text-red-400" }
}

function HealthRing({ score }: { score: number }) {
  const size = 44
  const strokeWidth = 3.5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const colors = healthColor(score)

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className={colors.ring}
        />
      </svg>
      <span className={cn("absolute text-xs font-bold tabular-nums", colors.text)}>{score}</span>
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, colorClass }: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  colorClass: string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 px-5 py-4 flex items-start gap-3">
      <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", colorClass)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-2xl font-semibold tabular-nums text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground/70">{sub}</div>}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30">
        <Brain className="h-6 w-6 text-muted-foreground/50" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">No intel yet</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Open a repo from your dashboard, click the <strong>Intel</strong> tab, and run an analysis to see
          AI-powered insights here.
        </p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href="/dashboard">
          Go to Dashboard <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  )
}

function IntelCard({ intel }: { intel: RepoIntel }) {
  const [owner, repo] = intel.repoFullName.split("/")
  const verdict = verdictConfig[intel.maintenanceVerdict] ?? { label: intel.maintenanceVerdict, className: "", icon: "?" }
  const sentiment = sentimentConfig[intel.communitySentiment] ?? { label: intel.communitySentiment, className: "" }
  const readiness = readinessConfig[intel.adoptionReadiness] ?? { label: intel.adoptionReadiness, className: "" }

  const issueCloseRatePct = intel.metrics?.issueCloseRate != null
    ? Math.round(intel.metrics.issueCloseRate * 100)
    : null
  const prMergeRatePct = intel.metrics?.prMergeRate != null
    ? Math.round(intel.metrics.prMergeRate * 100)
    : null
  const active = intel.metrics?.activeContributors90d ?? null
  const daysSince = intel.metrics?.daysSinceLastCommit ?? null

  return (
    <div className="group rounded-xl border border-border/60 bg-card/50 p-5 transition-colors hover:border-border hover:bg-card">
      <div className="flex items-start gap-4">
        {/* Health ring */}
        <div className="shrink-0">
          <HealthRing score={intel.healthScore} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Header row */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Link
                href={`/dashboard?repo=${encodeURIComponent(intel.repoFullName)}`}
                className="group/link inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
              >
                <span className="text-muted-foreground">{owner}/</span>
                <span>{repo}</span>
                <ChevronRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover/link:opacity-70" />
              </Link>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-1.5">
              <Badge
                variant="outline"
                className={cn("h-5 gap-1 rounded-full px-2 py-0 text-[11px] font-medium border", verdict.className)}
              >
                <span className="text-[10px] leading-none">{verdict.icon}</span>
                {verdict.label}
              </Badge>
              <Badge
                variant="outline"
                className={cn("h-5 rounded-full px-2 py-0 text-[11px] font-medium border", sentiment.className)}
              >
                {sentiment.label}
              </Badge>
              <Badge
                variant="outline"
                className={cn("h-5 rounded-full px-2 py-0 text-[11px] font-medium border", readiness.className)}
              >
                {readiness.label}
              </Badge>
            </div>
          </div>

          {/* Summary */}
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground leading-relaxed">
            {intel.summary}
          </p>

          {/* Metrics row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {issueCloseRatePct !== null && (
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {issueCloseRatePct}% issues closed
              </span>
            )}
            {prMergeRatePct !== null && (
              <span className="flex items-center gap-1">
                <GitPullRequest className="h-3 w-3" />
                {prMergeRatePct}% PRs merged
              </span>
            )}
            {active !== null && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {active} contributors (90d)
              </span>
            )}
            {daysSince !== null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {daysSince === 0 ? "today" : `${daysSince}d ago`} last commit
              </span>
            )}
            <span className="ml-auto flex items-center gap-1 text-muted-foreground/60">
              <Sparkles className="h-3 w-3" />
              Analyzed {formatDistanceToNow(new Date(intel.analyzedAt), { addSuffix: true })}
            </span>
          </div>
        </div>
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

export function IntelDashboard({ user }: IntelDashboardProps) {
  const [sortField, setSortField] = useState<SortField>("health_score")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("all")
  const [search, setSearch] = useState("")

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

  function SortButton({ field, label }: { field: SortField; label: string }) {
    const active = sortField === field
    const Icon = active ? (sortDir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown
    return (
      <Button
        variant={active ? "secondary" : "ghost"}
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => toggleSort(field)}
      >
        {label}
        <Icon className="h-3 w-3" />
      </Button>
    )
  }

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
        totalStars={0}
        uncategorizedCount={0}
        userId={user?.id}
        onAICategorize={() => {}}
        onCreateCollection={async () => {}}
        onCreateTag={async () => {}}
      />
      <SidebarInset>
        <AppPageHeader user={user} lastSynced={null} />

        <div className="flex flex-1 flex-col gap-6 p-6">
          {/* Page title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-muted/40">
                <Brain className="h-4.5 w-4.5 text-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Repo Intel</h1>
                <p className="text-sm text-muted-foreground">AI-powered health analysis for your starred repos</p>
              </div>
            </div>
          </div>

          {/* Stats row */}
          {!isLoading && allIntel.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                icon={Brain}
                label="Repos analyzed"
                value={allIntel.length}
                colorClass="bg-blue-500/10 text-blue-700 dark:text-blue-400"
              />
              <StatCard
                icon={Activity}
                label="Avg health score"
                value={avgScore}
                sub="out of 100"
                colorClass={cn(
                  avgScore >= 70 ? "bg-green-500/10 text-green-700 dark:text-green-400" :
                  avgScore >= 40 ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" :
                  "bg-red-500/10 text-red-700 dark:text-red-400"
                )}
              />
              <StatCard
                icon={TrendingUp}
                label="Healthy repos"
                value={healthyCount}
                sub="score ≥ 70"
                colorClass="bg-green-500/10 text-green-700 dark:text-green-400"
              />
              <StatCard
                icon={TrendingDown}
                label="At risk"
                value={atRiskCount}
                sub="score < 40"
                colorClass="bg-red-500/10 text-red-700 dark:text-red-400"
              />
            </div>
          )}

          {/* Controls */}
          {!isLoading && allIntel.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  placeholder="Search repos…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Sort:</span>
                <SortButton field="health_score" label="Health" />
                <SortButton field="analyzed_at" label="Recent" />
                <SortButton field="name" label="Name" />
              </div>

              <Select value={verdictFilter} onValueChange={v => setVerdictFilter(v as VerdictFilter)}>
                <SelectTrigger className="h-8 w-auto gap-1.5 text-xs">
                  <SlidersHorizontal className="h-3 w-3" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All verdicts</SelectItem>
                  <SelectItem value="actively-maintained">Active</SelectItem>
                  <SelectItem value="lightly-maintained">Light</SelectItem>
                  <SelectItem value="stale">Stale</SelectItem>
                  <SelectItem value="abandoned">Abandoned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl border border-border/40 bg-muted/20" />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Failed to load intel. Please refresh and try again.
            </div>
          ) : allIntel.length === 0 ? (
            <EmptyState />
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No repos match your current filters.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "repo" : "repos"}
                {filtered.length < allIntel.length ? ` (filtered from ${allIntel.length})` : ""}
              </p>
              {filtered.map(intel => (
                <IntelCard key={intel.id} intel={intel} />
              ))}
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
