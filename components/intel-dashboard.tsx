"use client"

import { translateIntelLabel } from "@/lib/intel-labels"
import { useI18n } from "@/components/i18n-provider"
import { cn } from "@/lib/utils"
import { healthTone } from "@/lib/palette"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
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
import { TokenExpiredBanner } from "@/components/token-expired-banner"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppPageHeader } from "@/components/app-page-header"
import { RepoDetailPanel } from "@/components/repo-detail-panel"
import { ReadmeViewer } from "@/components/readme-viewer"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePaletteGroups } from "@/components/command-palette"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useStarredRepos } from "@/lib/use-starred-repos"
import { trackRecentlyViewedRepo } from "@/lib/recently-viewed"
import type { RepoIntel, StarredRepo, UserMetadata } from "@/lib/types"
import { useUser } from "@/components/providers/user-provider"

type SortField = "health_score" | "analyzed_at" | "name"
type SortDir = "asc" | "desc"
type VerdictFilter = "all" | "actively-maintained" | "lightly-maintained" | "stale" | "abandoned"

// ─── Verdict / sentiment / readiness config ───────────────────────────────────

const verdictConfig: Record<
  string,
  {
    label: string
    badgeClass: string
    dotClass: string
  }
> = {
  "actively-maintained": {
    label: "Actively Maintained",
    badgeClass: "bg-muted text-foreground border-transparent",
    dotClass: "bg-foreground/40",
  },
  "lightly-maintained": {
    label: "Lightly Maintained",
    badgeClass: "bg-muted text-foreground border-transparent",
    dotClass: "bg-foreground/40",
  },
  stale: {
    label: "Stale",
    badgeClass: "bg-muted text-foreground border-transparent",
    dotClass: "bg-foreground/40",
  },
  abandoned: {
    label: "Abandoned",
    badgeClass: "bg-muted text-destructive border-transparent",
    dotClass: "bg-destructive",
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
  const tone = healthTone(score)
  const label = score >= 70 ? "Healthy" : score >= 40 ? "Moderate" : "At Risk"
  return {
    score: "text-foreground",
    ink: tone.ink,
    wash: tone.wash,
    label,
    labelClass: "text-foreground",
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
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw} stroke={p.wash} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={sw}
          stroke={p.ink}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-sm font-medium tabular-nums" style={{ color: p.ink }}>
          {score}
        </span>
      </div>
    </div>
  )
}

function IntelMetric({
  icon: Icon,
  label,
  value,
  detail,
  toneClass,
}: {
  icon: React.ElementType
  label: string
  value: string
  detail?: string
  toneClass?: string
}) {
  return (
    <div className="min-w-0 px-1 py-1">
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

function StatPill({
  value,
  label,
}: {
  icon: React.ElementType
  value: string | number
  label: string
  colorClass?: string
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-2 px-4 first:pl-0">
      <span className="text-lg font-semibold tabular-nums leading-none text-foreground">
        {value}
      </span>
      <span className="truncate text-[13px] text-muted-foreground">{label}</span>
    </div>
  )
}

function EmptyState() {
  const { t } = useI18n()
  return (
    <Empty className="min-h-80 bg-transparent">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Brain />
        </EmptyMedia>
        <EmptyTitle>{t("No health reports yet", "还没有健康报告")}</EmptyTitle>
        <EmptyDescription>
          {t(
            "Open a repository, run a health analysis, and your reports will appear here.",
            "打开仓库并运行健康分析，报告会显示在这里。",
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">
            <Zap className="h-3.5 w-3.5" />
            {t("Dashboard", "仪表盘")}
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function NoFilteredResults({ onClear }: { onClear: () => void }) {
  const { t } = useI18n()
  return (
    <Empty className="min-h-64 bg-transparent">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Search />
        </EmptyMedia>
        <EmptyTitle>{t("No matching reports", "没有匹配的报告")}</EmptyTitle>
        <EmptyDescription>
          {t("No repositories match the current health filters.", "没有仓库符合当前健康筛选。")}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" size="sm" onClick={onClear}>
          {t("Clear filters", "清除筛选")}
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
    <div className="overflow-hidden rounded-lg bg-card shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
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
  const { t } = useI18n()
  return (
    <IntelSectionCard title={t("Reports", "报告")} icon={Brain}>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-background/40 p-4">
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
  const { t } = useI18n()
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>{t("Failed to load health", "加载健康报告失败")}</AlertTitle>
      <AlertDescription>{t("Please refresh and try again.", "请刷新后重试。")}</AlertDescription>
    </Alert>
  )
}

function IntelCard({
  intel,
  onOpenRepo,
}: {
  intel: RepoIntel
  onOpenRepo: (repoFullName: string) => void
}) {
  const { t, locale } = useI18n()
  const [owner, repo] = intel.repoFullName.split("/")
  const verdict = verdictConfig[intel.maintenanceVerdict] ?? {
    label: intel.maintenanceVerdict,
    badgeClass: "",
    dotClass: "bg-zinc-500",
  }
  const sentiment = sentimentConfig[intel.communitySentiment] ?? { label: intel.communitySentiment }
  const readiness = readinessConfig[intel.adoptionReadiness] ?? { label: intel.adoptionReadiness }

  const issueClose =
    intel.metrics?.issueCloseRate != null ? Math.round(intel.metrics.issueCloseRate * 100) : null
  const prMerge =
    intel.metrics?.prMergeRate != null ? Math.round(intel.metrics.prMergeRate * 100) : null
  const contributors =
    intel.metrics?.activeCommitAuthors90d ?? intel.metrics?.activeContributors90d ?? null
  const daysSince = intel.metrics?.daysSinceLastCommit ?? null
  const p = healthPalette(intel.healthScore)

  const painPoints = intel.topPainPoints ?? []

  return (
    <div className="py-4">
      <div>
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
                      <span className="text-muted-foreground">{owner}/</span>
                      {repo}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-all group-hover/link:translate-x-0.5 group-hover/link:text-primary/70" />
                  </button>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground/70">
                    <span className="font-medium" style={{ color: p.ink }}>
                      {translateIntelLabel(p.label, t)}
                    </span>
                    <span aria-hidden="true">/</span>
                    <span>{translateIntelLabel(readiness.label, t)}</span>
                    <span aria-hidden="true">/</span>
                    <span>{translateIntelLabel(sentiment.label, t)}</span>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={cn(
                    "h-6 rounded-md px-2 text-[11px] font-medium normal-case tracking-normal",
                    verdict.badgeClass,
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", verdict.dotClass)} />
                  {translateIntelLabel(verdict.label, t)}
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
              <IntelMetric
                icon={Activity}
                label="Issues"
                value={`${issueClose}%`}
                detail="closed"
                toneClass="text-muted-foreground"
              />
            )}
            {prMerge !== null && (
              <IntelMetric
                icon={GitPullRequest}
                label="Pull requests"
                value={`${prMerge}%`}
                detail="merged"
                toneClass="text-muted-foreground"
              />
            )}
            {contributors !== null && (
              <IntelMetric
                icon={Users}
                label="Authors"
                value={String(contributors)}
                detail="90d commits"
              />
            )}
            {daysSince !== null && (
              <IntelMetric
                icon={Clock}
                label="Last commit"
                value={daysSince === 0 ? "Today" : `${daysSince}d`}
                detail={daysSince === 0 ? undefined : "ago"}
              />
            )}
          </div>

          {/* Sub-scores row */}
          {(() => {
            const sub = computeSubScores(intel.metrics)
            const subItems = [
              { label: "Maintenance", score: sub.maintenance, icon: Wrench },
              { label: "Activity", score: sub.activity, icon: Activity },
              { label: "Community", score: sub.community, icon: Users },
              { label: "Trust", score: sub.trust, icon: Shield },
            ]
            return (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                {subItems.map(({ label, score, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-1 text-[11px]">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{label}</span>
                    <span
                      className="font-medium tabular-nums"
                      style={{ color: healthTone(score).ink }}
                    >
                      {score}
                    </span>
                  </div>
                ))}
              </div>
            )
          })()}

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
              <Sparkles className="h-3 w-3" />
              <span>
                {t("Analyzed", "分析于")}{" "}
                {formatDistanceToNow(new Date(intel.analyzedAt), {
                  addSuffix: true,
                  locale: locale === "zh-CN" ? zhCN : undefined,
                })}
              </span>
            </div>
            <Link
              href={`/health/${owner}/${repo}`}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              {t("Full report", "完整报告")}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {painPoints.length > 0 && (
          <Accordion type="single" collapsible className="mt-3 border-t border-border/50">
            <AccordionItem value="pain-points" className="border-b-0">
              <AccordionTrigger className="min-h-9 px-0 py-2 text-xs hover:no-underline">
                <span className="flex min-w-0 items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    {t("Review notes", "查看笔记")}
                  </span>
                  <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[10px]">
                    {painPoints.length}
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-1">
                <div className="flex flex-col gap-1.5">
                  {painPoints.map((point, i) => (
                    <p key={i} className="text-xs leading-relaxed text-muted-foreground">
                      {i + 1}. {point}
                    </p>
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
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })

const sortLabels: Record<SortField, string> = {
  health_score: "Health score",
  analyzed_at: "Recently analyzed",
  name: "Name A-Z",
}

function IntelCommandPalette(p: {
  intel: RepoIntel[]
  verdictFilter: VerdictFilter
  sortField: SortField
  verdictOptions: { value: VerdictFilter; label: string; dotClass: string }[]
  search: string
  onSearchChange: (query: string) => void
  onVerdictFilterChange: (filter: VerdictFilter) => void
  onSortChange: (field: SortField) => void
  onOpenRepo: (repoFullName: string) => void
  onClearFilters: () => void
}) {
  const { t } = useI18n()
  usePaletteGroups({
    placeholder: t(
      "Search Health, jump to a repo, or change filters...",
      "搜索健康报告、跳转仓库或更改筛选...",
    ),
    search: { label: t("Filter Health", "筛选健康报告"), run: p.onSearchChange },
    groups: [
      {
        heading: t("Health reports", "健康报告"),
        limit: 20,
        items: p.intel.map((item) => ({
          id: `intel-${item.repoFullName}`,
          label: item.repoFullName,
          hint: t(
            `${item.healthScore} health, ${verdictConfig[item.maintenanceVerdict]?.label ?? item.maintenanceVerdict}`,
            `健康评分 ${item.healthScore}，${translateIntelLabel(verdictConfig[item.maintenanceVerdict]?.label ?? item.maintenanceVerdict, t)}`,
          ),
          keywords: [
            item.summary,
            item.recommendation,
            item.adoptionReadiness,
            ...(item.topPainPoints ?? []),
          ].join(" "),
          icon: Brain,
          onSelect: () => p.onOpenRepo(item.repoFullName),
        })),
      },
      {
        heading: t("Health filters", "健康筛选"),
        items: [
          ...p.verdictOptions.map((o) => ({
            id: `verdict-${o.value}`,
            label: translateIntelLabel(o.label, t),
            checked: p.verdictFilter === o.value,
            onSelect: () => p.onVerdictFilterChange(o.value),
          })),
          {
            id: "intel-clear",
            label: t("Clear health filters", "清除健康筛选"),
            keywords: "reset",
            icon: SlidersHorizontal,
            disabled: !(p.search || p.verdictFilter !== "all"),
            onSelect: p.onClearFilters,
          },
        ],
      },
      {
        heading: t("Sort", "排序"),
        items: (Object.entries(sortLabels) as [SortField, string][]).map(([field, label]) => ({
          id: `sort-${field}`,
          label: translateIntelLabel(label, t),
          checked: p.sortField === field,
          onSelect: () => p.onSortChange(field),
        })),
      },
    ],
  })
  return null
}

export function HealthDashboard() {
  const { t } = useI18n()
  const { user, reauthenticate } = useUser()
  const [sortField, setSortField] = useState<SortField>("health_score")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("all")
  const [search, setSearch] = useState("")
  const [selectedRepo, setSelectedRepo] = useState<StarredRepo | null>(null)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)
  const [readmeViewerOpen, setReadmeViewerOpen] = useState(false)

  const { data: starredData } = useStarredRepos(user?.id)

  const { data: metadata } = useSWR<UserMetadata>(user?.id ? "/api/user/metadata" : null, fetcher, {
    revalidateOnFocus: false,
  })

  const { data, isLoading, error } = useSWR<{ intel: RepoIntel[] }>(
    user?.id ? "/api/intel/all" : null,
    fetcher,
    { revalidateOnFocus: false },
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
    await reauthenticate()
  }

  const isTokenExpired = Boolean(
    error?.message?.includes("token") ||
    error?.message?.includes("expired") ||
    error?.message?.includes("re-authenticate"),
  )

  // Merge server data with any locally-cached intel (handles cases where DB upsert failed)
  const allIntel = useMemo(() => {
    const serverIntel = data?.intel ?? []
    const localIntel = getLocalIntel()
    const serverNames = new Set(serverIntel.map((i) => i.repoFullName))
    const localOnly = localIntel.filter((i) => !serverNames.has(i.repoFullName))
    return [...serverIntel, ...localOnly]
  }, [data?.intel])

  // Stats
  const avgScore =
    allIntel.length > 0
      ? Math.round(allIntel.reduce((s, i) => s + i.healthScore, 0) / allIntel.length)
      : 0
  const healthyCount = allIntel.filter((i) => i.healthScore >= 70).length
  const atRiskCount = allIntel.filter((i) => i.healthScore < 40).length

  // Filtered + sorted
  const filtered = useMemo(() => {
    let list = [...allIntel]

    if (verdictFilter !== "all") {
      list = list.filter((i) => i.maintenanceVerdict === verdictFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (i) => i.repoFullName.toLowerCase().includes(q) || i.summary?.toLowerCase().includes(q),
      )
    }

    list.sort((a, b) => {
      let cmp = 0
      if (sortField === "health_score") cmp = a.healthScore - b.healthScore
      else if (sortField === "analyzed_at")
        cmp = new Date(a.analyzedAt).getTime() - new Date(b.analyzedAt).getTime()
      else cmp = a.repoFullName.localeCompare(b.repoFullName)
      return sortDir === "desc" ? -cmp : cmp
    })

    return list
  }, [allIntel, verdictFilter, search, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
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
    { value: "actively-maintained", label: "Active", dotClass: "bg-foreground/40" },
    { value: "lightly-maintained", label: "Lightly Maintained", dotClass: "bg-foreground/40" },
    { value: "stale", label: "Stale", dotClass: "bg-foreground/40" },
    { value: "abandoned", label: "Abandoned", dotClass: "bg-destructive" },
  ]

  const searchLabel = search
    ? t(`Health: ${search}`, `健康：${search}`)
    : t("Search health reports and filters", "搜索健康报告和筛选项")
  const desktopControlClassName =
    "h-7 w-auto justify-start gap-1 border-0 bg-transparent px-2 text-[13px] text-foreground/80 shadow-none hover:bg-background/80 hover:text-foreground [&_svg]:size-3.5 [&_svg]:text-muted-foreground"
  const mobileControlClassName =
    "h-8 w-full gap-1 border-0 bg-transparent px-2 text-[13px] text-foreground/80 shadow-none [&_svg]:text-muted-foreground"

  const filterControls =
    allIntel.length > 0 ? (
      <>
        <Select
          value={verdictFilter}
          onValueChange={(value) => setVerdictFilter(value as VerdictFilter)}
        >
          <SelectTrigger className={desktopControlClassName}>
            <SelectValue placeholder={t("Verdict", "维护状态")} />
          </SelectTrigger>
          <SelectContent>
            {verdictOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {translateIntelLabel(option.label, t)}
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
          <SelectTrigger className={desktopControlClassName}>
            <SelectValue placeholder={t("Sort", "排序")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="health_score:desc">
              {t("Health score high", "健康分从高到低")}
            </SelectItem>
            <SelectItem value="health_score:asc">
              {t("Health score low", "健康分从低到高")}
            </SelectItem>
            <SelectItem value="analyzed_at:desc">{t("Recently analyzed", "最近分析")}</SelectItem>
            <SelectItem value="analyzed_at:asc">{t("Oldest analyzed", "最早分析")}</SelectItem>
            <SelectItem value="name:asc">{t("Name A-Z", "名称 A-Z")}</SelectItem>
            <SelectItem value="name:desc">{t("Name Z-A", "名称 Z-A")}</SelectItem>
          </SelectContent>
        </Select>
      </>
    ) : null

  const mobileFilterControls =
    allIntel.length > 0 ? (
      <>
        <Select
          value={verdictFilter}
          onValueChange={(value) => setVerdictFilter(value as VerdictFilter)}
        >
          <SelectTrigger className={mobileControlClassName}>
            <SelectValue placeholder={t("Verdict", "维护状态")} />
          </SelectTrigger>
          <SelectContent>
            {verdictOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {translateIntelLabel(option.label, t)}
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
            <SelectValue placeholder={t("Sort", "排序")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="health_score:desc">
              {t("Health score high", "健康分从高到低")}
            </SelectItem>
            <SelectItem value="health_score:asc">
              {t("Health score low", "健康分从低到高")}
            </SelectItem>
            <SelectItem value="analyzed_at:desc">{t("Recently analyzed", "最近分析")}</SelectItem>
            <SelectItem value="analyzed_at:asc">{t("Oldest analyzed", "最早分析")}</SelectItem>
            <SelectItem value="name:asc">{t("Name A-Z", "名称 A-Z")}</SelectItem>
            <SelectItem value="name:desc">{t("Name Z-A", "名称 Z-A")}</SelectItem>
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
          desktopControls={filterControls}
          mobileControls={mobileFilterControls}
          lastSynced={null}
          hideNavActions
        />

        <main className="flex-1 p-6">
          <section className="mb-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight">{t("Health", "健康")}</h1>
            </div>

            {/* Stats row — only visible when there's data */}
            {!isLoading && allIntel.length > 0 && (
              <div className="flex flex-wrap items-center gap-y-2 divide-x divide-border/70">
                <StatPill
                  icon={Brain}
                  value={allIntel.length}
                  label={t("Repos analyzed", "已分析仓库")}
                  colorClass="bg-muted text-muted-foreground"
                />
                <StatPill
                  icon={Activity}
                  value={avgScore}
                  label={t("Avg health", "平均健康分")}
                  colorClass="bg-muted text-muted-foreground"
                />
                <StatPill
                  icon={TrendingUp}
                  value={healthyCount}
                  label={t("Healthy (≥70)", "健康（≥70）")}
                  colorClass="bg-muted text-muted-foreground"
                />
                <StatPill
                  icon={TrendingDown}
                  value={atRiskCount}
                  label={t("At risk (<40)", "有风险（<40）")}
                  colorClass="bg-muted text-muted-foreground"
                />
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
                    <div className="divide-y divide-border/60">
                      {filtered.map((intel) => (
                        <IntelCard key={intel.id} intel={intel} onOpenRepo={handleOpenRepo} />
                      ))}
                    </div>
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
              <div className="divide-y divide-border/60">
                {filtered.map((intel) => (
                  <IntelCard key={intel.id} intel={intel} onOpenRepo={handleOpenRepo} />
                ))}
              </div>
            )}
          </div>
        </main>
      </SidebarInset>

      <IntelCommandPalette
        intel={allIntel}
        search={search}
        verdictFilter={verdictFilter}
        sortField={sortField}
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

      <ReadmeViewer repo={selectedRepo} open={readmeViewerOpen} onClose={handleCloseReadme} />
    </SidebarProvider>
  )
}
