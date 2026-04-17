"use client"

import { useState, useCallback } from "react"
import useSWR from "swr"
import {
  Activity, AlertTriangle, CheckCircle2, Clock, GitPullRequest,
  Heart, Loader2, RefreshCw, Users, Zap, AlertCircle, TrendingUp,
  ShieldCheck, FlaskConical, XCircle, Minus,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import type { RepoIntel, MaintenanceVerdict, CommunitySentiment, AdoptionReadiness } from "@/lib/types"

interface RepoIntelTabProps {
  owner: string
  name: string
}

// ─── Config maps ──────────────────────────────────────────────────────────────

const VERDICT_CONFIG: Record<MaintenanceVerdict, { label: string; icon: React.ElementType; className: string }> = {
  'actively-maintained': { label: 'Actively Maintained', icon: CheckCircle2, className: 'bg-green-500/15 text-green-400 border-green-500/30' },
  'lightly-maintained': { label: 'Lightly Maintained', icon: Activity, className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  'stale': { label: 'Stale', icon: Clock, className: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  'abandoned': { label: 'Abandoned', icon: XCircle, className: 'bg-red-500/15 text-red-400 border-red-500/30' },
}

const SENTIMENT_CONFIG: Record<CommunitySentiment, { label: string; icon: React.ElementType; className: string }> = {
  'positive': { label: 'Positive Community', icon: Heart, className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  'mixed': { label: 'Mixed Sentiment', icon: Minus, className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
  'frustrated': { label: 'Frustrated Users', icon: AlertTriangle, className: 'bg-red-500/15 text-red-400 border-red-500/30' },
}

const ADOPTION_CONFIG: Record<AdoptionReadiness, { label: string; icon: React.ElementType; className: string }> = {
  'production-ready': { label: 'Production Ready', icon: ShieldCheck, className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  'maturing': { label: 'Maturing', icon: TrendingUp, className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  'experimental': { label: 'Experimental', icon: FlaskConical, className: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  'deprecated': { label: 'Deprecated', icon: XCircle, className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
}

// ─── Health score circle ───────────────────────────────────────────────────────

function HealthScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? 'text-green-400' : score >= 40 ? 'text-yellow-400' : 'text-red-400'
  const strokeColor = score >= 70 ? '#4ade80' : score >= 40 ? '#facc15' : '#f87171'

  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative flex items-center justify-center w-20 h-20">
      <svg className="absolute inset-0 -rotate-90" width="80" height="80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" strokeWidth="4" className="text-border" />
        <circle
          cx="40" cy="40" r={radius} fill="none"
          stroke={strokeColor} strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className={cn("text-xl font-bold font-mono", color)}>{score}</div>
    </div>
  )
}

// ─── Metric chip ──────────────────────────────────────────────────────────────

function MetricChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide leading-none mb-0.5">{label}</div>
        <div className="text-xs font-medium text-foreground leading-none">{value}</div>
      </div>
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
    : `/api/ai/repo-intel?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(name)}&_k=${refreshKey}`

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
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Analyzing repository…</p>
          <p className="text-xs text-muted-foreground mt-1">Fetching issues, PRs, and running AI synthesis</p>
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !intel) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <AlertCircle className="h-6 w-6 text-destructive" />
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
  const verdictCfg = VERDICT_CONFIG[intel.maintenanceVerdict]
  const sentimentCfg = SENTIMENT_CONFIG[intel.communitySentiment]
  const adoptionCfg = ADOPTION_CONFIG[intel.adoptionReadiness]
  const VerdictIcon = verdictCfg.icon
  const SentimentIcon = sentimentCfg.icon
  const AdoptionIcon = adoptionCfg.icon
  const { metrics } = intel

  return (
    <div className="flex flex-col gap-4">
      {/* Score + verdict row */}
      <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/20 p-4">
        <HealthScoreRing score={intel.healthScore} />
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Health Score</div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className={cn("gap-1 text-xs", verdictCfg.className)}>
              <VerdictIcon className="h-3 w-3" />
              {verdictCfg.label}
            </Badge>
            <Badge variant="outline" className={cn("gap-1 text-xs", sentimentCfg.className)}>
              <SentimentIcon className="h-3 w-3" />
              {sentimentCfg.label}
            </Badge>
            <Badge variant="outline" className={cn("gap-1 text-xs", adoptionCfg.className)}>
              <AdoptionIcon className="h-3 w-3" />
              {adoptionCfg.label}
            </Badge>
          </div>
        </div>
      </div>

      {/* AI Summary */}
      <div className="rounded-xl border border-border bg-muted/10 p-3.5">
        <p className="text-xs leading-relaxed text-muted-foreground">{intel.summary}</p>
      </div>

      {/* Key signals grid */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Key Signals</h4>
        <div className="grid grid-cols-2 gap-2">
          <MetricChip icon={CheckCircle2} label="Issue close rate" value={pct(metrics.issueCloseRate)} />
          <MetricChip icon={GitPullRequest} label="PR merge rate" value={pct(metrics.prMergeRate)} />
          <MetricChip icon={Users} label="Contributors" value={String(metrics.activeContributors90d)} />
          <MetricChip
            icon={Clock}
            label="Last commit"
            value={days(metrics.daysSinceLastCommit)}
          />
          {metrics.avgIssueResponseDays !== null && (
            <MetricChip
              icon={Activity}
              label="Avg response"
              value={`${Math.round(metrics.avgIssueResponseDays)}d`}
            />
          )}
          {metrics.staleIssueCount > 0 && (
            <MetricChip
              icon={AlertTriangle}
              label="Stale issues"
              value={String(metrics.staleIssueCount)}
            />
          )}
        </div>
      </div>

      {/* Top pain points */}
      {intel.topPainPoints.length > 0 && (
        <div>
          <Separator className="mb-3" />
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Top Pain Points</h4>
          <ul className="flex flex-col gap-1.5">
            {intel.topPainPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full bg-orange-500/20 flex items-center justify-center text-[9px] font-bold text-orange-400">
                  {i + 1}
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendation callout */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-3.5 py-3 flex gap-2.5">
        <Zap className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-300 leading-relaxed">{intel.recommendation}</p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground/60 pt-1">
        <span>
          {data?.cached ? 'Cached · ' : ''}
          Analyzed {formatDistanceToNow(new Date(intel.analyzedAt), { addSuffix: true })}
        </span>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1 hover:text-muted-foreground transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>
    </div>
  )
}
