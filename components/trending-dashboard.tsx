"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { TrendingSection } from "./trending-section"
import { RepoDetailPanel } from "./repo-detail-panel"
import { ReadmeViewer } from "./readme-viewer"
import { TrendingEmptyState } from "./trending-empty-state"
import type { User } from "@supabase/supabase-js"
import { Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from "date-fns"
import type { StarredRepo, UserMetadata } from "@/lib/types"
import { analyzeTrending, TrendingAnalysis } from "@/lib/trending"
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core"
import { useStarredRepos } from "@/lib/use-starred-repos"
import { trackRecentlyViewedRepo } from "@/lib/recently-viewed"
import { AppPageHeader } from "@/components/app-page-header"
import { RepoCommandPalette } from "@/components/repo-command-palette"

interface TrendingDashboardProps {
  user: User | null
}

export function TrendingDashboard({ user }: TrendingDashboardProps) {
  const [selectedRepo, setSelectedRepo] = useState<StarredRepo | null>(null)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)
  const [readmeViewerOpen, setReadmeViewerOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Sensors for DnD
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } })
  )

  // Fetch starred repos
  const { data, error, isLoading, isRefreshing, refresh } = useStarredRepos(user?.id)

  // Fetch user metadata (tags, collections) from Supabase
  const { data: metadata } = useSWR<UserMetadata>(
    user?.id ? '/api/user/metadata' : null,
    (url: string) => fetch(url).then(r => r.json()),
    { revalidateOnFocus: false }
  )

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

  const uncategorizedCount = useMemo(() => {
    return repos.filter((repo) => repo.tags.length === 0 && repo.collections.length === 0).length
  }, [repos])

  // Analyze repos for trending recommendations
  const trendingAnalysis = useMemo<TrendingAnalysis>(() => {
    if (repos.length === 0) {
      return {
        categories: [],
        topLanguages: [],
        topTopics: [],
        totalAnalyzed: 0,
      }
    }
    return analyzeTrending(repos)
  }, [repos])

  const lastSynced = data?.lastSynced
    ? (data.fromCache ? "Cached " : "Synced ") + formatDistanceToNow(new Date(data.lastSynced), { addSuffix: true })
    : null
  const hasRepoData = Boolean(data)

  const handleRefresh = async () => {
    await refresh({ manual: true })
  }

  const handleRepoClick = (repo: StarredRepo) => {
    if (user?.id) {
      trackRecentlyViewedRepo(user.id, repo, "trending")
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

  // Use real collections/tags from metadata
  const collections = metadata?.collections ?? []
  const tags = metadata?.tags ?? []
  const trendingRepos = useMemo(() => {
    const seen = new Set<string>()
    const flattened: StarredRepo[] = []

    trendingAnalysis.categories.forEach((category) => {
      category.repos.forEach((repo) => {
        if (seen.has(repo.id)) return
        seen.add(repo.id)
        flattened.push(repo)
      })
    })

    return flattened
  }, [trendingAnalysis.categories])

  return (
    <DndContext sensors={sensors}>
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
          searchLabel="Search trending repos and actions"
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          lastSynced={lastSynced}
          user={user}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 p-6">
          <section className="mb-8 space-y-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Trending</h1>
              <p className="text-sm text-muted-foreground">
                Discover repositories based on your last {trendingAnalysis.totalAnalyzed} starred repos
              </p>
            </div>

            {trendingAnalysis.topLanguages.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Top languages:</span>
                  <div className="flex flex-wrap items-center gap-1">
                    {trendingAnalysis.topLanguages.slice(0, 3).map((lang) => (
                      <span
                        key={lang}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
                {trendingAnalysis.topTopics.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Top topics:</span>
                    <div className="flex flex-wrap items-center gap-1">
                      {trendingAnalysis.topTopics.slice(0, 3).map((topic) => (
                        <span
                          key={topic}
                          className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
          {/* Loading State */}
          {isLoading && !hasRepoData && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">
                {data?.fromCache ? "Refreshing your starred repositories..." : "Analyzing your starred repositories..."}
              </p>
            </div>
          )}

          {/* Error State */}
          {error && !hasRepoData && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-destructive">Failed to load starred repositories</p>
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}

          {/* API Error */}
          {data?.error && !hasRepoData && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-destructive">{data.error}</p>
              <p className="text-sm text-muted-foreground">
                Your GitHub token may have expired. Please sign out and sign in again.
              </p>
            </div>
          )}

          {/* Empty State - Not Enough Stars */}
          {hasRepoData && !data?.error && data?.repos && data.repos.length < 25 && (
            <TrendingEmptyState
              currentCount={data.repos.length}
              requiredCount={25}
            />
          )}

          {/* Trending Sections */}
          {hasRepoData && !data?.error && data?.repos && data.repos.length >= 25 && (
            <div className="space-y-6">
              {trendingAnalysis.categories.map((category) => (
                <TrendingSection
                  key={category.id}
                  title={category.title}
                  description={category.description}
                  repos={category.repos}
                  onRepoClick={handleRepoClick}
                />
              ))}

              {/* Fallback if no categories have repos */}
              {trendingAnalysis.categories.length === 0 && (
                <div className="text-center py-20">
                  <p className="text-muted-foreground">No trending recommendations found.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Try starring more repositories to get personalized recommendations.
                  </p>
                </div>
              )}
            </div>
          )}
        </main>
      </SidebarInset>

      <RepoCommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        title="Search Trending"
        description="Search trending repositories and run quick actions."
        headerLabel="Search trending repositories and actions"
        placeholder="Jump to a trending repo or action..."
        emptyHint="Try a repo name or a trending recommendation."
        repos={trendingRepos}
        actions={[
          {
            value: "refresh-trending",
            label: "Refresh starred repositories",
            shortcut: "Sync",
            icon: RefreshCw,
            onSelect: handleRefresh,
          },
        ]}
        onRepoOpen={handleRepoClick}
      />

      {/* Detail Panel */}
      <RepoDetailPanel
        repo={selectedRepo}
        open={detailPanelOpen}
        onClose={handleCloseDetail}
        onViewReadme={handleViewReadme}
        collections={[]}
        tags={[]}
        onStatusChange={() => {}}
        onTagToggle={() => {}}
        onTagCreate={() => {}}
        onCollectionToggle={() => {}}
        onCollectionCreate={() => {}}
        onNotesChange={() => {}}
        onPinToggle={() => {}}
      />

      {/* README Viewer */}
      <ReadmeViewer
        repo={selectedRepo}
        open={readmeViewerOpen}
        onClose={handleCloseReadme}
      />
    </SidebarProvider>
    </DndContext>
  )
}
