"use client"

import { useState, useEffect, useCallback, useMemo, useRef, startTransition } from "react"
import useSWR from "swr"
import type { User } from "@supabase/supabase-js"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppPageHeader } from "@/components/app-page-header"
import { SearchHero } from "@/components/search-hero"
import { SearchPipelineTimeline } from "@/components/search-pipeline-timeline"
import { SearchResultCard } from "@/components/search-result-card"
import { SearchTrendingStrip } from "@/components/search-trending-strip"
import { SearchPersonalizedSection } from "@/components/search-personalized-section"
import { Skeleton } from "@/components/ui/skeleton"
import { useStarredRepos } from "@/lib/use-starred-repos"
import { useAIKey } from "@/lib/use-ai-key"
import { getCachedRepos } from "@/lib/repo-cache"
import {
  buildPersonalizedSearchRepoSignature,
  getCachedPersonalizedSearch,
  setCachedPersonalizedSearch,
} from "@/lib/search-cache"
import type { UserMetadata } from "@/lib/types"
import type { SearchPipelineEvent, SearchRepo } from "@/app/api/search/repos/route"
import type { PersonalizedTheme } from "@/app/api/search/personalized/route"

interface SearchPageProps {
  user: User | null
}

export function SearchPage({ user }: SearchPageProps) {
  const [searchResults, setSearchResults] = useState<SearchRepo[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasResults, setHasResults] = useState(false)
  const [pipelineEvents, setPipelineEvents] = useState<SearchPipelineEvent[]>([])
  const [personalizedThemes, setPersonalizedThemes] = useState<PersonalizedTheme[]>([])
  const [personalizedLoaded, setPersonalizedLoaded] = useState(false)
  const [isPersonalizing, setIsPersonalizing] = useState(false)
  const personalizingRef = useRef(false)
  const searchRunRef = useRef(0)

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

    const repoSignature = buildPersonalizedSearchRepoSignature(repos)
    const cachedPersonalized = getCachedPersonalizedSearch(user.id, repoSignature)
    if (cachedPersonalized?.themes.length) {
      personalizingRef.current = true
      startTransition(() => {
        setPersonalizedThemes(cachedPersonalized.themes)
        setPersonalizedLoaded(true)
      })
      return
    }

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
          setCachedPersonalizedSearch(user.id, repoSignature, data.themes)
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
    const searchRunId = searchRunRef.current + 1
    searchRunRef.current = searchRunId
    setIsSearching(true)
    setHasResults(false)
    setSearchResults([])
    setPipelineEvents([])

    const applyPipelineEvent = (event: SearchPipelineEvent) => {
      if (searchRunRef.current !== searchRunId) return
      setPipelineEvents(prev => [...prev, event])
      if (event.type === "result") {
        setSearchResults(event.repos)
        setHasResults(true)
      }
      if (event.type === "error") {
        console.error("[search] pipeline error:", event.error)
      }
    }

    try {
      const res = await fetch("/api/search/repos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
          "x-search-pipeline": "stream",
          ...getHeaders(),
        },
        body: JSON.stringify({ query }),
      })
      if (!res.ok) {
        const data = await res.json()
        console.error('[search] API error:', data)
        return
      }

      if (!res.body) {
        const data = await res.json()
        if (data.repos) {
          setSearchResults(data.repos)
          setHasResults(true)
        }
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.trim()) continue
          applyPipelineEvent(JSON.parse(line) as SearchPipelineEvent)
        }
      }

      buffer += decoder.decode()
      if (buffer.trim()) {
        applyPipelineEvent(JSON.parse(buffer) as SearchPipelineEvent)
      }
    } catch (err) {
      if (searchRunRef.current === searchRunId) {
        console.error('[search] fetch error:', err)
        setPipelineEvents(prev => [
          ...prev,
          {
            type: "error",
            error: err instanceof Error ? err.message : "Search failed",
            elapsedMs: 0,
          },
        ])
      }
    } finally {
      if (searchRunRef.current === searchRunId) {
        setIsSearching(false)
      }
    }
  }, [getHeaders])

  const handleClear = useCallback(() => {
    searchRunRef.current += 1
    setSearchResults([])
    setPipelineEvents([])
    setHasResults(false)
    setIsSearching(false)
  }, [])

  const hasPipelineFeedback = isSearching || pipelineEvents.length > 0

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
            {hasPipelineFeedback && (
              <SearchPipelineTimeline
                events={pipelineEvents}
                isSearching={isSearching}
                className="mt-6"
              />
            )}

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
            {isSearching && !hasResults && (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-56 rounded-lg" />
                ))}
              </div>
            )}

            {/* Initial load: trending + personalized */}
            {!hasResults && !isSearching && pipelineEvents.length === 0 && (
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
