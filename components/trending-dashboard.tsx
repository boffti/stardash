"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import Link from "next/link"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { TrendingSection } from "./trending-section"
import { RepoDetailPanel } from "./repo-detail-panel"
import { ReadmeViewer } from "./readme-viewer"
import { TrendingEmptyState } from "./trending-empty-state"
import { UserMenu } from "./user-menu"
import type { User } from "@supabase/supabase-js"
import { Loader2, AlertCircle, RefreshCw, SidebarOpen, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from "date-fns"
import { getCachedRepos, setCachedRepos } from "@/lib/repo-cache"
import type { StarredRepo, Collection, Tag, UserMetadata } from "@/lib/types"
import { analyzeTrending, TrendingAnalysis } from "@/lib/trending"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core"
import { SidebarTrigger } from "@/components/ui/sidebar"

interface TrendingDashboardProps {
  user: User | null
}

function makefetcher(userId: string | undefined) {
  return async (url: string) => {
    if (userId) {
      const cached = getCachedRepos(userId)
      if (cached) return { repos: cached.repos, lastSynced: cached.cachedAt, fromCache: true }
    }
    const data = await fetch(url).then((res) => res.json())
    if (userId && data.repos) setCachedRepos(userId, data.repos)
    return data
  }
}

export function TrendingDashboard({ user }: TrendingDashboardProps) {
  const [selectedRepo, setSelectedRepo] = useState<StarredRepo | null>(null)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)
  const [readmeViewerOpen, setReadmeViewerOpen] = useState(false)

  const supabase = createClient()

  // Sensors for DnD
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } })
  )

  // Fetch starred repos
  const { data, error, isLoading, mutate } = useSWR<{
    repos: StarredRepo[]
    lastSynced: string
    fromCache?: boolean
    error?: string
  }>("/api/github/starred", makefetcher(user?.id), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })

  // Fetch user metadata (tags, collections) from Supabase
  const { data: metadata } = useSWR<UserMetadata>(
    user?.id ? '/api/user/metadata' : null,
    (url: string) => fetch(url).then(r => r.json()),
    { revalidateOnFocus: false }
  )

  // Analyze repos for trending recommendations
  const trendingAnalysis = useMemo<TrendingAnalysis>(() => {
    if (!data?.repos) {
      return {
        categories: [],
        topLanguages: [],
        topTopics: [],
        totalAnalyzed: 0,
      }
    }
    return analyzeTrending(data.repos)
  }, [data?.repos])

  const lastSynced = data?.lastSynced
    ? (data.fromCache ? "Cached " : "Synced ") + formatDistanceToNow(new Date(data.lastSynced), { addSuffix: true })
    : null

  const handleRefresh = async () => {
    await mutate()
    toast.success("Repositories refreshed")
  }

  const handleRepoClick = (repo: StarredRepo) => {
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
        totalStars={data?.repos?.length || 0}
        uncategorizedCount={0}
      />
      <SidebarInset className="overflow-x-hidden">
        <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <SidebarTrigger className="-ml-1 shrink-0" />
            <Link
              href="/trending"
              className="hidden h-10 min-w-[280px] flex-1 items-center gap-3 rounded-xl border border-border/70 bg-secondary/45 px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground md:inline-flex lg:max-w-[420px]"
            >
              <TrendingUp className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">Trending recommendations</span>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={Boolean(isLoading)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              title={isLoading ? "Refreshing…" : (lastSynced ?? "Refresh")}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{isLoading ? "Refreshing…" : "Refresh"}</span>
            </button>
            <UserMenu user={user} lastSynced={lastSynced} />
          </div>
        </header>

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
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Analyzing your starred repositories...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
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
          {data?.error && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-destructive">{data.error}</p>
              <p className="text-sm text-muted-foreground">
                Your GitHub token may have expired. Please sign out and sign in again.
              </p>
            </div>
          )}

          {/* Empty State - Not Enough Stars */}
          {!isLoading && !error && !data?.error && data?.repos && data.repos.length < 25 && (
            <TrendingEmptyState
              currentCount={data.repos.length}
              requiredCount={25}
            />
          )}

          {/* Trending Sections */}
          {!isLoading && !error && !data?.error && data?.repos && data.repos.length >= 25 && (
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
