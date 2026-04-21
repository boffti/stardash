"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  GitPullRequestArrow,
  Loader2,
  RefreshCw,
  Search,
  Star,
} from "lucide-react"
import type { User } from "@supabase/supabase-js"
import { AppSidebar } from "@/components/app-sidebar"
import { IssueViewer } from "@/components/issue-viewer"
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
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

interface RepoContributionsPageProps {
  user: User | null
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

function readCachedRepoScan(userId: string | undefined, fullName: string): OpportunitiesResponse | undefined {
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

function writeCachedRepoScan(userId: string | undefined, fullName: string, data: OpportunitiesResponse) {
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
  if (score >= 80) return "border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  if (score >= 60) return "border-sky-500/35 bg-sky-500/10 text-sky-600 dark:text-sky-400"
  return "border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400"
}

function OpportunityCard({
  opportunity,
  onBrief,
  onViewIssue,
  isBriefLoading,
  isBriefLimited,
}: {
  opportunity: ContributionOpportunity
  onBrief: (opportunity: ContributionOpportunity) => void
  onViewIssue: (opportunity: ContributionOpportunity) => void
  isBriefLoading: boolean
  isBriefLimited: boolean
}) {
  const langColor = LANGUAGE_COLORS[opportunity.repoLanguage ?? ""] ?? "#64748b"

  return (
    <Card className="overflow-hidden border-border/60 bg-card/80">
      <CardHeader className="gap-3 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {opportunity.repoLanguage && (
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: langColor }} />
              )}
              <span>#{opportunity.issueNumber}</span>
              <span>Updated {formatDistanceToNow(new Date(opportunity.updatedAt), { addSuffix: true })}</span>
            </div>
            <button
              onClick={() => onViewIssue(opportunity)}
              className="mt-1 line-clamp-2 text-left text-base font-semibold leading-snug transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {opportunity.title}
            </button>
          </div>
          <Badge variant="outline" className={cn("shrink-0 tabular-nums", scoreTone(opportunity.score))}>
            {opportunity.score}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <button onClick={() => onViewIssue(opportunity)} className="group text-left">
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground group-hover:text-muted-foreground/80">
            {opportunity.bodyPreview}
          </p>
          <span className="mt-1 text-xs text-muted-foreground/60 group-hover:text-muted-foreground">Read full issue</span>
        </button>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-border/60 bg-muted/20 p-3">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Why it ranks</p>
            <ul className="flex flex-col gap-1.5">
              {opportunity.fitReasons.slice(0, 3).map((reason) => (
                <li key={reason} className="flex gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-emerald-500" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 p-3">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Signals</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-xs">{opportunity.difficulty}</Badge>
              {opportunity.contributionTypes.map((type) => (
                <Badge key={type} variant="outline" className="text-xs">{typeLabels[type]}</Badge>
              ))}
              {opportunity.labels.slice(0, 4).map((label) => (
                <Badge key={label} variant="secondary" className="max-w-36 truncate text-xs">{label}</Badge>
              ))}
            </div>
          </div>
        </div>

        {opportunity.risks.length > 0 && (
          <div className="flex gap-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>{opportunity.risks.slice(0, 2).join(" · ")}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Star className="size-3.5" />{opportunity.repoStars.toLocaleString()}</span>
            <span>{opportunity.comments} comments</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBrief(opportunity)}
              disabled={isBriefLoading || isBriefLimited}
            >
              {isBriefLoading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Bot data-icon="inline-start" />}
              Brief
            </Button>
            <Button asChild size="sm">
              <a href={opportunity.htmlUrl} target="_blank" rel="noreferrer">
                Open
                <ExternalLink data-icon="inline-end" />
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

async function scanRepo(repo: StarredRepo, force = false): Promise<OpportunitiesResponse> {
  const response = await fetch("/api/github/contribution-opportunities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repos: [repo],
      maxRepos: 5,
      maxIssuesPerRepo: 500,
      force,
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

export function RepoContributionsPage({ user, owner, repo: repoName }: RepoContributionsPageProps) {
  const router = useRouter()
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
  const fallbackData = useMemo(() => readCachedRepoScan(userId, fullName), [fullName, userId])

  const { data, error, isLoading, isValidating, mutate } = useSWR<OpportunitiesResponse>(
    repo ? ["repo-contributions", repo.fullName] : null,
    () => scanRepo(repo!, false),
    {
      fallbackData,
      revalidateOnMount: !fallbackData,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      onSuccess(result) {
        writeCachedRepoScan(userId, fullName, result)
      },
    },
  )

  const [search, setSearch] = useState("")
  const [difficulty, setDifficulty] = useState<SelectableDifficulty>("all")
  const [type, setType] = useState<SelectableType>("all")
  const [selectedIssue, setSelectedIssue] = useState<ContributionOpportunity | null>(null)
  const [selectedOpportunity, setSelectedOpportunity] = useState<ContributionOpportunity | null>(null)
  const [brief, setBrief] = useState<ContributionBrief | null>(null)
  const [briefError, setBriefError] = useState<string | null>(null)
  const [briefLoadingId, setBriefLoadingId] = useState<string | null>(null)
  const [briefLimit, setBriefLimit] = useState<{ remaining: number | null; nextAllowedAt: string | null }>({ remaining: null, nextAllowedAt: null })
  const [copiedPrompt, setCopiedPrompt] = useState(false)

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
    const result = await scanRepo(repo, true)
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
        setBriefError(result.error ?? "Brief limit reached")
        return
      }

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to generate contribution brief")
      if (typeof result.remaining === "number") setBriefLimit({ remaining: result.remaining, nextAllowedAt: null })
      const nextBrief = result.brief as ContributionBrief
      setBrief(nextBrief)
      writeCachedBrief(opportunity.id, nextBrief)
    } catch (briefLoadError) {
      setBriefError(briefLoadError instanceof Error ? briefLoadError.message : "Failed to generate contribution brief")
    } finally {
      setBriefLoadingId(null)
    }
  }

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

  return (
    <SidebarProvider>
      <AppSidebar {...sidebarProps} />
      <SidebarInset className="overflow-x-hidden">
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push(`/repo/${owner}/${repoName}`)}>
              <ArrowLeft data-icon="inline-start" />
              Repo detail
            </Button>
            <Button variant="outline" size="sm" onClick={handleScanAgain} disabled={!repo || isValidating}>
              {isValidating ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}
              Scan issues
            </Button>
          </div>

          <section className="rounded-xl border border-border/60 bg-card px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Contribution Opportunities</p>
                <h1 className="mt-1 font-mono text-2xl font-semibold">{fullName}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  Ranked open issues from this repository, scanned deeply and filtered for practical first contributions.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Ranked", stats.total],
                  ["Beginner", stats.beginner],
                  ["Docs", stats.docs],
                  ["Bugfix", stats.bugfix],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-24 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
                    <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search issues, labels, and context..." className="pl-9" />
            </div>
            <Select value={difficulty} onValueChange={(value) => setDifficulty(value as SelectableDifficulty)}>
              <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Difficulty" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All difficulty</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(value) => setType(value as SelectableType)}>
              <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(typeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
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
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error.message}
            </div>
          )}

          {!reposLoading && !repo && (
            <div className="rounded-lg border border-border/60 bg-card px-4 py-10 text-center">
              <p className="font-medium">Repository not found</p>
              <p className="mt-1 text-sm text-muted-foreground">This repository is not in your starred repo cache.</p>
            </div>
          )}

          {repo && !isLoading && filtered.length === 0 && (
            <div className="rounded-lg border border-border/60 bg-card px-4 py-10 text-center">
              <GitPullRequestArrow className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No matching opportunities</p>
              <p className="mt-1 text-sm text-muted-foreground">Try clearing filters or scanning again.</p>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {filtered.map((opportunity) => (
                <OpportunityCard
                  key={opportunity.id}
                  opportunity={opportunity}
                  onBrief={handleBrief}
                  onViewIssue={setSelectedIssue}
                  isBriefLoading={briefLoadingId === opportunity.id}
                  isBriefLimited={isBriefLimited}
                />
              ))}
            </div>
          )}
        </main>
      </SidebarInset>

      <Dialog open={Boolean(selectedOpportunity)} onOpenChange={(open) => !open && setSelectedOpportunity(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI contribution brief</DialogTitle>
            <DialogDescription>
              {selectedOpportunity ? `${selectedOpportunity.repoFullName} #${selectedOpportunity.issueNumber}` : "Issue plan"}
            </DialogDescription>
          </DialogHeader>

          {briefLoadingId && (
            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Building a practical first-pass plan...
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
                <div>
                  <h3 className="font-medium">Why it fits</h3>
                  <ul className="mt-2 flex flex-col gap-1.5 text-muted-foreground">
                    {brief.whyItFits.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium">Likely files</h3>
                  <ul className="mt-2 flex flex-col gap-1.5 text-muted-foreground">
                    {brief.likelyFiles.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
              </div>
              <div>
                <h3 className="font-medium">First steps</h3>
                <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground">
                  {brief.firstSteps.map((item) => <li key={item}>{item}</li>)}
                </ol>
              </div>
              <div>
                <h3 className="font-medium">Questions to ask</h3>
                <ul className="mt-2 flex flex-col gap-1.5 text-muted-foreground">
                  {brief.questionsToAsk.map((item) => <li key={item}>- {item}</li>)}
                </ul>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Coding assistant prompt</h3>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(brief.codingAssistantPrompt)
                          setCopiedPrompt(true)
                          setTimeout(() => setCopiedPrompt(false), 2000)
                        }}
                      >
                        {copiedPrompt ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{copiedPrompt ? "Copied" : "Copy prompt"}</TooltipContent>
                  </Tooltip>
                </div>
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
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

      <IssueViewer opportunity={selectedIssue} open={Boolean(selectedIssue)} onClose={() => setSelectedIssue(null)} />
    </SidebarProvider>
  )
}
