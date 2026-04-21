"use client"

import { useState, useEffect, useCallback, useMemo, useRef, startTransition } from "react"
import useSWR from "swr"
import type { User } from "@supabase/supabase-js"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppPageHeader } from "@/components/app-page-header"
import { SearchHero } from "@/components/search-hero"
import { SearchResultCard } from "@/components/search-result-card"
import { SearchTrendingStrip } from "@/components/search-trending-strip"
import { SearchPersonalizedSection } from "@/components/search-personalized-section"
import { Skeleton } from "@/components/ui/skeleton"
import { useStarredRepos } from "@/lib/use-starred-repos"
import { useAIKey } from "@/lib/use-ai-key"
import { getCachedRepos } from "@/lib/repo-cache"
import type { UserMetadata } from "@/lib/types"
import type { SearchRepo } from "@/app/api/search/repos/route"
import type { PersonalizedTheme } from "@/app/api/search/personalized/route"

interface SearchPageProps {
  user: User | null
}

export function SearchPage({ user }: SearchPageProps) {
  const [searchResults, setSearchResults] = useState<SearchRepo[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasResults, setHasResults] = useState(false)
  const [personalizedThemes, setPersonalizedThemes] = useState<PersonalizedTheme[]>([])
  const [personalizedLoaded, setPersonalizedLoaded] = useState(false)
  const [isPersonalizing, setIsPersonalizing] = useState(false)
  const personalizingRef = useRef(false)

  const { getHeaders } = useAIKey()
  const { data: starData, isLoading: isLoadingStars } = useStarredRepos(user?.id)

  const { data: metadata } = useSWR<UserMetadata>(
    user?.id ? "/api/user/metadata" : null,
    (url: string) => fetch(url).then(r => r.json()),
    { revalidateOnFocus: false }
  )

  const tags = metadata?.tags ?? []
  const collections = metadata?.collections ?? []

  const uncategorizedCount = useMemo(() => {
    const repos = starData?.repos ?? []
    return repos.filter(r => r.tags.length === 0 && r.collections.length === 0).length
  }, [starData?.repos])

  // Fetch trending repos from existing data
  const trendingRepos = useMemo<SearchRepo[]>(() => {
    const repos = starData?.repos ?? []
    return repos
      .filter(r => r.isTrending)
      .slice(0, 12)
      .map(r => ({
        id: parseInt(r.id) || 0,
        fullName: r.fullName,
        name: r.name,
        owner: r.owner,
        avatarUrl: r.avatarUrl,
        description: r.description,
        stargazersCount: r.stargazersCount,
        forksCount: r.forksCount,
        language: r.language,
        topics: r.topics,
        pushedAt: r.pushedAt,
        htmlUrl: `https://github.com/${r.fullName}`,
        evidence: [],
        relevanceScore: 0,
      }))
  }, [starData?.repos])

  // Load personalized section once starred repos are available.
  useEffect(() => {
    if (!user?.id || personalizedLoaded || personalizingRef.current) return

    const cached = getCachedRepos(user.id)
    const repos = starData?.repos.length ? starData.repos : cached?.repos
    if (!repos?.length) return

    const sample = repos.slice(0, 100).map(r => ({
      name: r.name,
      description: r.description ?? "",
      language: r.language,
      topics: r.topics,
    }))

    personalizingRef.current = true
    startTransition(() => setIsPersonalizing(true))

    fetch("/api/search/personalized", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getHeaders() },
      body: JSON.stringify({ repos: sample }),
    })
      .then(async r => {
        const data = await r.json()
        if (!r.ok) {
          console.error('[personalized] API error:', data)
          return
        }
        if (Array.isArray(data.themes) && data.themes.length > 0) {
          setPersonalizedThemes(data.themes)
        }
      })
      .catch(err => console.error('[personalized] fetch error:', err))
      .finally(() => {
        setPersonalizedLoaded(true)
        setIsPersonalizing(false)
      })
  }, [getHeaders, personalizedLoaded, starData?.repos, user?.id])

  const handleSearch = useCallback(async (query: string) => {
    setIsSearching(true)
    setHasResults(false)
    try {
      const res = await fetch("/api/search/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getHeaders() },
        body: JSON.stringify({ query }),
      })
      const data = await res.json()
      if (data.repos) {
        setSearchResults(data.repos)
        setHasResults(true)
      }
    } catch {
      // fail silently
    } finally {
      setIsSearching(false)
    }
  }, [getHeaders])

  const handleClear = useCallback(() => {
    setSearchResults([])
    setHasResults(false)
  }, [])

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
        totalStars={starData?.repos.length ?? 0}
        uncategorizedCount={uncategorizedCount}
        userId={user?.id}
        onAICategorize={() => {}}
        onCreateCollection={async () => {}}
        onCreateTag={async () => {}}
      />
      <SidebarInset>
        <AppPageHeader
          user={user}
          lastSynced={null}
          hideNavActions
        />

        <div className="flex-1 flex flex-col min-h-0">
          <SearchHero
            onSearch={handleSearch}
            isLoading={isSearching}
            hasResults={hasResults}
            onClear={handleClear}
          />

          <div className="flex-1 px-6 pb-8">
            {/* Search results */}
            {hasResults && (
              <div className="mt-6 space-y-4">
                <p className="text-xs text-muted-foreground">
                  {searchResults.length} repos found
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {searchResults.map(repo => (
                    <SearchResultCard
                      key={repo.id}
                      repo={repo}
                      tags={tags}
                      collections={collections}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Loading state */}
            {isSearching && (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-56 rounded-lg" />
                ))}
              </div>
            )}

            {/* Initial load: trending + personalized */}
            {!hasResults && !isSearching && (
              <div className="mt-6 space-y-10">
                {trendingRepos.length > 0 && (
                  <SearchTrendingStrip
                    repos={trendingRepos}
                    tags={tags}
                    collections={collections}
                  />
                )}

                <SearchPersonalizedSection
                  themes={personalizedThemes}
                  isLoading={isPersonalizing || isLoadingStars || (!personalizedLoaded && Boolean(starData?.repos.length))}
                  hasRepoSource={Boolean(starData?.repos.length)}
                  tags={tags}
                  collections={collections}
                />
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
