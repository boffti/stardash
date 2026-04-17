"use client"

import { useState, useCallback, useEffect } from "react"
import useSWR from "swr"
import {
  AlertTriangle, AlertCircle, Loader2, RefreshCw, Zap,
  CheckCircle2, Activity, Clock, XCircle,
  Heart, Minus,
  ShieldCheck, TrendingUp, FlaskConical,
  GitPullRequest, Users, GitCommit, FileCode2, BookOpen, Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import type { RepoIntel, MaintenanceVerdict, CommunitySentiment, AdoptionReadiness } from "@/lib/types"

interface RepoIntelTabProps {
  owner: string
  name: string
}

// ─── Config maps ──────────────────────────────────────────────────────────────

const VERDICT_CONFIG: Record<MaintenanceVerdict, {
  label: string; short: string; icon: React.ElementType;
  className: string; dotColor: string;
}> = {
  'actively-maintained': { label: 'Actively Maintained', short: 'Active', icon: CheckCircle2, className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30', dotColor: 'bg-green-600 dark:bg-green-400' },
  'lightly-maintained': { label: 'Lightly Maintained', short: 'Light', icon: Activity, className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30', dotColor: 'bg-yellow-600 dark:bg-yellow-400' },
  'stale': { label: 'Stale', short: 'Stale', icon: Clock, className: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30', dotColor: 'bg-orange-600 dark:bg-orange-400' },
  'abandoned': { label: 'Abandoned', short: 'Dead', icon: XCircle, className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30', dotColor: 'bg-red-600 dark:bg-red-400' },
}

const SENTIMENT_CONFIG: Record<CommunitySentiment, {
  label: string; short: string; icon: React.ElementType;
  className: string; dotColor: string;
}> = {
  'positive': { label: 'Positive', short: 'Positive', icon: Heart, className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', dotColor: 'bg-emerald-600 dark:bg-emerald-400' },
  'mixed': { label: 'Mixed', short: 'Mixed', icon: Minus, className: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30', dotColor: 'bg-zinc-500 dark:bg-zinc-400' },
  'frustrated': { label: 'Frustrated', short: 'Frustrated', icon: AlertTriangle, className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30', dotColor: 'bg-red-600 dark:bg-red-400' },
}

const ADOPTION_CONFIG: Record<AdoptionReadiness, {
  label: string; short: string; icon: React.ElementType;
  className: string; dotColor: string;
}> = {
  'production-ready': { label: 'Production Ready', short: 'Prod Ready', icon: ShieldCheck, className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30', dotColor: 'bg-blue-600 dark:bg-blue-400' },
  'maturing': { label: 'Maturing', short: 'Maturing', icon: TrendingUp, className: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30', dotColor: 'bg-violet-600 dark:bg-violet-400' },
  'experimental': { label: 'Experimental', short: 'Experimental', icon: FlaskConical, className: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30', dotColor: 'bg-orange-600 dark:bg-orange-400' },
  'deprecated': { label: 'Deprecated', short: 'Deprecated', icon: XCircle, className: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30', dotColor: 'bg-zinc-500 dark:bg-zinc-400' },
}

// ─── Health score ring (animated count-up + glow) ─────────────────────────────

function HealthScoreRing({ score }: { score: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const start = performance.now()
    const duration = 900
    const raf = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(score * eased))
      if (t < 1) requestAnimationFrame(raf)
    }
    const id = requestAnimationFrame(raf)
    return () => cancelAnimationFrame(id)
  }, [score])

  const strokeColor = score >= 70 ? '#4ade80' : score >= 40 ? '#facc15' : '#f87171'
  const textColor   = score >= 70 ? 'text-green-700 dark:text-green-400' : score >= 40 ? 'text-yellow-700 dark:text-yellow-400' : 'text-red-700 dark:text-red-400'
  const glowColor   = score >= 70 ? 'rgba(74,222,128,0.18)' : score >= 40 ? 'rgba(250,204,21,0.15)' : 'rgba(248,113,113,0.18)'
  const label       = score >= 70 ? 'Healthy' : score >= 40 ? 'Moderate' : 'At Risk'

  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex items-center justify-center" style={{ width: 88, height: 88 }}>
        <div className="absolute inset-3 rounded-full blur-lg" style={{ background: glowColor }} />
        <svg className="absolute inset-0 -rotate-90" width="88" height="88">
          <circle cx="44" cy="44" r={radius} fill="none" stroke="currentColor" strokeWidth="5" className="text-border" />
          <circle
            cx="44" cy="44" r={radius} fill="none"
            stroke={strokeColor} strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.9s cubic-bezier(0.34,1.56,0.64,1)',
              filter: `drop-shadow(0 0 5px ${strokeColor}88)`,
            }}
          />
        </svg>
        <div className="relative flex flex-col items-center leading-none">
          <span className={cn("text-2xl font-bold font-mono tabular-nums", textColor)}>{display}</span>
          <span className="text-[9px] text-muted-foreground/80 mt-0.5 tracking-wider">/ 100</span>
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">Health Score</p>
        <p className={cn("text-base font-semibold leading-tight", textColor)}>{label}</p>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">AI-powered analysis</p>
      </div>
    </div>
  )
}

// ─── Status cell (3-column classification strip) ──────────────────────────────

function StatusCell({ category, value, className, dotColor }: {
  category: string
  value: string
  className: string
  dotColor: string
}) {
  return (
    <div className={cn("flex-1 rounded-lg border px-2.5 py-2 min-w-0", className)}>
      <p className="text-[9px] uppercase tracking-widest opacity-60 mb-1 leading-none">{category}</p>
      <div className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColor)} />
        <p className="text-[11px] font-medium leading-tight truncate">{value}</p>
      </div>
    </div>
  )
}

// ─── Signal bar (metric card with optional fill bar) ─────────────────────────

function SignalBar({ label, value, fill, fillColor }: {
  label: string
  value: string
  fill?: number
  fillColor?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground/70 leading-none mb-1.5">{label}</p>
      <p className="text-sm font-semibold font-mono tabular-nums leading-none mb-2">{value}</p>
      {fill !== undefined && (
        <div className="h-[3px] rounded-full bg-border overflow-hidden">
          <div
            className={cn("h-full rounded-full", fillColor ?? "bg-primary")}
            style={{ width: `${Math.round(fill * 100)}%`, transition: 'width 0.8s ease-out' }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Community health pill ────────────────────────────────────────────────────

function HealthPill({ label, icon: Icon, present }: { label: string; icon: React.ElementType; present: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-medium border",
      present
        ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/25"
        : "bg-muted/30 text-muted-foreground/60 border-border"
    )}>
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </div>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 shrink-0">{children}</p>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  )
}

// ─── Fetcher ─────────────────────────────────────────────────────────────────

async function fetchIntel(url: string): Promise<{ intel: RepoIntel; cached: boolean }> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'Failed to fetch repo intel')
  }
  return res.json()
}

// ─── localStorage cache (7-day TTL, mirrors server-side DB cache) ─────────────

const LS_TTL = 7 * 24 * 60 * 60 * 1000

function lsKey(owner: string, name: string) {
  return `stardash-intel:${owner}/${name}`
}

function lsGet(owner: string, name: string): { intel: RepoIntel; cached: boolean } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(lsKey(owner, name))
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > LS_TTL) return null
    return data
  } catch {
    return null
  }
}

function lsSet(owner: string, name: string, data: { intel: RepoIntel; cached: boolean }) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(lsKey(owner, name), JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(v: number) { return `${Math.round(v * 100)}%` }
function days(v: number | null, fallback = 'N/A') {
  if (v === null) return fallback
  if (v === 0) return 'Today'
  if (v === 1) return '1 day ago'
  if (v < 365) return `${v}d ago`
  return `${Math.round(v / 365)}y ago`
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RepoIntelTab({ owner, name }: RepoIntelTabProps) {
  const [refreshKey, setRefreshKey] = useState(0)

  // Use localStorage cache on initial load; bypass on manual refresh
  const localCached = refreshKey === 0 ? lsGet(owner, name) : null

  const apiUrl = localCached
    ? null  // skip fetch — serve from local cache
    : `/api/ai/repo-intel?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(name)}&_k=${refreshKey}${refreshKey > 0 ? '&refresh=true' : ''}`

  const { data, error, isLoading } = useSWR<{ intel: RepoIntel; cached: boolean }>(
    apiUrl,
    fetchIntel,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      onSuccess(result) { lsSet(owner, name, result) },
    }
  )

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  const intel = (data ?? localCached)?.intel

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 py-2 animate-pulse">
        <div className="h-24 rounded-xl bg-muted/30" />
        <div className="flex gap-2">
          <div className="flex-1 h-12 rounded-lg bg-muted/20" />
          <div className="flex-1 h-12 rounded-lg bg-muted/20" />
          <div className="flex-1 h-12 rounded-lg bg-muted/20" />
        </div>
        <div className="h-16 rounded-xl bg-muted/20" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/20" />
          ))}
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/50 shrink-0" />
          <p className="text-xs text-muted-foreground/50">Fetching issues, PRs, and running AI synthesis…</p>
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !intel) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <p className="text-sm font-medium">Analysis failed</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-56">
            {error?.message ?? 'Something went wrong. Please try again.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Try Again
        </Button>
      </div>
    )
  }

  // ── Results ───────────────────────────────────────────────────────────────
  const verdictCfg  = VERDICT_CONFIG[intel.maintenanceVerdict]
  const sentimentCfg = SENTIMENT_CONFIG[intel.communitySentiment]
  const adoptionCfg  = ADOPTION_CONFIG[intel.adoptionReadiness]
  const { metrics }  = intel
  const assessment = metrics.maintenanceAssessment

  const rateColor = (r: number) =>
    r >= 0.7 ? 'bg-emerald-500' : r >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="flex flex-col gap-3.5">

      {/* ── Score hero ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-muted/40 to-muted/10 px-4 py-3.5">
        <HealthScoreRing score={intel.healthScore} />
      </div>

      {/* ── Classification strip ────────────────────────────────────────── */}
      <div className="flex gap-2">
        <StatusCell
          category="Maintenance"
          value={verdictCfg.label}
          className={verdictCfg.className}
          dotColor={verdictCfg.dotColor}
        />
        <StatusCell
          category="Community"
          value={sentimentCfg.label}
          className={sentimentCfg.className}
          dotColor={sentimentCfg.dotColor}
        />
        <StatusCell
          category="Adoption"
          value={adoptionCfg.label}
          className={adoptionCfg.className}
          dotColor={adoptionCfg.dotColor}
        />
      </div>

      {/* ── AI Summary ──────────────────────────────────────────────────── */}
      <div className="border-l-2 border-muted-foreground/20 pl-3.5 py-0.5">
        <p className="text-xs leading-relaxed text-muted-foreground">{intel.summary}</p>
      </div>

      {/* ── Key signals ─────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Key Signals</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <SignalBar
            label="Issue Close Rate"
            value={pct(metrics.issueCloseRate)}
            fill={metrics.issueCloseRate}
            fillColor={rateColor(metrics.issueCloseRate)}
          />
          <SignalBar
            label="PR Merge Rate"
            value={pct(metrics.prMergeRate)}
            fill={metrics.prMergeRate}
            fillColor={rateColor(metrics.prMergeRate)}
          />
          <SignalBar
            label="Commit Authors (90d)"
            value={String(metrics.activeCommitAuthors90d ?? metrics.activeContributors90d)}
          />
          {metrics.commits90d !== undefined && (
            <SignalBar
              label="Commits (90d)"
              value={String(metrics.commits90d)}
            />
          )}
          <SignalBar
            label="Last Commit"
            value={days(metrics.daysSinceLastCommit)}
          />
          {metrics.avgIssueResponseDays !== null && (
            <SignalBar
              label="Issue Close Time"
              value={`${Math.round(metrics.avgIssueResponseDays)}d`}
            />
          )}
          {metrics.avgPrMergeDays !== null && (
            <SignalBar
              label="Avg PR Merge Time"
              value={`${Math.round(metrics.avgPrMergeDays)}d`}
            />
          )}
          {metrics.staleIssueCount > 0 && (
            <SignalBar
              label="Stale Issues"
              value={String(metrics.staleIssueCount)}
            />
          )}
          {metrics.daysSinceLastRelease !== null && (
            <SignalBar
              label="Last Release"
              value={days(metrics.daysSinceLastRelease)}
            />
          )}
        </div>
      </div>

      {assessment && (
        <div>
          <SectionLabel>Maintenance Rationale</SectionLabel>
          <div className="rounded-lg border border-border bg-muted/15 px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                Confidence {Math.round(assessment.confidence * 100)}%
              </p>
              <p className="font-mono text-xs text-muted-foreground">{assessment.score}/100</p>
            </div>
            <ul className="flex flex-col gap-1.5">
              {assessment.reasons.slice(0, 4).map((reason, i) => (
                <li key={i} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── Community health ────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Community Health</SectionLabel>
        <div className="flex gap-2 flex-wrap">
          <HealthPill label="CI Setup" icon={FileCode2} present={metrics.hasCommunityFiles.ci} />
          <HealthPill label="Contributing Guide" icon={BookOpen} present={metrics.hasCommunityFiles.contributingGuide} />
          <HealthPill label="Code of Conduct" icon={Shield} present={metrics.hasCommunityFiles.codeOfConduct} />
        </div>
      </div>

      {/* ── Pain points ─────────────────────────────────────────────────── */}
      {intel.topPainPoints.length > 0 && (
        <div>
          <SectionLabel>Known Pain Points</SectionLabel>
          <ul className="flex flex-col gap-2">
            {intel.topPainPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex-none h-4 w-4 rounded bg-orange-500/15 border border-orange-500/25 flex items-center justify-center text-[9px] font-bold font-mono text-orange-700 dark:text-orange-400 leading-none">
                  {i + 1}
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">{point}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Recommendation ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-blue-500/25 bg-gradient-to-br from-blue-500/8 to-transparent px-4 py-3 flex gap-3">
        <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-[9px] uppercase tracking-widest text-blue-700 dark:text-blue-400 opacity-70 mb-1">Recommendation</p>
          <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">{intel.recommendation}</p>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 pt-0.5">
        <span>
          {data?.cached === false ? 'Fresh · ' : 'Cached · '}
          Analyzed {formatDistanceToNow(new Date(intel.analyzedAt), { addSuffix: true })}
        </span>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1 hover:text-muted-foreground/70 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

    </div>
  )
}
