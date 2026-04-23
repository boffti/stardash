"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import {
  History,
  RefreshCw,
  Search,
} from "lucide-react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { RepoDetailPanel } from "@/components/repo-detail-panel"
import { ReadmeViewer } from "@/components/readme-viewer"
import { RepoGrid } from "@/components/repo-grid"
import { useStarredRepos } from "@/lib/use-starred-repos"
import { useRecentlyViewed, trackRecentlyViewedRepo } from "@/lib/recently-viewed"
import type { StarredRepo, UserMetadata } from "@/lib/types"
import { AppPageHeader } from "@/components/app-page-header"
import { RepoCommandPalette } from "@/components/repo-command-palette"
import { useUser } from "@/components/providers/user-provider"

export function RecentlyViewedDashboard() {
  const { user } = useUser()
  const [selectedRepo, setSelectedRepo] = useState<StarredRepo | null>(null)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)
  const [readmeViewerOpen, setReadmeViewerOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const { data, isRefreshing, refresh } = useStarredRepos(user?.id)
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

  const handleRefresh = async (triggerSource: string = "recently-viewed-navbar-refresh") => {
    await refresh({
      manual: true,
      triggerKind: "user",
      triggerSource,
      triggerContext: "recently-viewed",
    })
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
        <AppPageHeader
          searchLabel="Search recently viewed repos"
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          lastSynced={lastSynced}
          onRefresh={() => handleRefresh("recently-viewed-navbar-refresh")}
          isRefreshing={isRefreshing}
        />

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

      <RepoCommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        title="Search Recently Viewed"
        description="Search recently viewed repositories and run quick actions."
        headerLabel="Search recently viewed repositories and actions"
        placeholder="Jump to a recently viewed repo or action..."
        emptyHint="Try a repo name or a language from your recent stack."
        repos={recentRepos.map(({ repo }) => repo)}
        actions={[
          {
            value: "refresh-recent",
            label: "Refresh starred repositories",
            shortcut: "Sync",
            icon: RefreshCw,
            onSelect: () => handleRefresh("recently-viewed-command-palette"),
          },
        ]}
        onRepoOpen={handleRepoClick}
      />

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
