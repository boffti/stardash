"use client"

import { useState, useEffect, useCallback, useMemo, useRef, startTransition } from "react"
import useSWR from "swr"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppPageHeader } from "@/components/app-page-header"
import { SearchHero, type SearchScope } from "@/components/search-hero"
import { SearchPipelineTimeline } from "@/components/search-pipeline-timeline"
import { SearchResultCard } from "@/components/search-result-card"
import { SearchTrendingStrip } from "@/components/search-trending-strip"
import { SearchPersonalizedSection } from "@/components/search-personalized-section"
import { SearchSavedSection } from "@/components/search-saved-section"
import { Skeleton } from "@/components/ui/skeleton"
import { useStarredRepos } from "@/lib/use-starred-repos"
import { useAIKey } from "@/lib/use-ai-key"
import { getCachedRepos } from "@/lib/repo-cache"
import {
  buildPersonalizedSearchRepoSignature,
  getCachedPersonalizedSearch,
  setCachedPersonalizedSearch,
} from "@/lib/search-cache"
import type { DiscoverSavedSearch } from "@/lib/search-cache"
import type { UserMetadata } from "@/lib/types"
import type { SearchPipelineEvent, SearchRepo } from "@/app/api/search/repos/route"
import type { PersonalizedTheme } from "@/app/api/search/personalized/route"
import { useI18n } from "@/components/i18n-provider"
import { useUser } from "@/components/providers/user-provider"
import { toast } from "sonner"

export function SearchPage() {
  const { user } = useUser()
  const { t } = useI18n()
  const [query, setQuery] = useState("")
  const [scope, setScope] = useState<SearchScope>("stars")
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<SearchRepo[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasResults, setHasResults] = useState(false)
  const [pipelineEvents, setPipelineEvents] = useState<SearchPipelineEvent[]>([])
  const [personalizedThemes, setPersonalizedThemes] = useState<PersonalizedTheme[]>([])
  const [personalizedLoaded, setPersonalizedLoaded] = useState(false)
  const [isPersonalizing, setIsPersonalizing] = useState(false)
  const [personalizedNextAt, setPersonalizedNextAt] = useState<string | null>(null)
  const [personalizedError, setPersonalizedError] = useState<string | null>(null)
  const personalizingRef = useRef(false)
  const searchRunRef = useRef(0)

  const { getHeaders } = useAIKey()
  const { data: starData, error: starsError, isLoading: isLoadingStars } = useStarredRepos(user?.id)
  const starsPending = !starData && !starsError

  const { data: metadata, error: metadataError } = useSWR<UserMetadata>(
    user?.id ? "/api/user/metadata" : null,
    async (url: string) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error("Failed to load metadata")
      return response.json()
    },
    { revalidateOnFocus: false },
  )
  const localSearchPending = starsPending || (Boolean(user?.id) && !metadata && !metadataError)

  const {
    data: savedSearchData,
    mutate: mutateSavedSearches,
    isLoading: isLoadingSavedSearches,
  } = useSWR<{ searches: DiscoverSavedSearch[] }>(
    user?.id ? "/api/search/saved" : null,
    (url: string) => fetch(url).then((r) => r.json()),
    { revalidateOnFocus: false },
  )

  const tags = metadata?.tags ?? []
  const collections = metadata?.collections ?? []
  const savedSearches = savedSearchData?.searches ?? []
  const starredNames = useMemo(
    () => new Set((starData?.repos ?? []).map((repo) => repo.fullName.toLowerCase())),
    [starData?.repos],
  )

  const uncategorizedCount = useMemo(() => {
    const repos = starData?.repos ?? []
    return repos.filter((r) => r.tags.length === 0 && r.collections.length === 0).length
  }, [starData?.repos])

  // Fetch trending repos from existing data
  const trendingRepos = useMemo<SearchRepo[]>(() => {
    const repos = starData?.repos ?? []
    return repos
      .filter((r) => r.isTrending)
      .slice(0, 12)
      .map((r) => ({
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
    if (scope !== "ai" || !user?.id || personalizedLoaded || personalizingRef.current) return

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

    const sample = repos.slice(0, 100).map((r) => ({
      name: r.name,
      description: r.description ?? "",
      language: r.language,
      topics: r.topics,
    }))

    personalizingRef.current = true
    startTransition(() => setIsPersonalizing(true))

    // Build an array of numeric GitHub repo IDs so the server can filter
    // already-starred repos from personalized discovery results.
    const starredIds = repos.map((r) => parseInt(r.id, 10)).filter((id) => !isNaN(id))

    fetch("/api/search/personalized", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getHeaders() },
      body: JSON.stringify({ repos: sample, starredIds }),
    })
      .then(async (r) => {
        const data = await r.json()
        if (r.status === 429) {
          setPersonalizedNextAt(data.nextAllowedAt ?? null)
          return
        }
        if (!r.ok) {
          const message =
            typeof data?.error === "string" && data.error.trim()
              ? data.error
              : t("Personalized search failed", "个性化搜索失败")
          console.error("[personalized] API error:", r.status, message)
          setPersonalizedError(message)
          toast.error(message)
          return
        }
        setPersonalizedError(null)
        if (Array.isArray(data.themes) && data.themes.length > 0) {
          setCachedPersonalizedSearch(user.id, repoSignature, data.themes)
          setPersonalizedThemes(data.themes)
        }
      })
      .catch((err) => console.error("[personalized] fetch error:", err))
      .finally(() => {
        setPersonalizedLoaded(true)
        setIsPersonalizing(false)
      })
  }, [getHeaders, personalizedLoaded, starData?.repos, t, user?.id, scope])

  const handleSearch = useCallback(
    async (query: string, selectedScope: SearchScope = scope, updateUrl = true) => {
      const searchRunId = searchRunRef.current + 1
      searchRunRef.current = searchRunId
      setQuery(query)
      setScope(selectedScope)
      setSearchError(null)
      if (updateUrl) {
        const params = new URLSearchParams(window.location.search)
        params.set("q", query)
        params.set("scope", selectedScope)
        window.history.pushState(null, "", `${window.location.pathname}?${params}`)
      }
      setIsSearching(true)
      setHasResults(false)
      setSearchResults([])
      setPipelineEvents([])

      if (selectedScope === "stars") {
        if (localSearchPending) return
        if (starsError && !starData) {
          setSearchError(
            t("Could not load your stars. Try syncing again.", "无法加载收藏，请重试同步。"),
          )
          setIsSearching(false)
          return
        }
        if (metadataError) {
          setSearchError(t("Notes and tags could not be loaded.", "无法加载笔记和标签。"))
        }
        const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean)
        const repos = (starData?.repos ?? [])
          .filter((repo) => {
            const repoMeta = metadata?.repoMeta[repo.id]
            const tagLabels = repoMeta
              ? (metadata?.tags ?? [])
                  .filter((tag) => repoMeta.tagIds.includes(tag.id))
                  .map((tag) => tag.label)
              : repo.tags.map((tag) => tag.label)
            const collectionNames = repoMeta
              ? (metadata?.collections ?? [])
                  .filter((collection) => repoMeta.collectionIds.includes(collection.id))
                  .map((collection) => collection.name)
              : repo.collections
            const text = [
              repo.fullName,
              repo.description,
              repo.language,
              ...repo.topics,
              ...tagLabels,
              ...collectionNames,
              repoMeta?.notes ?? repo.notes,
            ]
              .join(" ")
              .toLocaleLowerCase()
            return terms.every((term) => text.includes(term))
          })
          .map((repo) => ({
            id: Number(repo.id),
            fullName: repo.fullName,
            name: repo.name,
            owner: repo.owner,
            avatarUrl: repo.avatarUrl,
            description: repo.description,
            stargazersCount: repo.stargazersCount,
            forksCount: repo.forksCount,
            language: repo.language,
            topics: repo.topics,
            pushedAt: repo.pushedAt,
            htmlUrl: `https://github.com/${repo.fullName}`,
            evidence: [],
            relevanceScore: 0,
          }))
        setSearchResults(repos)
        setHasResults(true)
        setIsSearching(false)
        return
      }

      const applyPipelineEvent = (event: SearchPipelineEvent) => {
        if (searchRunRef.current !== searchRunId) return
        setPipelineEvents((prev) => [...prev, event])
        if (event.type === "result") {
          setSearchResults(event.repos)
          setHasResults(true)
        }
        if (event.type === "error") {
          setSearchError(t("Search failed. Try again.", "搜索失败，请重试。"))
        }
      }

      // Send a minimal star-data snapshot so the server can derive user context
      // and a context hash. Only include fields the server actually reads —
      // private user metadata (notes, tags, collections, isPinned) is omitted.
      const starDataSnapshot = (starData?.repos ?? []).slice(0, 200).map((r) => ({
        id: r.id,
        owner: r.owner,
        name: r.name,
        fullName: r.fullName,
        description: r.description ?? "",
        language: r.language,
        topics: r.topics,
        stargazersCount: r.stargazersCount,
        forksCount: r.forksCount,
        pushedAt: r.pushedAt,
        starredAt: r.starredAt,
        avatarUrl: r.avatarUrl,
        status: r.status,
        isPinned: false,
        notes: "",
        tags: [],
        collections: [],
        readme: null,
        languageColor: null,
        homepage: null,
        license: null,
        openIssuesCount: 0,
      }))

      try {
        const res = await fetch("/api/search/repos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(selectedScope === "ai"
              ? { Accept: "application/x-ndjson", "x-search-pipeline": "stream" }
              : {}),
            ...(selectedScope === "ai" ? getHeaders() : {}),
          },
          body: JSON.stringify({ query, starData: starDataSnapshot, mode: selectedScope }),
        })
        if (searchRunRef.current !== searchRunId) return
        if (!res.ok) {
          if (res.status === 503 && selectedScope === "ai") {
            setSearchError(
              t(
                "Configure an AI provider in Settings, or search without AI.",
                "请在设置中配置 AI 服务，或使用普通搜索。",
              ),
            )
          } else {
            setSearchError(
              res.status === 429
                ? t("Search limit reached. Try again later.", "搜索次数已达上限，请稍后重试。")
                : t("Search failed. Try again.", "搜索失败，请重试。"),
            )
          }
          return
        }

        if (selectedScope === "github" || !res.body) {
          const data = await res.json()
          if (searchRunRef.current !== searchRunId) return
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
          setSearchError(t("Search failed. Try again.", "搜索失败，请重试。"))
          setPipelineEvents((prev) => [
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
          mutateSavedSearches()
        }
      }
    },
    [
      getHeaders,
      mutateSavedSearches,
      scope,
      starData,
      starsError,
      localSearchPending,
      metadata,
      metadataError,
      t,
    ],
  )

  const handleToggleSavedSearch = useCallback(
    async (search: DiscoverSavedSearch) => {
      await fetch(`/api/search/saved/${search.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSaved: !search.isSaved }),
      })
      mutateSavedSearches()
    },
    [mutateSavedSearches],
  )

  const handleDeleteSavedSearch = useCallback(
    async (search: DiscoverSavedSearch) => {
      await fetch(`/api/search/saved/${search.id}`, { method: "DELETE" })
      mutateSavedSearches()
    },
    [mutateSavedSearches],
  )

  const handleClear = useCallback(() => {
    searchRunRef.current += 1
    setQuery("")
    setSearchError(null)
    const params = new URLSearchParams(window.location.search)
    params.delete("q")
    params.set("scope", scope)
    window.history.pushState(null, "", `${window.location.pathname}?${params}`)
    setSearchResults([])
    setPipelineEvents([])
    setHasResults(false)
    setIsSearching(false)
  }, [scope])

  const handleSearchRef = useRef(handleSearch)
  handleSearchRef.current = handleSearch

  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search)
      const value = params.get("scope")
      const restoredScope: SearchScope = value === "github" || value === "ai" ? value : "stars"
      const restoredQuery = params.get("q") ?? ""
      setScope(restoredScope)
      setQuery(restoredQuery)
      if (restoredQuery && (restoredScope !== "stars" || !localSearchPending)) {
        void handleSearchRef.current(restoredQuery, restoredScope, false)
      } else if (!restoredQuery) {
        searchRunRef.current += 1
        setHasResults(false)
        setSearchResults([])
        setPipelineEvents([])
        setIsSearching(false)
      }
    }
    restore()
    window.addEventListener("popstate", restore)
    return () => window.removeEventListener("popstate", restore)
  }, [localSearchPending]) // Restore on navigation and once local stars have loaded.

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
        <AppPageHeader lastSynced={null} hideNavActions />

        <div className="flex-1 flex flex-col min-h-0">
          <SearchHero
            query={query}
            scope={scope}
            onQueryChange={setQuery}
            onScopeChange={(next) => {
              setScope(next)
              if (query.trim()) void handleSearch(query.trim(), next)
              else {
                const params = new URLSearchParams(window.location.search)
                params.set("scope", next)
                window.history.pushState(null, "", `${window.location.pathname}?${params}`)
              }
            }}
            onSearch={handleSearch}
            isLoading={isSearching || (scope === "stars" && localSearchPending)}
            hasResults={hasResults}
            onClear={handleClear}
          />

          <div className="flex-1 px-6 pb-8">
            {scope === "ai" && hasPipelineFeedback && (
              <SearchPipelineTimeline
                events={pipelineEvents}
                isSearching={isSearching}
                className="mt-6"
              />
            )}

            {searchError && (
              <p role="alert" className="mt-6 text-sm text-destructive">
                {searchError}
              </p>
            )}

            {/* Search results */}
            {hasResults && (
              <div className="mt-6 space-y-4">
                <p className="text-xs text-muted-foreground">
                  {searchResults.length === 0
                    ? t("No repositories found.", "没有找到仓库。")
                    : t(
                        `${searchResults.length} repositories found`,
                        `找到 ${searchResults.length} 个仓库`,
                      )}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {searchResults.map((repo) => (
                    <SearchResultCard
                      key={repo.id}
                      repo={repo}
                      starred={starredNames.has(repo.fullName.toLowerCase())}
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
                <SearchSavedSection
                  searches={savedSearches}
                  isLoading={isLoadingSavedSearches}
                  onSearch={(savedQuery) => void handleSearch(savedQuery, "ai")}
                  onToggleSaved={handleToggleSavedSearch}
                  onDelete={handleDeleteSavedSearch}
                />

                {trendingRepos.length > 0 && (
                  <SearchTrendingStrip
                    repos={trendingRepos}
                    tags={tags}
                    collections={collections}
                  />
                )}

                {scope === "ai" && (
                  <SearchPersonalizedSection
                    themes={personalizedThemes}
                    nextAllowedAt={personalizedNextAt}
                    error={personalizedError}
                    isLoading={
                      isPersonalizing ||
                      isLoadingStars ||
                      (!personalizedLoaded && Boolean(starData?.repos.length))
                    }
                    hasRepoSource={Boolean(starData?.repos.length)}
                    tags={tags}
                    collections={collections}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
