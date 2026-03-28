"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { DashboardHeader } from "./dashboard-header"
import { RepoGrid } from "./repo-grid"
import { RepoList } from "./repo-list"
import { RepoDetailPanel } from "./repo-detail-panel"
import { ReadmeViewer } from "./readme-viewer"
import { mockCollections, mockTags } from "@/lib/mock-data"
import { StarredRepo } from "@/lib/types"
import type { User } from "@supabase/supabase-js"
import { Badge } from "@/components/ui/badge"
import { X, Loader2, RefreshCw, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from "date-fns"

interface DashboardProps {
  user: User | null
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function Dashboard({ user }: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("starred-desc")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [languageFilter, setLanguageFilter] = useState<string | null>(null)
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [selectedRepo, setSelectedRepo] = useState<StarredRepo | null>(null)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)
  const [readmeViewerOpen, setReadmeViewerOpen] = useState(false)

  // Fetch starred repos from GitHub API
  const { data, error, isLoading, mutate } = useSWR<{
    repos: StarredRepo[]
    lastSynced: string
    error?: string
  }>("/api/github/starred", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })

  const repos = data?.repos || []
  const lastSynced = data?.lastSynced
    ? formatDistanceToNow(new Date(data.lastSynced), { addSuffix: true })
    : null

  // Get unique languages for filter
  const languages = useMemo(() => {
    const langs = new Set<string>()
    repos.forEach((repo) => {
      if (repo.language) langs.add(repo.language)
    })
    return Array.from(langs).sort()
  }, [repos])

  // Count uncategorized repos
  const uncategorizedCount = useMemo(() => {
    return repos.filter(
      (repo) => repo.tags.length === 0 && repo.collections.length === 0
    ).length
  }, [repos])

  // Filter and sort repos
  const filteredRepos = useMemo(() => {
    let filtered = [...repos]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (repo) =>
          repo.name.toLowerCase().includes(query) ||
          repo.owner.toLowerCase().includes(query) ||
          repo.description?.toLowerCase().includes(query) ||
          repo.notes?.toLowerCase().includes(query) ||
          repo.tags.some((tag) => tag.label.toLowerCase().includes(query))
      )
    }

    // Language filter
    if (languageFilter) {
      filtered = filtered.filter((repo) => repo.language === languageFilter)
    }

    // Collection filter
    if (selectedCollection) {
      filtered = filtered.filter((repo) => repo.collections.includes(selectedCollection))
    }

    // Tag filter
    if (selectedTag) {
      filtered = filtered.filter((repo) =>
        repo.tags.some((tag) => tag.id === selectedTag)
      )
    }

    // Sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "starred-desc":
          return new Date(b.starredAt).getTime() - new Date(a.starredAt).getTime()
        case "starred-asc":
          return new Date(a.starredAt).getTime() - new Date(b.starredAt).getTime()
        case "stars-desc":
          return b.stargazersCount - a.stargazersCount
        case "stars-asc":
          return a.stargazersCount - b.stargazersCount
        case "updated-desc":
          return new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime()
        case "name-asc":
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    // Pinned repos first
    filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return 0
    })

    return filtered
  }, [repos, searchQuery, sortBy, languageFilter, selectedCollection, selectedTag])

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

  const clearAllFilters = () => {
    setSearchQuery("")
    setLanguageFilter(null)
    setSelectedCollection(null)
    setSelectedTag(null)
  }

  const handleRefresh = () => {
    mutate()
  }

  const hasActiveFilters = searchQuery || languageFilter || selectedCollection || selectedTag

  const getActiveFilterLabel = () => {
    if (selectedCollection) {
      const collection = mockCollections.find((c) => c.id === selectedCollection)
      return collection ? `${collection.emoji} ${collection.name}` : null
    }
    if (selectedTag) {
      const tag = mockTags.find((t) => t.id === selectedTag)
      return tag ? tag.label : null
    }
    return null
  }

  return (
    <SidebarProvider>
      <AppSidebar
        collections={mockCollections}
        tags={mockTags}
        selectedCollection={selectedCollection}
        selectedTag={selectedTag}
        onSelectCollection={setSelectedCollection}
        onSelectTag={setSelectedTag}
        totalStars={repos.length}
        uncategorizedCount={uncategorizedCount}
      />
      <SidebarInset>
        <DashboardHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          languageFilter={languageFilter}
          onLanguageFilterChange={setLanguageFilter}
          languages={languages}
          lastSynced={lastSynced || "Never"}
          user={user}
          onRefresh={handleRefresh}
          isRefreshing={isLoading}
        />
        <main className="flex-1 p-6">
          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Loading your starred repositories...</p>
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

          {/* API Error (e.g., token issues) */}
          {data?.error && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-destructive">{data.error}</p>
              <p className="text-sm text-muted-foreground">
                Your GitHub token may have expired. Please sign out and sign in again.
              </p>
            </div>
          )}

          {/* Content */}
          {!isLoading && !error && !data?.error && (
            <>
              {/* Active Filters */}
              {hasActiveFilters && (
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Filters:</span>
                  {searchQuery && (
                    <Badge variant="secondary" className="gap-1">
                      Search: {searchQuery}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => setSearchQuery("")}
                      />
                    </Badge>
                  )}
                  {languageFilter && (
                    <Badge variant="secondary" className="gap-1">
                      {languageFilter}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => setLanguageFilter(null)}
                      />
                    </Badge>
                  )}
                  {(selectedCollection || selectedTag) && (
                    <Badge variant="secondary" className="gap-1">
                      {getActiveFilterLabel()}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => {
                          setSelectedCollection(null)
                          setSelectedTag(null)
                        }}
                      />
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={clearAllFilters}
                  >
                    Clear All
                  </Button>
                </div>
              )}

              {/* Results count */}
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {filteredRepos.length} {filteredRepos.length === 1 ? "repository" : "repositories"}
                </p>
              </div>

              {/* Empty State */}
              {repos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <p className="text-muted-foreground">No starred repositories found</p>
                  <p className="text-sm text-muted-foreground">
                    Star some repositories on GitHub and they will appear here!
                  </p>
                </div>
              )}

              {/* View */}
              {repos.length > 0 && (
                viewMode === "grid" ? (
                  <RepoGrid repos={filteredRepos} onRepoClick={handleRepoClick} />
                ) : (
                  <RepoList repos={filteredRepos} onRepoClick={handleRepoClick} />
                )
              )}
            </>
          )}
        </main>
      </SidebarInset>

      {/* Detail Panel */}
      <RepoDetailPanel
        repo={selectedRepo}
        open={detailPanelOpen}
        onClose={handleCloseDetail}
        onViewReadme={handleViewReadme}
        collections={mockCollections}
        tags={mockTags}
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
