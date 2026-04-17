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
  TrendingUp,
  TrendingDown,
  Zap,
  AlertTriangle,
} from "lucide-react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppPageHeader } from "@/components/app-page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { RepoIntel, UserMetadata } from "@/lib/types"
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
    <div className="min-w-0 rounded-lg border border-border/50 bg-muted/15 px-3 py-2">
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
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border/50 bg-card/60 px-4 py-3 text-center">
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", colorClass)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-xl font-bold tabular-nums text-foreground">{value}</div>
      <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
      <div className="relative">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20">
          <Brain className="h-7 w-7 text-muted-foreground/40" />
        </div>
        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-muted/60 text-[10px] text-muted-foreground">
          0
        </div>
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold tracking-tight text-foreground">No intel collected yet</h3>
        <p className="max-w-xs text-sm text-muted-foreground">
          Open any repo from your dashboard, click the <span className="font-medium text-foreground">Intel</span> tab, and run an AI analysis.
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="gap-2">
        <Link href="/dashboard">
          <Zap className="h-3.5 w-3.5" />
          Go to Dashboard
        </Link>
      </Button>
    </div>
  )
}

function IntelCard({ intel, index }: { intel: RepoIntel; index: number }) {
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
  const contributors = intel.metrics?.activeContributors90d ?? null
  const daysSince = intel.metrics?.daysSinceLastCommit ?? null
  const p = healthPalette(intel.healthScore)
  const issueTone = issueClose !== null
    ? issueClose >= 50 ? "text-emerald-600 dark:text-emerald-400" : issueClose >= 25 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"
    : undefined
  const prTone = prMerge !== null
    ? prMerge >= 60 ? "text-emerald-600 dark:text-emerald-400" : prMerge >= 30 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"
    : undefined

  const animDelay = `${index * 60}ms`

  return (
    <Card
      className={cn(
        "group overflow-hidden border-border bg-card py-0 transition-all duration-200",
        "hover:border-muted-foreground/30 hover:bg-card/80",
      )}
      style={{ animationDelay: animDelay, animation: "fadeSlideIn 0.35s ease both" }}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-1 gap-3">
            <ScoreDial score={intel.healthScore} size={48} />

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Link
                    href={`/dashboard?repo=${encodeURIComponent(intel.repoFullName)}`}
                    className="group/link inline-flex min-h-6 max-w-full items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <span className="min-w-0 truncate font-mono text-sm font-medium text-foreground transition-colors group-hover/link:text-primary">
                      <span className="text-muted-foreground">{owner}/</span>{repo}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-all group-hover/link:translate-x-0.5 group-hover/link:text-primary/70" />
                  </Link>
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

              {intel.topPainPoints && intel.topPainPoints.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {intel.topPainPoints.slice(0, 2).map((pt, i) => (
                    <span
                      key={i}
                      className="inline-flex max-w-full items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-400 sm:max-w-[280px]"
                    >
                      <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{pt}</span>
                    </span>
                  ))}
                </div>
              )}
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
              <IntelMetric icon={Users} label="Contributors" value={String(contributors)} detail="90d active" />
            )}
            {daysSince !== null && (
              <IntelMetric icon={Clock} label="Last commit" value={daysSince === 0 ? "Today" : `${daysSince}d`} detail={daysSince === 0 ? undefined : "ago"} />
            )}
          </div>

          <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground/60">
            <Sparkles className="h-3 w-3" />
            <span>Analyzed {formatDistanceToNow(new Date(intel.analyzedAt), { addSuffix: true })}</span>
          </div>
        </div>
      </CardContent>
    </Card>
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

  // Verdict filter pill options
  const verdictOptions: { value: VerdictFilter; label: string; dotClass: string }[] = [
    { value: "all", label: "All", dotClass: "bg-muted-foreground" },
    { value: "actively-maintained", label: "Active", dotClass: "bg-emerald-500" },
    { value: "lightly-maintained", label: "Lightly Maintained", dotClass: "bg-amber-500" },
    { value: "stale", label: "Stale", dotClass: "bg-orange-500" },
    { value: "abandoned", label: "Abandoned", dotClass: "bg-rose-500" },
  ]

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

        {/* Animation keyframes */}
        <style>{`
          @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        <div className="flex flex-1 flex-col gap-0">
          {/* ── Hero header ── */}
          <div className="relative overflow-hidden border-b border-border/50 bg-gradient-to-br from-background via-background to-muted/20 px-6 pb-6 pt-6">
            {/* Faint grid texture */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
              style={{
                backgroundImage: `linear-gradient(hsl(var(--border)) 1px, transparent 1px),
                  linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)`,
                backgroundSize: "32px 32px",
              }}
            />

            <div className="relative">
              {/* Title row */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/8">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-foreground">Repo Intel</h1>
                  <p className="text-[13px] text-muted-foreground">AI-powered health briefs for your starred repos</p>
                </div>
              </div>

              {/* Stats row — only visible when there's data */}
              {!isLoading && allIntel.length > 0 && (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            </div>
          </div>

          {/* ── Controls bar ── */}
          {!isLoading && allIntel.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border/50 bg-muted/10 px-6 py-3">
              {/* Search */}
              <div className="relative min-w-44 flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                <Input
                  placeholder="Search repos…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-8 border-border/60 pl-8 text-sm focus-visible:ring-1"
                />
              </div>

              {/* Sort buttons */}
              <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background p-0.5">
                {(["health_score", "analyzed_at", "name"] as SortField[]).map(f => {
                  const labels: Record<SortField, string> = { health_score: "Health", analyzed_at: "Recent", name: "Name" }
                  const active = sortField === f
                  const Icon = active ? (sortDir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown
                  return (
                    <button
                      key={f}
                      onClick={() => toggleSort(f)}
                      className={cn(
                        "flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors",
                        active
                          ? "bg-foreground/8 text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {labels[f]}
                      <Icon className="h-3 w-3" />
                    </button>
                  )
                })}
              </div>

              {/* Verdict pills */}
              <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background p-0.5">
                {verdictOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setVerdictFilter(opt.value)}
                    className={cn(
                      "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                      verdictFilter === opt.value
                        ? "bg-foreground/8 text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", opt.dotClass)} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Content ── */}
          <div className="flex flex-1 flex-col gap-3 p-6">
            {isLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-36 animate-pulse rounded-2xl border border-border/40 bg-muted/15"
                    style={{ animationDelay: `${i * 80}ms` }}
                  />
                ))}
              </div>
            ) : error ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Failed to load intel. Please refresh and try again.
              </div>
            ) : allIntel.length === 0 ? (
              <EmptyState />
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-muted-foreground">No repos match your current filters.</p>
                <button
                  onClick={() => { setSearch(""); setVerdictFilter("all") }}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-[11px] text-muted-foreground/70">
                  Showing {filtered.length} of {allIntel.length} analyzed {allIntel.length === 1 ? "repo" : "repos"}
                </p>
                {filtered.map((intel, idx) => (
                  <IntelCard key={intel.id} intel={intel} index={idx} />
                ))}
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
