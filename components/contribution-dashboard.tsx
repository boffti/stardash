"use client"

import { useEffect, useMemo, useState } from "react"
import type React from "react"
import useSWR from "swr"
import { formatDistanceToNow } from "date-fns"
import type { User } from "@supabase/supabase-js"
import {
  AlertCircle,
  ArrowUpRight,
  Bot,
  Bug,
  CheckCircle2,
  Code2,
  ExternalLink,
  FileText,
  GitPullRequestArrow,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Wrench,
} from "lucide-react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppPageHeader } from "@/components/app-page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useStarredRepos } from "@/lib/use-starred-repos"
import type {
  ContributionDifficulty,
  ContributionOpportunity,
  ContributionType,
} from "@/lib/contribution-opportunities"
import type { UserMetadata } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ContributionCommandPalette } from "@/components/contribution-command-palette"
import { IssueViewer } from "@/components/issue-viewer"

interface ContributionDashboardProps {
  user: User | null
}

interface OpportunitiesResponse {
  opportunities: ContributionOpportunity[]
  scannedRepos: number
  generatedAt: string
  error?: string
}

interface ContributionBrief {
  summary: string
  whyItFits: string[]
  firstSteps: string[]
  likelyFiles: string[]
  questionsToAsk: string[]
  codingAssistantPrompt: string
}

interface CachedOpportunities {
  opportunities: ContributionOpportunity[]
  scannedRepos: number
  generatedAt: string
  repoSignature: string
  cachedAt: string
}

type SelectableType = ContributionType | "all"
type SelectableDifficulty = ContributionDifficulty | "all"

const CONTRIBUTION_CACHE_TTL_MS = 60 * 60 * 1000
const CONTRIBUTION_CACHE_PREFIX = "stardash-contribution-opportunities-v2"
const BRIEF_CACHE_PREFIX = "stardash-contribution-brief"
const BRIEF_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const ISSUE_DISCOVERY_REPO_LIMIT = 120
const ISSUE_SCAN_REPO_LIMIT = 40

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
    // Storage full or unavailable — live result still shown.
  }
}

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

const typeIcons: Record<ContributionType, React.ElementType> = {
  bugfix: Bug,
  docs: FileText,
  tests: CheckCircle2,
  frontend: Code2,
  backend: Wrench,
  infra: ShieldAlert,
  feature: Sparkles,
  maintenance: GitPullRequestArrow,
}

function scoreTone(score: number) {
  if (score >= 80) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
  if (score >= 60) return "border-sky-500/30 bg-sky-500/10 text-sky-400"
  return "border-amber-500/30 bg-amber-500/10 text-amber-400"
}

const languageColors: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  Ruby: "#701516",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  Vue: "#41b883",
  CSS: "#563d7c",
  HTML: "#e34c26",
  Shell: "#89e051",
  Scala: "#c22d40",
  PHP: "#4F5D95",
  Elixir: "#6e4a7e",
  Haskell: "#5e5086",
}

function getCacheKey(userId: string | undefined) {
  return userId ? `${CONTRIBUTION_CACHE_PREFIX}-${userId}` : null
}

function readCachedOpportunities(cacheKey: string | null, repoSignature: string) {
  if (!cacheKey || typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(cacheKey)
    if (!raw) return null

    const cached = JSON.parse(raw) as CachedOpportunities
    const isFresh = Date.now() - new Date(cached.cachedAt).getTime() < CONTRIBUTION_CACHE_TTL_MS
    if (!isFresh || cached.repoSignature !== repoSignature) return null

    return cached
  } catch {
    return null
  }
}

function writeCachedOpportunities(cacheKey: string | null, cache: CachedOpportunities) {
  if (!cacheKey || typeof window === "undefined") return

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(cache))
  } catch {
    // Browser storage can be unavailable or full; the live result is still usable.
  }
}

function OpportunitySkeleton() {
  return (
    <Card className="border-border/60 bg-card">
      <CardHeader className="gap-3">
        <Skeleton className="h-5 w-2/3 bg-muted" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 bg-muted" />
          <Skeleton className="h-6 w-20 bg-muted" />
          <Skeleton className="h-6 w-28 bg-muted" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full bg-muted" />
        <Skeleton className="h-10 w-full bg-muted" />
      </CardContent>
    </Card>
  )
}

function EmptyOpportunities({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20">
        <Search className="h-7 w-7 text-muted-foreground/50" />
      </div>
      <div className="flex max-w-md flex-col gap-2">
        <h3 className="text-lg font-semibold tracking-tight">No matching issues found</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          Try broadening the filters or syncing your starred repos first. The MVP scans active starred repos with open issues.
        </p>
      </div>
      <Button variant="outline" onClick={onRefresh}>
        <RefreshCw data-icon="inline-start" />
        Scan again
      </Button>
    </div>
  )
}

function OpportunityCard({
  opportunity,
  onBrief,
  onViewIssue,
  isBriefLoading,
}: {
  opportunity: ContributionOpportunity
  onBrief: (opportunity: ContributionOpportunity) => void
  onViewIssue: (opportunity: ContributionOpportunity) => void
  isBriefLoading: boolean
}) {
  const langColor = languageColors[opportunity.repoLanguage ?? ""] ?? "#6b7280"

  return (
    <Card className="flex flex-col overflow-hidden border-border/60 bg-card/75 transition-colors hover:border-border">
      <CardHeader className="gap-2.5 pb-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              {opportunity.repoLanguage && (
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: langColor }} />
              )}
              <span className="truncate text-sm font-semibold text-foreground">{opportunity.repoFullName}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {opportunity.repoLanguage && <span>{opportunity.repoLanguage}</span>}
              <span>#{opportunity.issueNumber}</span>
              <span>Updated {formatDistanceToNow(new Date(opportunity.updatedAt), { addSuffix: true })}</span>
            </div>
          </div>
          <Badge variant="outline" className={cn("shrink-0 tabular-nums", scoreTone(opportunity.score))}>
            {opportunity.score}%
          </Badge>
        </div>

        <button
          onClick={() => onViewIssue(opportunity)}
          className="line-clamp-2 text-left text-sm font-medium leading-snug outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          {opportunity.title}
        </button>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 pt-2">
        <button
          onClick={() => onViewIssue(opportunity)}
          className="group text-left"
        >
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground transition-colors group-hover:text-muted-foreground/80">
            {opportunity.bodyPreview}
          </p>
          <span className="mt-1 text-xs text-muted-foreground/50 transition-colors group-hover:text-muted-foreground">
            Read full issue →
          </span>
        </button>

        {opportunity.fitReasons.length > 0 && (
          <ul className="flex flex-col gap-1">
            {opportunity.fitReasons.slice(0, 2).map((reason) => (
              <li key={reason} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-xs">{opportunity.difficulty}</Badge>
            {opportunity.contributionTypes.map((type) => {
              const Icon = typeIcons[type]
              return (
                <Badge key={type} variant="outline" className="gap-1 text-xs">
                  <Icon className="h-3 w-3" />
                  {typeLabels[type]}
                </Badge>
              )
            })}
            {opportunity.labels.slice(0, 3).map((label) => (
              <Badge key={label} variant="secondary" className="max-w-32 truncate text-xs">
                {label}
              </Badge>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5" />
                {opportunity.repoStars.toLocaleString()}
              </span>
              <span>{opportunity.comments} comments</span>
            </div>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBrief(opportunity)}
                disabled={isBriefLoading}
                className="h-7 px-2.5 text-xs"
              >
                {isBriefLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
                <span className="ml-1">Brief</span>
              </Button>
              <Button asChild size="sm" className="h-7 px-2.5 text-xs">
                <a href={opportunity.htmlUrl} target="_blank" rel="noreferrer">
                  Open
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ContributionDashboard({ user }: ContributionDashboardProps) {
  const { data, error, isLoading, isRefreshing, refresh } = useStarredRepos(user?.id)
  const { data: metadata } = useSWR<UserMetadata>(
    user?.id ? "/api/user/metadata" : null,
    (url: string) => fetch(url).then((response) => response.json()),
    { revalidateOnFocus: false },
  )

  const [language, setLanguage] = useState("all")
  const [difficulty, setDifficulty] = useState<SelectableDifficulty>("all")
  const [contributionType, setContributionType] = useState<SelectableType>("all")
  const [search, setSearch] = useState("")
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [opportunities, setOpportunities] = useState<ContributionOpportunity[]>([])
  const [scannedRepos, setScannedRepos] = useState(0)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [opportunityError, setOpportunityError] = useState<string | null>(null)
  const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(false)
  const [selectedOpportunity, setSelectedOpportunity] = useState<ContributionOpportunity | null>(null)
  const [selectedIssue, setSelectedIssue] = useState<ContributionOpportunity | null>(null)
  const [brief, setBrief] = useState<ContributionBrief | null>(null)
  const [briefError, setBriefError] = useState<string | null>(null)
  const [briefLoadingId, setBriefLoadingId] = useState<string | null>(null)

  const repos = useMemo(() => {
    const rawRepos = data?.repos ?? []
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
  }, [data?.repos, metadata])

  const languageOptions = useMemo(() => {
    const counts = new Map<string, number>()
    repos.forEach((repo) => {
      if (repo.language) counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1)
    })
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
  }, [repos])

  const issueDiscoveryRepos = useMemo(() => {
    return [...repos]
      .filter((repo) => !repo.archived && repo.openIssuesCount > 0)
      .sort((a, b) => {
        const pinnedBoostA = a.isPinned ? 1 : 0
        const pinnedBoostB = b.isPinned ? 1 : 0
        return (
          pinnedBoostB - pinnedBoostA ||
          b.openIssuesCount - a.openIssuesCount ||
          b.stargazersCount - a.stargazersCount
        )
      })
      .slice(0, ISSUE_DISCOVERY_REPO_LIMIT)
  }, [repos])

  const issueDiscoverySignature = useMemo(() => {
    return issueDiscoveryRepos
      .map((repo) => `${repo.id}:${repo.openIssuesCount}:${repo.pushedAt}`)
      .join("|")
  }, [issueDiscoveryRepos])

  const issueCacheKey = getCacheKey(user?.id)
  const collections = metadata?.collections ?? []
  const tags = metadata?.tags ?? []
  const uncategorizedCount = repos.filter((repo) => repo.tags.length === 0 && repo.collections.length === 0).length
  const lastSynced = data?.lastSynced
    ? (data.fromCache ? "Cached " : "Synced ") + formatDistanceToNow(new Date(data.lastSynced), { addSuffix: true })
    : null

  const loadOpportunities = async ({ force = false }: { force?: boolean } = {}) => {
    if (issueDiscoveryRepos.length === 0) return

    if (!force) {
      const cached = readCachedOpportunities(issueCacheKey, issueDiscoverySignature)
      if (cached) {
        setOpportunities(cached.opportunities)
        setScannedRepos(cached.scannedRepos)
        setGeneratedAt(cached.generatedAt)
        setOpportunityError(null)
        return
      }
    }

    setIsLoadingOpportunities(true)
    setOpportunityError(null)

    try {
      const response = await fetch("/api/github/contribution-opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repos: issueDiscoveryRepos,
          maxRepos: ISSUE_SCAN_REPO_LIMIT,
          preferences: {
            languages: [],
            difficulty: "all",
            contributionTypes: [],
          },
        }),
      })
      const result = (await response.json()) as OpportunitiesResponse

      if (!response.ok) {
        throw new Error(result.error || "Failed to load opportunities")
      }

      setOpportunities(result.opportunities)
      setScannedRepos(result.scannedRepos)
      setGeneratedAt(result.generatedAt)
      writeCachedOpportunities(issueCacheKey, {
        opportunities: result.opportunities,
        scannedRepos: result.scannedRepos,
        generatedAt: result.generatedAt,
        repoSignature: issueDiscoverySignature,
        cachedAt: new Date().toISOString(),
      })
    } catch (loadError) {
      setOpportunityError(loadError instanceof Error ? loadError.message : "Failed to load opportunities")
    } finally {
      setIsLoadingOpportunities(false)
    }
  }

  useEffect(() => {
    if (issueDiscoveryRepos.length === 0) return
    void loadOpportunities()
  }, [issueDiscoveryRepos.length, issueDiscoverySignature, issueCacheKey])

  const handleRefreshRepos = async () => {
    await refresh({
      manual: true,
      triggerKind: "user",
      triggerSource: "contribute-navbar-refresh",
      triggerContext: "contribute",
    })
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate contribution brief")
      }

      const brief = result.brief as ContributionBrief
      setBrief(brief)
      writeCachedBrief(opportunity.id, brief)
    } catch (loadError) {
      setBriefError(loadError instanceof Error ? loadError.message : "Failed to generate contribution brief")
    } finally {
      setBriefLoadingId(null)
    }
  }

  const filteredOpportunities = useMemo(() => {
    const q = search.trim().toLowerCase()
    return opportunities.filter((opportunity) => {
      if (language !== "all" && opportunity.repoLanguage !== language) return false
      if (difficulty !== "all" && opportunity.difficulty !== difficulty) return false
      if (contributionType !== "all" && !opportunity.contributionTypes.includes(contributionType)) return false
      if (q) {
        const matchesText =
          opportunity.repoFullName.toLowerCase().includes(q) ||
          opportunity.title.toLowerCase().includes(q)
        if (!matchesText) return false
      }
      return true
    })
  }, [opportunities, language, difficulty, contributionType, search])

  const topStats = {
    starter: filteredOpportunities.filter((opportunity) => opportunity.difficulty === "beginner").length,
    docs: filteredOpportunities.filter((opportunity) => opportunity.contributionTypes.includes("docs")).length,
    bugfix: filteredOpportunities.filter((opportunity) => opportunity.contributionTypes.includes("bugfix")).length,
  }

  const clearFilters = () => {
    setLanguage("all")
    setDifficulty("all")
    setContributionType("all")
    setSearch("")
  }

  return (
    <SidebarProvider>
      <AppSidebar
        collections={collections}
        tags={tags}
        selectedCollection={null}
        selectedTag={null}
        showUncategorized={false}
        onSelectCollection={() => {}}
        onSelectTag={() => {}}
        onShowUncategorized={() => {}}
        totalStars={repos.length}
        uncategorizedCount={uncategorizedCount}
        userId={user?.id}
      />
      <SidebarInset className="overflow-x-hidden">
        <AppPageHeader
          lastSynced={lastSynced}
          user={user}
          onRefresh={handleRefreshRepos}
          isRefreshing={isRefreshing}
          searchLabel="Search opportunities..."
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          hideNavActions
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadOpportunities({ force: true })}
              disabled={isLoadingOpportunities || repos.length === 0}
            >
              {isLoadingOpportunities ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
              <span className="hidden sm:inline">Scan issues</span>
            </Button>
          }
        />

        <main className="flex-1 p-6">
          <section className="mb-6 flex flex-col gap-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex max-w-3xl flex-col gap-2">
                <div className="inline-flex w-fit items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Contribution Opportunities
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">Turn starred repos into open-source work</h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  Ranked open issues from repositories you already care about, filtered by stack, difficulty, and contribution style.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:min-w-96">
                <div className="rounded-lg border border-border/60 bg-card/70 p-3">
                  <div className="text-lg font-semibold tabular-nums">{filteredOpportunities.length}</div>
                  <div className="text-xs text-muted-foreground">Matches</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/70 p-3">
                  <div className="text-lg font-semibold tabular-nums">{topStats.starter}</div>
                  <div className="text-xs text-muted-foreground">Beginner</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/70 p-3">
                  <div className="text-lg font-semibold tabular-nums">{scannedRepos}</div>
                  <div className="text-xs text-muted-foreground">Repos scanned</div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border border-border/60 bg-card/60 p-3 md:grid-cols-4">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger aria-label="Language filter">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All languages</SelectItem>
                  {languageOptions.map(([name, count]) => (
                    <SelectItem key={name} value={name}>
                      {name} ({count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={difficulty} onValueChange={(value) => setDifficulty(value as SelectableDifficulty)}>
                <SelectTrigger aria-label="Difficulty filter">
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any difficulty</SelectItem>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>

              <Select value={contributionType} onValueChange={(value) => setContributionType(value as SelectableType)}>
                <SelectTrigger aria-label="Contribution type filter">
                  <SelectValue placeholder="Contribution type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any type</SelectItem>
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
                <span>{generatedAt ? `Updated ${formatDistanceToNow(new Date(generatedAt), { addSuffix: true })}` : "Not scanned yet"}</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </section>

          {isLoading && !data && opportunities.length === 0 && (
            <div className="columns-1 gap-4 md:columns-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="mb-4 break-inside-avoid">
                  <OpportunitySkeleton />
                </div>
              ))}
            </div>
          )}

          {error && !data && (
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-destructive">Failed to load starred repositories</p>
              <Button variant="outline" onClick={handleRefreshRepos}>Try again</Button>
            </div>
          )}

          {opportunityError && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {opportunityError}
            </div>
          )}

          {isLoadingOpportunities && opportunities.length === 0 && (
            <div className="columns-1 gap-4 md:columns-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="mb-4 break-inside-avoid">
                  <OpportunitySkeleton />
                </div>
              ))}
            </div>
          )}

          {!isLoadingOpportunities && data && filteredOpportunities.length === 0 && opportunities.length === 0 && (
            <EmptyOpportunities onRefresh={() => loadOpportunities({ force: true })} />
          )}

          {filteredOpportunities.length > 0 && (
            <div className="columns-1 gap-4 md:columns-2">
              {filteredOpportunities.map((opportunity) => (
                <div key={opportunity.id} className="mb-4 break-inside-avoid">
                  <OpportunityCard
                    opportunity={opportunity}
                    onBrief={handleBrief}
                    onViewIssue={setSelectedIssue}
                    isBriefLoading={briefLoadingId === opportunity.id}
                  />
                </div>
              ))}
            </div>
          )}
        </main>
      </SidebarInset>

      <Dialog open={Boolean(selectedOpportunity)} onOpenChange={(open) => !open && setSelectedOpportunity(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Contribution brief</DialogTitle>
            <DialogDescription>
              {selectedOpportunity ? `${selectedOpportunity.repoFullName} #${selectedOpportunity.issueNumber}` : "Issue plan"}
            </DialogDescription>
          </DialogHeader>

          {briefLoadingId && (
            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating a practical first-pass plan...
            </div>
          )}

          {briefError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {briefError}
            </div>
          )}

          {brief && (
            <div className="flex flex-col gap-5 text-sm">
              <p className="leading-6 text-muted-foreground">{brief.summary}</p>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <h3 className="font-medium">Why it fits</h3>
                  <ul className="flex flex-col gap-1.5 text-muted-foreground">
                    {brief.whyItFits.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="font-medium">Likely starting points</h3>
                  <ul className="flex flex-col gap-1.5 text-muted-foreground">
                    {brief.likelyFiles.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="font-medium">First steps</h3>
                <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground">
                  {brief.firstSteps.map((item) => <li key={item}>{item}</li>)}
                </ol>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="font-medium">Questions to ask</h3>
                <ul className="flex flex-col gap-1.5 text-muted-foreground">
                  {brief.questionsToAsk.map((item) => <li key={item}>- {item}</li>)}
                </ul>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="font-medium">Coding assistant prompt</h3>
                <pre className="whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
                  {brief.codingAssistantPrompt}
                </pre>
              </div>

              {selectedOpportunity && (
                <Button asChild>
                  <a href={selectedOpportunity.htmlUrl} target="_blank" rel="noreferrer">
                    Open GitHub issue
                    <ExternalLink data-icon="inline-end" />
                  </a>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ContributionCommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        opportunities={opportunities}
        filteredOpportunities={filteredOpportunities}
        language={language}
        difficulty={difficulty}
        contributionType={contributionType}
        languageOptions={languageOptions}
        search={search}
        isLoadingOpportunities={isLoadingOpportunities}
        isRefreshing={isRefreshing}
        onLanguageChange={setLanguage}
        onDifficultyChange={setDifficulty}
        onContributionTypeChange={setContributionType}
        onSearchChange={setSearch}
        onScanIssues={() => loadOpportunities({ force: true })}
        onRefresh={handleRefreshRepos}
        onClearFilters={clearFilters}
      />

      <IssueViewer
        opportunity={selectedIssue}
        open={Boolean(selectedIssue)}
        onClose={() => setSelectedIssue(null)}
      />
    </SidebarProvider>
  )
}
