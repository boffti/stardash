"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import type { User } from "@supabase/supabase-js"
import {
  History,
  RefreshCw,
  Search,
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
import { RepoGrid } from "@/components/repo-grid"
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
          <section className="mb-8 space-y-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Recently viewed</h1>
              <p className="text-sm text-muted-foreground">
                Reopen repositories you looked at recently across your dashboard and trending workflow.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs">
                  {recentEntries.length} tracked
                </Badge>
                <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs">
                  Last viewed {lastViewed ? formatDistanceToNow(new Date(lastViewed), { addSuffix: true }) : "never"}
                </Badge>
                <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs">
                  Top language {topLanguages[0]?.[0] ?? "Mixed"}
                </Badge>
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
          </section>

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
            <section>
              <RepoGrid
                repos={recentRepos.map(({ repo }) => repo)}
                onRepoClick={handleRepoClick}
              />
            </section>
          )}
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
