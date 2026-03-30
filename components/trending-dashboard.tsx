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
import { getCachedRepos, setCachedRepos } from "@/lib/repo-cache"
import type { StarredRepo, Collection, Tag } from "@/lib/types"
import { analyzeTrending, TrendingAnalysis } from "@/lib/trending"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

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

  // Mock collections/tags for the sidebar (trending page doesn't use them)
  const mockCollections: Collection[] = []
  const mockTags: Tag[] = []

  return (
    <SidebarProvider>
      <AppSidebar
        collections={mockCollections}
        tags={mockTags}
        selectedCollection={null}
        selectedTag={null}
        showUncategorized={false}
        onSelectCollection={() => {}}
        onSelectTag={() => {}}
        onShowUncategorized={() => {}}
        totalStars={data?.repos?.length || 0}
        uncategorizedCount={0}
      />
      <SidebarInset>
        {/* Header */}
        <header className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Trending</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Discover repositories based on your last {trendingAnalysis.totalAnalyzed} starred repos
              </p>
            </div>
            <div className="flex items-center gap-4">
              {lastSynced && (
                <span className="text-xs text-muted-foreground">{lastSynced}</span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-2">Refresh</span>
              </Button>
            </div>
          </div>

          {/* Pattern Summary */}
          {trendingAnalysis.topLanguages.length > 0 && (
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Top languages:</span>
                <div className="flex items-center gap-1">
                  {trendingAnalysis.topLanguages.slice(0, 3).map((lang) => (
                    <span
                      key={lang}
                      className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
              {trendingAnalysis.topTopics.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Top topics:</span>
                  <div className="flex items-center gap-1">
                    {trendingAnalysis.topTopics.slice(0, 3).map((topic) => (
                      <span
                        key={topic}
                        className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </header>

        <main className="flex-1 p-6">
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
            <div className="space-y-12">
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
  )
}
