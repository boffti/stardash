"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { format, formatDistanceToNow } from "date-fns"
import {
  ArrowLeft, ExternalLink, Brain, RefreshCw, Loader2,
  Wrench, Activity, Users, Shield, Flame, TrendingUp, TrendingDown,
  Minus, CheckCircle2, XCircle, AlertCircle,
  BookOpen, FileCode2, ShieldCheck, Sparkles,
  Star, GitFork, Scale, Globe, GitCommit, GitPullRequest,
} from "lucide-react"
import type { User } from "@supabase/supabase-js"
import type { RepoIntel, StarredRepo, UserMetadata } from "@/lib/types"
import { STATUS_LABELS } from "@/lib/types"
import { computeSubScores } from "@/lib/intel-sub-scores"
import { cn } from "@/lib/utils"
import { useStarredRepos } from "@/lib/use-starred-repos"
import { AppSidebar } from "@/components/app-sidebar"
import { AppPageHeader } from "@/components/app-page-header"
import { GitHubIcon } from "@/components/icons/github-icon"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  owner: string
  repo: string
  user: User | null
}

type StarVelocityLabel = 'on-fire' | 'heating-up' | 'steady' | 'cooling'

interface StarVelocity {
  growth7d: number
  growth30d: number
  growth90d?: number
  label: StarVelocityLabel
}

interface HealthEntry {
  isTrending: boolean
  latestRelease: { tagName: string; publishedAt: string } | null
  starVelocity: StarVelocity | null
}

// ─── Config ───────────────────────────────────────────────────────────────────

const velocityConfig: Record<StarVelocityLabel, {
  icon: React.ElementType
  label: string
  className: string
}> = {
  'on-fire':    { icon: Flame,        label: 'On Fire',    className: 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20' },
  'heating-up': { icon: TrendingUp,   label: 'Heating Up', className: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  'steady':     { icon: Minus,        label: 'Steady',     className: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20' },
  'cooling':    { icon: TrendingDown, label: 'Cooling',    className: 'text-zinc-600 dark:text-zinc-400 bg-zinc-500/10 border-zinc-500/20' },
}

const verdictConfig: Record<string, { label: string; dotClass: string }> = {
  'actively-maintained': { label: 'Actively Maintained', dotClass: 'bg-emerald-500' },
  'lightly-maintained':  { label: 'Lightly Maintained',  dotClass: 'bg-amber-500' },
  'stale':               { label: 'Stale',               dotClass: 'bg-orange-500' },
  'abandoned':           { label: 'Abandoned',           dotClass: 'bg-rose-500' },
}

const signalColor: Record<string, string> = {
  strong:  'text-emerald-600 dark:text-emerald-400',
  ok:      'text-sky-600 dark:text-sky-400',
  weak:    'text-amber-600 dark:text-amber-400',
  bad:     'text-rose-600 dark:text-rose-400',
  unknown: 'text-muted-foreground/50',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
})

function scoreColor(score: number) {
  if (score >= 70) return { text: 'text-emerald-600 dark:text-emerald-400', ring: '#10b981', track: 'rgba(16,185,129,0.10)', glow: '#10b98130' }
  if (score >= 40) return { text: 'text-amber-600 dark:text-amber-400',   ring: '#f59e0b', track: 'rgba(245,158,11,0.10)',  glow: '#f59e0b30' }
  return               { text: 'text-rose-600 dark:text-rose-400',        ring: '#f43f5e', track: 'rgba(244,63,94,0.10)',   glow: '#f43f5e30' }
}

function formatNumber(num: number): string {
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k"
  return num.toString()
}

function formatOptionalDays(days: number | null | undefined): string {
  if (days === undefined || days === null) return "Unknown"
  if (days === 0) return "Today"
  if (days === 1) return "1 day"
  return `${Math.round(days)} days`
}

function formatOptionalPercent(value: number | null | undefined): string {
  if (value === undefined || value === null) return "Unknown"
  return `${Math.round(value * 100)}%`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreDial({ score, size, label, icon: Icon }: {
  score: number; size: number; label?: string; icon?: React.ElementType
}) {
  const sw = size > 80 ? 7 : 5
  const r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const c = scoreColor(score)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" style={{ filter: size > 80 ? `drop-shadow(0 0 8px ${c.glow})` : undefined }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw} stroke={c.track} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw}
            stroke={c.ring} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div className="absolute flex flex-col items-center leading-none">
          <span className={cn(size > 80 ? "text-2xl" : "text-sm", "font-bold tabular-nums", c.text)}>{score}</span>
          {size > 80 && <span className="text-[10px] text-muted-foreground mt-0.5">/ 100</span>}
        </div>
      </div>
      {(label || Icon) && (
        <div className="flex flex-col items-center gap-1">
          {Icon && <Icon className={cn("h-3.5 w-3.5", c.text)} />}
          {label && <span className="text-xs text-muted-foreground">{label}</span>}
        </div>
      )}
    </div>
  )
}

function MaturityBadge({ present, label, icon: Icon }: {
  present: boolean; label: string; icon: React.ElementType
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors",
      present
        ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400"
        : "border-border/40 bg-muted/15 text-muted-foreground/50"
    )}>
      {present
        ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        : <XCircle className="h-3.5 w-3.5 shrink-0" />
      }
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </div>
  )
}

function RepoHero({ repo, owner, name }: { repo: StarredRepo | null; owner: string; name: string }) {
  const fullName = repo?.fullName ?? `${owner}/${name}`
  const avatarUrl = repo?.avatarUrl

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      {repo?.archived && (
        <div className="flex items-center gap-2 border-b border-orange-500/20 bg-orange-500/10 px-5 py-2 text-xs text-orange-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Archived - no longer actively maintained.
        </div>
      )}

      <div className="px-5 pt-4 pb-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0 rounded-lg">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={owner} />}
              <AvatarFallback className="rounded-lg">{owner[0]?.toUpperCase() ?? "R"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{owner}</p>
              <h1 className="truncate font-mono text-xl font-semibold leading-tight">{name}</h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
              <a href={`https://github.com/${fullName}`} target="_blank" rel="noopener noreferrer">
                <GitHubIcon className="h-3.5 w-3.5" />
                GitHub
              </a>
            </Button>
          </div>
        </div>

        {repo?.description && (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {repo.description}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          {repo ? (
            <>
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
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: repo.languageColor || "#64748b" }} />
                  {repo.language}
                </span>
              )}
              {repo.license && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Scale className="h-3.5 w-3.5" />
                  {repo.license}
                </span>
              )}
              {repo.isTrending && (
                <Badge variant="outline" className="h-5 gap-1 border-amber-500/30 bg-amber-500/10 text-xs text-amber-400">
                  <Flame className="h-3 w-3" />
                  Trending
                </Badge>
              )}
              {repo.status && (
                <Badge variant="outline" className={cn("h-5 text-xs", STATUS_LABELS[repo.status].color)}>
                  {STATUS_LABELS[repo.status].label}
                </Badge>
              )}
              <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5" />
                Updated {formatDistanceToNow(new Date(repo.pushedAt), { addSuffix: true })}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Repository metadata is loading.</span>
          )}
        </div>
      </div>

      {repo && (
        <>
          <Separator className="mt-4 opacity-60" />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Star className="h-3 w-3" />
              Starred {format(new Date(repo.starredAt), "MMM d, yyyy")}
            </span>
            {repo.homepage && (
              <a href={repo.homepage} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-accent hover:underline">
                <Globe className="h-3 w-3" />
                {repo.homepage.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {[
                { icon: AlertCircle, label: "Issues", path: "issues" },
                { icon: GitCommit, label: "PRs", path: "pulls" },
                { icon: BookOpen, label: "Releases", path: "releases" },
              ].map(({ icon: Icon, label, path }) => (
                <Button key={label} variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground" asChild>
                  <a href={`https://github.com/${repo.fullName}/${path}`} target="_blank" rel="noopener noreferrer">
                    <Icon className="h-3 w-3" />
                    {label}
                  </a>
                </Button>
              ))}
            </div>
          </div>

          {repo.topics.length > 0 && (
            <>
              <Separator className="opacity-60" />
              <div className="flex flex-wrap gap-1.5 px-5 py-3">
                {repo.topics.slice(0, 10).map((topic) => (
                  <Badge key={topic} variant="secondary" className="h-5 text-xs">
                    {topic}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

type EvidenceTone = "good" | "watch" | "risk" | "neutral"

const evidenceToneStyles: Record<EvidenceTone, {
  panel: string
  icon: string
  badge: string
  dot: string
}> = {
  good: {
    panel: "border-emerald-500/20 bg-emerald-500/5",
    icon: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  watch: {
    panel: "border-amber-500/20 bg-amber-500/5",
    icon: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    badge: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  risk: {
    panel: "border-rose-500/20 bg-rose-500/5",
    icon: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
    badge: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  neutral: {
    panel: "border-border/50 bg-muted/15",
    icon: "border-border/60 bg-background text-muted-foreground",
    badge: "border-border/60 bg-background text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
}

function evidenceStatus(tone: EvidenceTone) {
  if (tone === "good") return "Healthy"
  if (tone === "watch") return "Watch"
  if (tone === "risk") return "Risk"
  return "Unknown"
}

function toneForVelocity(label: StarVelocityLabel | undefined): EvidenceTone {
  if (!label) return "neutral"
  if (label === "on-fire" || label === "heating-up") return "good"
  if (label === "steady") return "watch"
  return "risk"
}

function toneForReleaseCount(count: number): EvidenceTone {
  if (count >= 2) return "good"
  if (count >= 1) return "watch"
  return "risk"
}

function toneForContributorShare(share: number | null | undefined): EvidenceTone {
  if (share === undefined || share === null) return "neutral"
  if (share <= 0.7) return "good"
  if (share <= 0.85) return "watch"
  return "risk"
}

function toneForStaleWork(count: number): EvidenceTone {
  if (count <= 2) return "good"
  if (count <= 8) return "watch"
  return "risk"
}

function toneForCommits(count: number): EvidenceTone {
  if (count >= 30) return "good"
  if (count >= 3) return "watch"
  return "risk"
}

function toneForRatio(ratio: number): EvidenceTone {
  if (ratio >= 0.6) return "good"
  if (ratio >= 0.3) return "watch"
  return "risk"
}

function EvidenceSignal({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  className,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  detail?: string
  tone: EvidenceTone
  className?: string
}) {
  const styles = evidenceToneStyles[tone]

  return (
    <div className={cn("rounded-lg border px-3.5 py-3 transition-colors", styles.panel, className)}>
      <div className="flex items-start justify-between gap-3">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md border", styles.icon)}>
          <Icon className="h-4 w-4" />
        </div>
        <Badge variant="outline" className={cn("h-5 gap-1 rounded-md px-1.5 text-[10px] font-medium", styles.badge)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
          {evidenceStatus(tone)}
        </Badge>
      </div>
      <div className="mt-3 min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 truncate text-base font-semibold text-foreground">{value}</div>
        {detail && <div className="mt-1 text-xs leading-snug text-muted-foreground">{detail}</div>}
      </div>
    </div>
  )
}

function EvidencePanel({ intel, velocity }: { intel: RepoIntel; velocity: StarVelocity | null }) {
  const metrics = intel.metrics
  const topThreeShare = metrics.topThreeContributorShare
  const releaseCount = metrics.releases12mo ?? 0
  const stalePrCount = metrics.stalePrCount ?? 0
  const staleWorkCount = metrics.staleIssueCount + stalePrCount
  const commits90d = metrics.commits90d ?? 0
  const concentrationLabel =
    topThreeShare === undefined ? "Unknown"
    : topThreeShare >= 0.85 ? "High concentration"
    : topThreeShare >= 0.7 ? "Moderate concentration"
    : "Distributed"

  return (
    <Card className="gap-0 overflow-hidden border-border/60 bg-card py-0">
      <CardHeader className="border-b border-border/40 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/20 text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold">Evidence</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Deterministic signals behind this report</p>
            </div>
          </div>
          <Badge variant="outline" className="h-6 shrink-0 rounded-md border-border/60 bg-muted/20 px-2 text-[11px] text-muted-foreground">
            7 signals
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid gap-3 lg:grid-cols-4">
          <EvidenceSignal
            icon={velocity ? velocityConfig[velocity.label].icon : Star}
            label="Star velocity"
            value={velocity ? `+${velocity.growth30d}` : "Unknown"}
            detail={velocity ? `+${velocity.growth7d} in 7d / +${velocity.growth90d ?? velocity.growth30d} in 90d` : "Snapshot history unavailable"}
            tone={toneForVelocity(velocity?.label)}
          />
          <EvidenceSignal
            icon={RefreshCw}
            label="Release cadence"
            value={`${releaseCount} / year`}
            detail={`Median ${formatOptionalDays(metrics.releaseCadenceDays)}`}
            tone={toneForReleaseCount(releaseCount)}
          />
          <EvidenceSignal
            icon={Users}
            label="Contributor risk"
            value={concentrationLabel}
            detail={`Top 3 share ${formatOptionalPercent(topThreeShare)}`}
            tone={toneForContributorShare(topThreeShare)}
          />
          <EvidenceSignal
            icon={AlertCircle}
            label="Stale work"
            value={`${staleWorkCount} items`}
            detail={`${metrics.staleIssueCount} stale issues / ${stalePrCount} stale PRs`}
            tone={toneForStaleWork(staleWorkCount)}
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <EvidenceSignal
            icon={GitCommit}
            label="Commits"
            value={`${commits90d} in 90d`}
            detail={`${metrics.activeCommitAuthors90d ?? 0} active authors`}
            tone={toneForCommits(commits90d)}
          />
          <EvidenceSignal
            icon={CheckCircle2}
            label="Issues"
            value={`${Math.round(metrics.issueCloseRate * 100)}% closed`}
            detail={`Median close ${formatOptionalDays(metrics.medianIssueCloseDays ?? metrics.avgIssueResponseDays)}`}
            tone={toneForRatio(metrics.issueCloseRate)}
          />
          <EvidenceSignal
            icon={GitPullRequest}
            label="Pull requests"
            value={`${Math.round(metrics.prMergeRate * 100)}% merged`}
            detail={`Median merge ${formatOptionalDays(metrics.avgPrMergeDays)}`}
            tone={toneForRatio(metrics.prMergeRate)}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RepoIntelPage({ owner, repo, user }: Props) {
  const [refresh, setRefresh] = useState(false)

  const intelUrl = `/api/ai/repo-intel?owner=${owner}&repo=${repo}${refresh ? '&refresh=true' : ''}`
  const { data: intelData, isLoading, error, mutate } = useSWR<{
    intel: RepoIntel; cached: boolean; limitReached?: boolean
  }>(intelUrl, fetcher, { revalidateOnFocus: false })

  const { data: repoMeta } = useSWR<{ githubRepoId: number | null }>(
    `/api/github/repo-meta?owner=${owner}&repo=${repo}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  const healthUrl = repoMeta?.githubRepoId
    ? `/api/github/health?repoIds=${repoMeta.githubRepoId}`
    : null

  const { data: healthData } = useSWR<Record<string, HealthEntry>>(
    healthUrl, fetcher, { revalidateOnFocus: false }
  )

  const { data: starredData } = useStarredRepos(user?.id)

  const { data: metadata } = useSWR<UserMetadata>(
    user?.id ? "/api/user/metadata" : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  const repos = useMemo(() => {
    const rawRepos = starredData?.repos ?? []

    return rawRepos.map((starredRepo) => {
      const dbMeta = metadata?.repoMeta[starredRepo.id]
      if (!dbMeta) return starredRepo

      const dbTags = (metadata?.tags ?? []).filter((tag) => dbMeta.tagIds.includes(tag.id))
      return {
        ...starredRepo,
        status: dbMeta.status ?? starredRepo.status,
        isPinned: dbMeta.isPinned,
        notes: dbMeta.notes ?? starredRepo.notes,
        tags: dbTags,
        collections: dbMeta.collectionIds,
      }
    })
  }, [starredData?.repos, metadata])

  const uncategorizedCount = useMemo(() => {
    return repos.filter((starredRepo) => starredRepo.tags.length === 0 && starredRepo.collections.length === 0).length
  }, [repos])

  const currentRepo = useMemo(() => {
    return repos.find((starredRepo) => starredRepo.fullName === `${owner}/${repo}`) ?? null
  }, [owner, repo, repos])

  const intel = intelData?.intel
  const subScores = intel ? computeSubScores(intel.metrics) : null
  const velocity = repoMeta?.githubRepoId
    ? healthData?.[repoMeta.githubRepoId]?.starVelocity ?? null
    : null

  const handleRefresh = () => {
    setRefresh(true)
    mutate()
  }

  const cf = intel?.metrics.hasCommunityFiles
  const assessment = intel?.metrics.maintenanceAssessment

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
          lastSynced={null}
          user={user}
          hideNavActions
          actions={
            <>
              <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                <Link href="/intel">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Intel
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                <a href={`https://github.com/${owner}/${repo}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  GitHub
                </a>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRefresh} disabled={isLoading}>
                {isLoading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />
                }
                {isLoading ? 'Analyzing...' : 'Re-analyze'}
              </Button>
            </>
          }
        />

        <main className="flex-1 p-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Button asChild variant="ghost" size="sm" className="h-7 gap-1.5 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground">
                <Link href="/intel" className="hover:text-foreground">Intel</Link>
              </Button>
              <span className="text-border">/</span>
              <span className="text-muted-foreground">{owner}</span>
              <span className="text-border">/</span>
              <span className="font-mono font-medium">{repo}</span>
            </div>

            <div className="flex flex-wrap gap-2 md:hidden">
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link href="/intel">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Intel
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                <a href={`https://github.com/${owner}/${repo}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  GitHub
                </a>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRefresh} disabled={isLoading}>
                {isLoading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />
                }
                {isLoading ? 'Analyzing...' : 'Re-analyze'}
              </Button>
            </div>

            <RepoHero repo={currentRepo} owner={owner} name={repo} />

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <Brain className="h-8 w-8 animate-pulse text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Analyzing repository…</p>
            <p className="text-xs text-muted-foreground/60">This may take a moment</p>
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Failed to load intel. Check your AI key or try again.
          </div>
        )}

        {/* Limit warning */}
        {!isLoading && intelData?.limitReached && (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Weekly AI limit reached — showing cached analysis.
          </div>
        )}

        {/* Intel content */}
        {!isLoading && intel && subScores && (
          <>
            {/* Score overview */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Health Overview</CardTitle>
                  {intelData?.cached && (
                    <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Analyzed {formatDistanceToNow(new Date(intel.analyzedAt), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
                  <ScoreDial score={intel.healthScore} size={96} />

                  <div className="hidden h-16 w-px bg-border/50 sm:block" />

                  <div className="grid flex-1 grid-cols-4 gap-4">
                    <ScoreDial score={subScores.maintenance} size={64} label="Maintenance" icon={Wrench} />
                    <ScoreDial score={subScores.activity}    size={64} label="Activity"    icon={Activity} />
                    <ScoreDial score={subScores.community}   size={64} label="Community"   icon={Users} />
                    <ScoreDial score={subScores.trust}       size={64} label="Trust"       icon={Shield} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Star velocity */}
            {velocity && (() => {
              const vcfg = velocityConfig[velocity.label]
              return (
                <Card>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", vcfg.className)}>
                      <vcfg.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Star Momentum: {vcfg.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        +{velocity.growth7d} this week · +{velocity.growth30d} this month
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
            })()}

            {/* Status badges */}
            <div className="flex flex-wrap gap-2">
              {(() => {
                const v = verdictConfig[intel.maintenanceVerdict]
                return (
                  <Badge variant="outline" className="gap-1.5 px-3 py-1 text-sm font-medium">
                    <span className={cn("h-1.5 w-1.5 rounded-full", v?.dotClass)} />
                    {v?.label ?? intel.maintenanceVerdict}
                  </Badge>
                )
              })()}
              <Badge variant="outline" className="px-3 py-1 text-sm font-medium">
                {{
                  'production-ready': 'Production Ready',
                  'maturing': 'Maturing',
                  'experimental': 'Experimental',
                  'deprecated': 'Deprecated',
                }[intel.adoptionReadiness] ?? intel.adoptionReadiness}
              </Badge>
              <Badge variant="outline" className="px-3 py-1 text-sm font-medium">
                {{
                  'positive': 'Positive Sentiment',
                  'mixed': 'Mixed Sentiment',
                  'frustrated': 'Frustrated Users',
                }[intel.communitySentiment] ?? intel.communitySentiment}
              </Badge>
            </div>

            <EvidencePanel intel={intel} velocity={velocity} />

            {/* AI summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  <Brain className="h-4 w-4" />
                  AI Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed text-muted-foreground">{intel.summary}</p>
                {intel.recommendation && (
                  <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{intel.recommendation}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Maintenance signals */}
            {assessment && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Maintenance Signals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                    {([
                      { label: 'Commit Recency',  value: assessment.signals.commitRecency },
                      { label: 'Commit Velocity', value: assessment.signals.commitVelocity },
                      { label: 'Issue Response',  value: assessment.signals.issueResponsiveness },
                      { label: 'PR Activity',     value: assessment.signals.prActivity },
                      { label: 'Release Recency', value: assessment.signals.releaseRecency },
                    ] as const).map(({ label, value }) => (
                      <div key={label} className="rounded-lg border border-border/50 bg-muted/15 px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">{label}</div>
                        <div className={cn("mt-1 text-sm font-semibold capitalize", signalColor[value ?? 'unknown'])}>
                          {value ?? 'Unknown'}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {assessment.reasons.map((reason, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{reason}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Governance & maturity */}
            {cf && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Governance & Maturity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <MaturityBadge present={Boolean(cf.readme)} label="README" icon={BookOpen} />
                    <MaturityBadge present={Boolean(cf.license)} label="License" icon={FileCode2} />
                    <MaturityBadge present={Boolean(cf.securityPolicy)} label="Security Policy" icon={ShieldCheck} />
                    <MaturityBadge present={cf.contributingGuide} label="Contributing Guide" icon={BookOpen} />
                    <MaturityBadge present={cf.codeOfConduct}     label="Code of Conduct"   icon={FileCode2} />
                    <MaturityBadge present={Boolean(cf.issueTemplate)} label="Issue Templates" icon={AlertCircle} />
                    <MaturityBadge present={Boolean(cf.pullRequestTemplate)} label="PR Template" icon={GitCommit} />
                    <MaturityBadge present={cf.ci}                label="CI/CD Workflows"   icon={ShieldCheck} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Known issues */}
            {intel.topPainPoints.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    <AlertCircle className="h-4 w-4" />
                    Known Issues
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    {intel.topPainPoints.map((point, i) => (
                      <div key={i} className="flex gap-3 rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-medium text-muted-foreground">
                          {i + 1}
                        </span>
                        <p className="text-sm leading-relaxed text-muted-foreground">{point}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
