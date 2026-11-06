"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  GitFork,
  GitPullRequestArrow,
  Loader2,
  RefreshCw,
  Search,
  Star,
  X,
} from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { IssueViewer } from "@/components/issue-viewer"
import { GitHubIcon } from "@/components/icons/github-icon"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAIKey } from "@/lib/use-ai-key"
import { useStarredRepos } from "@/lib/use-starred-repos"
import type {
  ContributionDifficulty,
  ContributionOpportunity,
  ContributionType,
} from "@/lib/contribution-opportunities"
import type { StarredRepo, UserMetadata } from "@/lib/types"
import { LANGUAGE_COLORS } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { useUser } from "@/components/providers/user-provider"
import { useI18n } from "@/components/i18n-provider"
import { zhCN } from "date-fns/locale"

interface RepoContributionsPageProps {
  owner: string
  repo: string
}

interface OpportunitiesResponse {
  opportunities: ContributionOpportunity[]
  scannedRepos: number
  generatedAt: string
  error?: string
  retryAfterSeconds?: number
}

interface ContributionBrief {
  summary: string
  whyItFits: string[]
  firstSteps: string[]
  likelyFiles: string[]
  questionsToAsk: string[]
  codingAssistantPrompt: string
}

type SelectableDifficulty = ContributionDifficulty | "all"
type SelectableType = ContributionType | "all"

const REPO_CONTRIBUTION_CACHE_PREFIX = "stardash-repo-contribution-opportunities-v1"
const BRIEF_CACHE_PREFIX = "stardash-contribution-brief"
const CACHE_TTL_MS = 60 * 60 * 1000
const BRIEF_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

const typeLabels: Record<ContributionType, string> = {
  bugfix: "Bugfix",
  docs: "Docs",
  tests: "Tests",
  frontend: "Frontend",
  backend: "Backend",
  infra: "Infra",
  feature: "Feature",
  maintenance: "Maintenance",
}

function repoCacheKey(userId: string, fullName: string) {
  return `${REPO_CONTRIBUTION_CACHE_PREFIX}-${userId}-${fullName}`
}

function readCachedRepoScan(
  userId: string | undefined,
  fullName: string,
): OpportunitiesResponse | undefined {
  if (!userId || typeof window === "undefined") return undefined
  try {
    const raw = window.localStorage.getItem(repoCacheKey(userId, fullName))
    if (!raw) return undefined
    const cached = JSON.parse(raw) as OpportunitiesResponse & { cachedAt: string }
    if (Date.now() - new Date(cached.cachedAt).getTime() > CACHE_TTL_MS) return undefined
    return cached
  } catch {
    return undefined
  }
}

function writeCachedRepoScan(
  userId: string | undefined,
  fullName: string,
  data: OpportunitiesResponse,
) {
  if (!userId || typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      repoCacheKey(userId, fullName),
      JSON.stringify({ ...data, cachedAt: new Date().toISOString() }),
    )
  } catch {
    // Cache best effort only.
  }
}

function readCachedBrief(opportunityId: string): ContributionBrief | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(`${BRIEF_CACHE_PREFIX}-${opportunityId}`)
    if (!raw) return null
    const { brief, cachedAt } = JSON.parse(raw) as { brief: ContributionBrief; cachedAt: string }
    if (Date.now() - new Date(cachedAt).getTime() > BRIEF_CACHE_TTL_MS) return null
    return brief
  } catch {
    return null
  }
}

function writeCachedBrief(opportunityId: string, brief: ContributionBrief) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      `${BRIEF_CACHE_PREFIX}-${opportunityId}`,
      JSON.stringify({ brief, cachedAt: new Date().toISOString() }),
    )
  } catch {
    // Cache best effort only.
  }
}

function scoreTone(score: number) {
  if (score >= 80)
    return "border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  if (score >= 60) return "border-sky-500/35 bg-sky-500/10 text-sky-600 dark:text-sky-400"
  return "border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400"
}

function formatNumber(num: number): string {
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k"
  return num.toString()
}

function OpportunityIssueRow({
  opportunity,
  onBrief,
  onViewIssue,
  isBriefLoading,
  isBriefLimited,
  isSelected,
  rowRef,
}: {
  opportunity: ContributionOpportunity
  onBrief: (opportunity: ContributionOpportunity) => void
  onViewIssue: (opportunity: ContributionOpportunity) => void
  isBriefLoading: boolean
  isBriefLimited: boolean
  isSelected: boolean
  rowRef?: (el: HTMLDivElement | null) => void
}) {
  const { t, locale } = useI18n()
  return (
    <div
      ref={rowRef}
      className={cn(
        "grid gap-4 border-b border-border/60 px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_220px]",
        isSelected && "bg-primary/5",
      )}
    >
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className={cn("h-5 tabular-nums", scoreTone(opportunity.score))}>
            {t(`${opportunity.score}% fit`, `匹配度 ${opportunity.score}%`)}
          </Badge>
          <span>#{opportunity.issueNumber}</span>
          <span>
            {t("Updated", "更新于")}{" "}
            {formatDistanceToNow(new Date(opportunity.updatedAt), {
              addSuffix: true,
              locale: locale === "zh-CN" ? zhCN : undefined,
            })}
          </span>
          <span>{t(`${opportunity.comments} comments`, `${opportunity.comments} 条评论`)}</span>
        </div>
        <button
          onClick={() => onViewIssue(opportunity)}
          className="line-clamp-2 text-left text-base font-semibold leading-snug transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {opportunity.title}
        </button>
        <button onClick={() => onViewIssue(opportunity)} className="group mt-2 block text-left">
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground group-hover:text-muted-foreground/80">
            {opportunity.bodyPreview}
          </p>
          <span className="mt-1 block text-xs text-muted-foreground/60 group-hover:text-muted-foreground">
            {t("Read full issue", "查看完整议题")}
          </span>
        </button>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-xs">
            {t(
              opportunity.difficulty,
              { beginner: "入门", intermediate: "中级", advanced: "高级" }[opportunity.difficulty],
            )}
          </Badge>
          {opportunity.contributionTypes.map((type) => (
            <Badge key={type} variant="outline" className="text-xs">
              {t(
                typeLabels[type],
                {
                  bugfix: "修复",
                  docs: "文档",
                  tests: "测试",
                  frontend: "前端",
                  backend: "后端",
                  infra: "基础设施",
                  feature: "功能",
                  maintenance: "维护",
                }[type],
              )}
            </Badge>
          ))}
          {opportunity.labels.slice(0, 5).map((label) => (
            <Badge key={label} variant="secondary" className="max-w-40 truncate text-xs">
              {label}
            </Badge>
          ))}
        </div>

        {opportunity.risks.length > 0 && (
          <div className="mt-3 flex gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>{opportunity.risks.slice(0, 2).join(" · ")}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col justify-between gap-3 lg:items-end">
        <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground lg:text-right">
          {opportunity.fitReasons.slice(0, 3).map((reason) => (
            <li key={reason} className="flex gap-2 lg:justify-end">
              <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-emerald-500 lg:order-2" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 lg:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBrief(opportunity)}
            disabled={isBriefLoading || isBriefLimited}
          >
            {isBriefLoading ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Bot data-icon="inline-start" />
            )}
            {isSelected ? t("Selected", "已选择") : t("Brief", "简报")}
          </Button>
          <Button asChild size="sm">
            <a href={opportunity.htmlUrl} target="_blank" rel="noreferrer">
              {t("Open", "打开")}
              <ExternalLink data-icon="inline-end" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}

function BriefPanel({
  opportunity,
  brief,
  briefError,
  isLoading,
  copiedPrompt,
  onCopyPrompt,
  onClose,
}: {
  opportunity: ContributionOpportunity | null
  brief: ContributionBrief | null
  briefError: string | null
  isLoading: boolean
  copiedPrompt: boolean
  onCopyPrompt: () => void
  onClose: () => void
}) {
  const { t } = useI18n()
  return (
    <aside className="overflow-hidden rounded-xl bg-card shadow-sm xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)]">
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{t("AI contribution brief", "AI 贡献简报")}</p>
          <p className="truncate text-xs text-muted-foreground">
            {opportunity
              ? `${opportunity.repoFullName} #${opportunity.issueNumber}`
              : t("Select an issue to generate a plan", "选择议题以生成计划")}
          </p>
        </div>
        {opportunity && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={onClose}
            aria-label={t("Close brief", "关闭简报")}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-5 xl:max-h-[calc(100vh-8rem)]">
        {!opportunity && (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <Bot className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{t("No brief selected", "未选择简报")}</p>
              <p className="mt-1 max-w-64 text-xs leading-relaxed text-muted-foreground">
                {t("Choose Brief on an issue to generate a plan.", "选择议题的简报以生成计划。")}
              </p>
            </div>
          </div>
        )}

        {opportunity && isLoading && (
          <div className="flex items-center gap-3 rounded-lg bg-muted/20 p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("Generating plan…", "正在生成计划…")}
          </div>
        )}

        {opportunity && briefError && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {briefError}
          </div>
        )}

        {opportunity && brief && (
          <div className="flex flex-col gap-5 text-sm">
            <p className="leading-6 text-muted-foreground">{brief.summary}</p>

            <section>
              <h3 className="font-medium">{t("Why it fits", "匹配原因")}</h3>
              <ul className="mt-2 flex flex-col gap-1.5 text-muted-foreground">
                {brief.whyItFits.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="font-medium">{t("Likely files", "可能涉及的文件")}</h3>
              <ul className="mt-2 flex flex-col gap-1.5 text-muted-foreground">
                {brief.likelyFiles.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="font-medium">{t("First steps", "第一步")}</h3>
              <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground">
                {brief.firstSteps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </section>

            <section>
              <h3 className="font-medium">{t("Questions to ask", "待确认的问题")}</h3>
              <ul className="mt-2 flex flex-col gap-1.5 text-muted-foreground">
                {brief.questionsToAsk.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </section>

            <section>
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{t("Coding assistant prompt", "编程助手提示词")}</h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onCopyPrompt}
                      aria-label={t("Copy prompt", "复制提示词")}
                    >
                      {copiedPrompt ? (
                        <Check className="size-4 text-emerald-500" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {copiedPrompt ? t("Copied", "已复制") : t("Copy prompt", "复制提示词")}
                  </TooltipContent>
                </Tooltip>
              </div>
              <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {brief.codingAssistantPrompt}
              </pre>
            </section>

            <Button asChild>
              <a href={opportunity.htmlUrl} target="_blank" rel="noreferrer">
                {t("Open GitHub issue", "打开 GitHub 议题")}
                <ExternalLink data-icon="inline-end" />
              </a>
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}

async function scanRepo(repo: StarredRepo): Promise<OpportunitiesResponse> {
  const response = await fetch("/api/github/contribution-opportunities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repos: [repo],
      maxRepos: 5,
      maxIssuesPerRepo: 500,
      minScore: 0,
      preferences: {
        languages: repo.language ? [repo.language] : [],
        difficulty: "all",
        contributionTypes: [],
      },
    }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || "Failed to scan contribution opportunities")
  return result
}

export function RepoContributionsPage({ owner, repo: repoName }: RepoContributionsPageProps) {
  const { t, locale } = useI18n()
  const { user } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const autoBriefId = searchParams.get("brief")
  const userId = user?.id
  const { getHeaders } = useAIKey()
  const { data: reposData, isLoading: reposLoading } = useStarredRepos(userId)
  const { data: metadata } = useSWR<UserMetadata>(
    userId ? "/api/user/metadata" : null,
    (url: string) => fetch(url).then((response) => response.json()),
    { revalidateOnFocus: false },
  )

  const repo = useMemo(
    () => reposData?.repos.find((item) => item.fullName === `${owner}/${repoName}`) ?? null,
    [owner, repoName, reposData?.repos],
  )
  const fullName = `${owner}/${repoName}`
  const hasRepo = Boolean(repo)

  const { data, error, isLoading, isValidating, mutate } = useSWR<OpportunitiesResponse>(
    repo ? ["repo-contributions", repo.fullName] : null,
    () => scanRepo(repo!),
    {
      revalidateOnMount: false, // handled by the mount effect below
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      onSuccess(result) {
        writeCachedRepoScan(userId, fullName, result)
      },
    },
  )

  // Seed SWR from localStorage after mount to avoid SSR/client hydration mismatch.
  // readCachedRepoScan reads window.localStorage so it must not run during SSR.
  // hasRepo is included so this re-fires once useStarredRepos resolves — the SWR
  // key is null until repo is non-null, making mutate() a no-op before that point.
  useEffect(() => {
    if (!repo) return
    const cached = readCachedRepoScan(userId, fullName)
    if (cached && cached.opportunities.length > 0) {
      mutate(cached, { revalidate: false })
    } else {
      mutate()
    }
    // mutate is stable (SWR bound function), intentionally omitted from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, fullName, hasRepo])

  const [search, setSearch] = useState("")
  const [difficulty, setDifficulty] = useState<SelectableDifficulty>("all")
  const [type, setType] = useState<SelectableType>("all")
  const [selectedIssue, setSelectedIssue] = useState<ContributionOpportunity | null>(null)
  const [selectedOpportunity, setSelectedOpportunity] = useState<ContributionOpportunity | null>(
    null,
  )
  const [brief, setBrief] = useState<ContributionBrief | null>(null)
  const [briefError, setBriefError] = useState<string | null>(null)
  const [briefLoadingId, setBriefLoadingId] = useState<string | null>(null)
  const [briefLimit, setBriefLimit] = useState<{
    remaining: number | null
    nextAllowedAt: string | null
  }>({ remaining: null, nextAllowedAt: null })
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  const rowRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())

  const opportunities = useMemo(() => data?.opportunities ?? [], [data?.opportunities])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return opportunities.filter((opportunity) => {
      if (difficulty !== "all" && opportunity.difficulty !== difficulty) return false
      if (type !== "all" && !opportunity.contributionTypes.includes(type)) return false
      if (!q) return true
      return (
        opportunity.title.toLowerCase().includes(q) ||
        opportunity.bodyPreview.toLowerCase().includes(q) ||
        opportunity.labels.some((label) => label.toLowerCase().includes(q))
      )
    })
  }, [difficulty, opportunities, search, type])

  const stats = {
    total: opportunities.length,
    beginner: opportunities.filter((item) => item.difficulty === "beginner").length,
    docs: opportunities.filter((item) => item.contributionTypes.includes("docs")).length,
    bugfix: opportunities.filter((item) => item.contributionTypes.includes("bugfix")).length,
  }

  const handleScanAgain = async () => {
    if (!repo) return
    const result = await scanRepo(repo)
    writeCachedRepoScan(userId, fullName, result)
    await mutate(result, { revalidate: false })
  }

  const handleBrief = async (opportunity: ContributionOpportunity) => {
    setSelectedOpportunity(opportunity)
    setBriefError(null)
    const cached = readCachedBrief(opportunity.id)
    if (cached) {
      setBrief(cached)
      return
    }

    setBrief(null)
    setBriefLoadingId(opportunity.id)

    try {
      const response = await fetch("/api/ai/contribution-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getHeaders() },
        body: JSON.stringify({ opportunity }),
      })

      if (response.status === 429) {
        const result = await response.json()
        setBriefLimit({ remaining: 0, nextAllowedAt: result.nextAllowedAt ?? null })
        setBriefError(result.error ?? t("Brief limit reached", "已达到简报使用上限"))
        return
      }

      const result = await response.json()
      if (!response.ok)
        throw new Error(
          result.error || t("Failed to generate contribution brief", "生成贡献简报失败"),
        )
      if (typeof result.remaining === "number")
        setBriefLimit({ remaining: result.remaining, nextAllowedAt: null })
      const nextBrief = result.brief as ContributionBrief
      setBrief(nextBrief)
      writeCachedBrief(opportunity.id, nextBrief)
    } catch (briefLoadError) {
      setBriefError(
        briefLoadError instanceof Error
          ? briefLoadError.message
          : t("Failed to generate contribution brief", "生成贡献简报失败"),
      )
    } finally {
      setBriefLoadingId(null)
    }
  }

  // Scroll the selected issue row into view whenever the selection changes.
  useEffect(() => {
    if (!selectedOpportunity) return
    const el = rowRefsMap.current.get(selectedOpportunity.id)
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [selectedOpportunity])

  // Auto-trigger brief when navigated here from a specific issue card (?brief=<id>).
  // handleBrief is deferred via setTimeout to avoid calling setState synchronously
  // inside the effect body (which would trigger cascading renders).
  const autoBriefFiredRef = useRef(false)
  useEffect(() => {
    if (!autoBriefId || autoBriefFiredRef.current || opportunities.length === 0) return
    const target = opportunities.find((o) => o.id === decodeURIComponent(autoBriefId))
    if (!target) return
    autoBriefFiredRef.current = true
    setTimeout(() => void handleBrief(target), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBriefId, opportunities])

  const collections = metadata?.collections ?? []
  const tags = metadata?.tags ?? []
  const sidebarProps = {
    collections,
    tags,
    selectedCollection: null,
    selectedTag: null,
    showUncategorized: false,
    onSelectCollection: () => {},
    onSelectTag: () => {},
    onShowUncategorized: () => {},
    totalStars: reposData?.repos.length ?? 0,
    uncategorizedCount: 0,
    userId,
  }

  const isBriefLimited = briefLimit.remaining === 0
  const handleCopyPrompt = () => {
    if (!brief) return
    navigator.clipboard.writeText(brief.codingAssistantPrompt)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
  }
  const closeBriefPanel = () => {
    setSelectedOpportunity(null)
    setBrief(null)
    setBriefError(null)
    setBriefLoadingId(null)
  }

  return (
    <SidebarProvider>
      <AppSidebar {...sidebarProps} />
      <SidebarInset className="overflow-x-hidden">
        <main className="flex w-full flex-col gap-5 px-4 py-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                onClick={() => router.push("/dashboard")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
                {t("Dashboard", "工作台")}
              </button>
              <span className="text-border">/</span>
              <span className="text-sm text-muted-foreground">{owner}</span>
              <span className="text-border">/</span>
              <button
                onClick={() => router.push(`/repo/${owner}/${repoName}`)}
                className="truncate font-mono text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {repoName}
              </button>
              <span className="text-border">/</span>
              <span className="text-sm font-medium">{t("contributions", "贡献")}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleScanAgain}
              disabled={!repo || isValidating}
            >
              {isValidating ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              {t("Scan issues", "扫描议题")}
            </Button>
          </div>

          <section className="overflow-hidden rounded-xl bg-card shadow-sm">
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <Avatar className="size-11 shrink-0 rounded-lg">
                    <AvatarImage src={repo?.avatarUrl} alt={owner} />
                    <AvatarFallback className="rounded-lg">
                      {owner[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{t("Contributions", "贡献")}</p>
                    <h1 className="mt-1 truncate font-mono text-2xl font-semibold">{fullName}</h1>
                    {repo?.description && (
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                        {repo.description}
                      </p>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={`https://github.com/${fullName}`} target="_blank" rel="noreferrer">
                    <GitHubIcon data-icon="inline-start" />
                    GitHub
                  </a>
                </Button>
              </div>
            </div>
            <div className="border-t border-border/60 bg-muted/20 px-5 py-3">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Star className="size-3.5" />
                  {t(
                    `${formatNumber(repo?.stargazersCount ?? 0)} stars`,
                    `${formatNumber(repo?.stargazersCount ?? 0)} 星标`,
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  <GitFork className="size-3.5" />
                  {t(
                    `${formatNumber(repo?.forksCount ?? 0)} forks`,
                    `${formatNumber(repo?.forksCount ?? 0)} 分叉`,
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="size-3.5" />
                  {t(
                    `${formatNumber(repo?.openIssuesCount ?? 0)} open issues`,
                    `${formatNumber(repo?.openIssuesCount ?? 0)} 个未关闭议题`,
                  )}
                </span>
                {repo?.language && (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: LANGUAGE_COLORS[repo.language] ?? "#64748b" }}
                    />
                    {repo.language}
                  </span>
                )}
                {repo?.pushedAt && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5" />
                    {t("Updated", "更新于")}{" "}
                    {formatDistanceToNow(new Date(repo.pushedAt), {
                      addSuffix: true,
                      locale: locale === "zh-CN" ? zhCN : undefined,
                    })}
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            {[
              [t("Ranked issues", "已排序议题"), stats.total],
              [t("Beginner-friendly", "适合新手"), stats.beginner],
              [
                t("Docs/tests", "文档/测试"),
                stats.docs +
                  opportunities.filter((item) => item.contributionTypes.includes("tests")).length,
              ],
              [t("Bugfixes", "问题修复"), stats.bugfix],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-card shadow-sm px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 font-mono text-xl font-semibold">{value}</p>
              </div>
            ))}
          </section>

          <div className="flex flex-col gap-3 rounded-lg bg-card shadow-sm p-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("Search issues, labels, and context...", "搜索议题和标签…")}
                className="pl-9"
              />
            </div>
            <Select
              value={difficulty}
              onValueChange={(value) => setDifficulty(value as SelectableDifficulty)}
            >
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder={t("Difficulty", "难度")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All difficulty", "全部难度")}</SelectItem>
                <SelectItem value="beginner">{t("Beginner", "入门")}</SelectItem>
                <SelectItem value="intermediate">{t("Intermediate", "中级")}</SelectItem>
                <SelectItem value="advanced">{t("Advanced", "高级")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(value) => setType(value as SelectableType)}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder={t("Type", "类型")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All types", "全部类型")}</SelectItem>
                {Object.entries(typeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {t(
                      label,
                      (
                        {
                          bugfix: "修复",
                          docs: "文档",
                          tests: "测试",
                          frontend: "前端",
                          backend: "后端",
                          infra: "基础设施",
                          feature: "功能",
                          maintenance: "维护",
                        } as Record<string, string>
                      )[value] ?? label,
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(reposLoading || (isLoading && !data)) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-64 rounded-xl" />
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error.message}
            </div>
          )}

          {!reposLoading && !repo && (
            <div className="rounded-lg bg-card shadow-sm px-4 py-10 text-center">
              <p className="font-medium">{t("Repository not found", "未找到仓库")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("This repository is not in your starred repos.", "此仓库不在你的星标列表中。")}
              </p>
            </div>
          )}

          {repo && !isLoading && filtered.length === 0 && (
            <div className="rounded-lg bg-card shadow-sm px-4 py-10 text-center">
              <GitPullRequestArrow className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">
                {t("No matching opportunities", "没有匹配的贡献机会")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("Clear filters or scan again.", "清除筛选条件或重新扫描。")}
              </p>
            </div>
          )}

          <div className="grid min-h-0 gap-5 xl:h-[calc(100vh-2.5rem)] xl:grid-cols-[minmax(0,1fr)_560px] 2xl:grid-cols-[minmax(0,1fr)_640px]">
            <div className="min-w-0 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
              {filtered.length > 0 && (
                <div className="overflow-hidden rounded-xl bg-card shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{t("Issue queue", "议题列表")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("Sorted by fit and recent activity.", "按匹配度和近期活动排序。")}
                      </p>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {t(`${filtered.length} shown`, `显示 ${filtered.length} 项`)}
                    </Badge>
                  </div>
                  {filtered.map((opportunity) => (
                    <OpportunityIssueRow
                      key={opportunity.id}
                      opportunity={opportunity}
                      onBrief={handleBrief}
                      onViewIssue={setSelectedIssue}
                      isBriefLoading={briefLoadingId === opportunity.id}
                      isBriefLimited={isBriefLimited}
                      isSelected={selectedOpportunity?.id === opportunity.id}
                      rowRef={(el) => {
                        if (el) rowRefsMap.current.set(opportunity.id, el)
                        else rowRefsMap.current.delete(opportunity.id)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
            <BriefPanel
              opportunity={selectedOpportunity}
              brief={brief}
              briefError={briefError}
              isLoading={Boolean(briefLoadingId)}
              copiedPrompt={copiedPrompt}
              onCopyPrompt={handleCopyPrompt}
              onClose={closeBriefPanel}
            />
          </div>
        </main>
      </SidebarInset>

      <IssueViewer
        opportunity={selectedIssue}
        open={Boolean(selectedIssue)}
        onClose={() => setSelectedIssue(null)}
      />
    </SidebarProvider>
  )
}
