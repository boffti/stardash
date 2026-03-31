"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import type { User } from "@supabase/supabase-js"
import {
  ArrowUpRight,
  Clock3,
  History,
  Layers3,
  RefreshCw,
  Search,
  SidebarOpen,
} from "lucide-react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { RepoDetailPanel } from "@/components/repo-detail-panel"
import { ReadmeViewer } from "@/components/readme-viewer"
import { UserMenu } from "@/components/user-menu"
import { useStarredRepos } from "@/lib/use-starred-repos"
import { useRecentlyViewed, trackRecentlyViewedRepo } from "@/lib/recently-viewed"
import type { StarredRepo, UserMetadata } from "@/lib/types"

interface RecentlyViewedDashboardProps {
  user: User | null
}

export function RecentlyViewedDashboard({ user }: RecentlyViewedDashboardProps) {
  const [selectedRepo, setSelectedRepo] = useState<StarredRepo | null>(null)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)
  const [readmeViewerOpen, setReadmeViewerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const { data, isLoading, isRefreshing, refresh } = useStarredRepos(user?.id)
  const { data: metadata } = useSWR<UserMetadata>(
    user?.id ? "/api/user/metadata" : null,
    (url: string) => fetch(url).then((response) => response.json()),
    { revalidateOnFocus: false },
  )
  const recentEntries = useRecentlyViewed(user?.id)

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

  const recentRepos = useMemo(() => {
    const repoById = new Map(repos.map((repo) => [repo.id, repo]))

    return recentEntries
      .map((entry) => ({
        ...entry,
        repo: repoById.get(entry.repo.id) ?? entry.repo,
      }))
      .filter(({ repo }) => {
        if (!searchQuery.trim()) return true

        const query = searchQuery.toLowerCase()
        return (
          repo.fullName.toLowerCase().includes(query) ||
          repo.description?.toLowerCase().includes(query) ||
          repo.language?.toLowerCase().includes(query) ||
          repo.tags.some((tag) => tag.label.toLowerCase().includes(query))
        )
      })
  }, [recentEntries, repos, searchQuery])

  const topLanguages = useMemo(() => {
    const counts = new Map<string, number>()

    recentRepos.forEach(({ repo }) => {
      if (!repo.language) return
      counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1)
    })

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
  }, [recentRepos])

  const lastViewed = recentRepos[0]?.viewedAt
  const lastSynced = data?.lastSynced
    ? (data.fromCache ? "Cached " : "Synced ") + formatDistanceToNow(new Date(data.lastSynced), { addSuffix: true })
    : null

  const collections = metadata?.collections ?? []
  const tags = metadata?.tags ?? []
  const uncategorizedCount = useMemo(() => {
    return repos.filter((repo) => repo.tags.length === 0 && repo.collections.length === 0).length
  }, [repos])

  const handleRefresh = async () => {
    await refresh({ manual: true })
  }

  const handleRepoClick = (repo: StarredRepo) => {
    if (user?.id) {
      trackRecentlyViewedRepo(user.id, repo, "recently-viewed")
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
        recentCount={recentEntries.length}
        userId={user?.id}
      />
      <SidebarInset className="overflow-x-hidden">
        <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <SidebarTrigger className="-ml-1 shrink-0" />
            <Link
              href="/recently-viewed"
              className="hidden h-10 min-w-[280px] flex-1 items-center gap-3 rounded-xl border border-border/70 bg-secondary/45 px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground md:inline-flex lg:max-w-[420px]"
            >
              <History className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">Recently viewed stack</span>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={Boolean(isLoading)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              title={isRefreshing ? "Refreshing…" : (lastSynced ?? "Refresh")}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{isRefreshing ? "Refreshing…" : "Refresh"}</span>
            </button>
            <UserMenu user={user} lastSynced={lastSynced} />
          </div>
        </header>

        <main className="flex-1 p-6">
          <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.16),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_30%)]" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <Badge variant="outline" className="rounded-full border-border/70 bg-background/70 px-3 py-1 text-xs">
                  Activity memory
                </Badge>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight">Recently viewed stack</h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    Pick up where you left off. This page tracks repositories you opened from the dashboard and trending views, then keeps the latest stack within easy reach.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryCard icon={Layers3} label="Tracked repos" value={String(recentEntries.length)} />
                <SummaryCard
                  icon={Clock3}
                  label="Last viewed"
                  value={lastViewed ? formatDistanceToNow(new Date(lastViewed), { addSuffix: true }) : "Nothing yet"}
                />
                <SummaryCard
                  icon={SidebarOpen}
                  label="Top language"
                  value={topLanguages[0]?.[0] ?? "Mixed"}
                />
              </div>
            </div>
          </section>

          <section className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">View history</h2>
                <p className="text-sm text-muted-foreground">
                  Latest opens first, deduplicated per repository.
                </p>
              </div>
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search recently viewed repos"
                  className="pl-9"
                />
              </div>
            </div>

            {recentRepos.length === 0 ? (
              <Empty className="rounded-2xl border border-dashed border-border/70 py-16">
                <EmptyMedia variant="icon">
                  <History className="h-10 w-10" />
                </EmptyMedia>
                <EmptyTitle>No recently viewed repositories</EmptyTitle>
                <EmptyDescription>
                  Open a repository from <Link href="/dashboard" className="underline underline-offset-4">All Stars</Link> or <Link href="/trending" className="underline underline-offset-4">Trending</Link> to start building this stack.
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {recentRepos.map(({ repo, viewedAt, source }) => (
                  <button
                    key={repo.id}
                    type="button"
                    onClick={() => handleRepoClick(repo)}
                    className="group rounded-2xl border border-border/70 bg-card/70 p-4 text-left transition-colors hover:border-border hover:bg-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <Avatar className="mt-0.5 h-10 w-10 shrink-0">
                          <AvatarImage src={repo.avatarUrl} alt={repo.owner} />
                          <AvatarFallback>{repo.owner[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-mono text-sm font-medium">{repo.fullName}</p>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                          </div>
                          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                            {repo.description || "No description available"}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 rounded-full text-[11px] capitalize">
                        {source.replace("-", " ")}
                      </Badge>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="rounded-full px-2.5 py-1 font-normal">
                        Viewed {formatDistanceToNow(new Date(viewedAt), { addSuffix: true })}
                      </Badge>
                      {repo.language && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: repo.languageColor || "#64748b" }}
                          />
                          {repo.language}
                        </span>
                      )}
                      <span className="rounded-full border border-border/70 px-2.5 py-1">
                        {repo.stargazersCount.toLocaleString()} stars
                      </span>
                      {repo.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag.id}
                          className="rounded-full px-2.5 py-1"
                          style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </main>
      </SidebarInset>

      <RepoDetailPanel
        repo={selectedRepo}
        open={detailPanelOpen}
        onClose={handleCloseDetail}
        onViewReadme={handleViewReadme}
        collections={collections}
        tags={tags}
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

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof History
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
