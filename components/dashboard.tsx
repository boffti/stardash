"use client"

import { useState, useMemo, useEffect } from "react"
import useSWR from "swr"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { DashboardCommandPalette } from "./dashboard-command-palette"
import { DashboardHeader } from "./dashboard-header"
import { RepoGrid } from "./repo-grid"
import { RepoList } from "./repo-list"
import { RepoDetailPanel } from "./repo-detail-panel"
import { ReadmeViewer } from "./readme-viewer"
import { ProactiveAlerts } from "./proactive-alerts"
import type { User } from "@supabase/supabase-js"
import { Badge } from "@/components/ui/badge"
import { X, Loader2, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, Sparkles, LayoutGrid, List, StarOff, LogOut, LogIn, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatDistanceToNow } from "date-fns"
import { getCachedRepos, setCachedRepos } from "@/lib/repo-cache"
import type { CategorizationResult, UserMetadata, RepoStatus, StarredRepo, Collection, Tag } from "@/lib/types"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { TokenExpiredBanner } from "@/components/token-expired-banner"
import { useStarredRepos } from "@/lib/use-starred-repos"
import { useAIKey } from "@/lib/use-ai-key"
import { trackRecentlyViewedRepo } from "@/lib/recently-viewed"
import { isDormantRepo, type RepoHealthFilter } from "@/lib/repo-health"
import {
  updateRepoStatus, updateRepoNotes, togglePin,
  createTag, assignTag, removeTag,
  createCollection, assignCollection, removeCollection,
  pickTagColor,
} from "@/lib/user-metadata"
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core"

interface DashboardProps {
  user: User | null
}

const VIEW_MODE_KEY = "stardash_view_mode"
const MAX_HEALTH_REPOS_PER_VIEW = 50

export function Dashboard({ user }: DashboardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("starred-desc")
  const [viewMode, setViewModeState] = useState<"grid" | "list">("grid")

  // Load view mode from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(VIEW_MODE_KEY)
    if (stored === "list" || stored === "grid") {
      setViewModeState(stored)
    }
  }, [])

  const setViewMode = (value: "grid" | "list") => {
    setViewModeState(value)
    localStorage.setItem(VIEW_MODE_KEY, value)
  }
  const [languageFilter, setLanguageFilter] = useState<string | null>(null)
  const [healthFilter, setHealthFilter] = useState<RepoHealthFilter | null>(null)
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [showUncategorized, setShowUncategorized] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState<StarredRepo | null>(null)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)
  const [readmeViewerOpen, setReadmeViewerOpen] = useState(false)
  const [pageSize, setPageSize] = useState<number | "all">(24)
  const [currentPage, setCurrentPage] = useState(1)
  const [categorization, setCategorization] = useState<CategorizationResult | null>(null)
  const [isCategorizing, setIsCategorizing] = useState(false)
  const [categorizeLimit, setCategorizeLimit] = useState<{ remaining: number | null; nextAllowedAt: string | null }>({ remaining: null, nextAllowedAt: null })
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [repoToRemove, setRepoToRemove] = useState<StarredRepo | null>(null)

  const { getHeaders } = useAIKey()
  const supabase = createClient()
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } })
  )

  // Fetch user metadata (tags, collections, repo assignments) from Supabase
  const { data: metadata, mutate: mutateMetadata } = useSWR<UserMetadata>(
    user?.id ? '/api/user/metadata' : null,
    (url: string) => fetch(url).then(r => r.json()),
    { revalidateOnFocus: false }
  )

  // Fetch starred repos — checks localStorage cache before hitting GitHub API
  const { data, error, isLoading, isRefreshing, mutate, refresh } = useStarredRepos(user?.id)

  const rawRepos = data?.repos || []
  const hasRepoData = Boolean(data)
  const lastSynced = data?.lastSynced
    ? (data.fromCache ? "Cached " : "Synced ") + formatDistanceToNow(new Date(data.lastSynced), { addSuffix: true })
    : null

  // Merge DB metadata + AI categorization over raw GitHub data. DB wins.
  const repos = useMemo(() => {
    return rawRepos.map(repo => {
      const dbMeta = metadata?.repoMeta[repo.id]

      let mergedRepo = repo

      if (dbMeta) {
        const dbTags = (metadata?.tags ?? []).filter(t => dbMeta.tagIds.includes(t.id))
        mergedRepo = {
          ...mergedRepo,
          status: dbMeta.status ?? repo.status,
          isPinned: dbMeta.isPinned,
          notes: dbMeta.notes ?? repo.notes,
          tags: dbTags,
          collections: dbMeta.collectionIds,
        }
      }

      // Fall back to AI categorization for repos not yet touched by user
      if (categorization) {
        mergedRepo = {
          ...mergedRepo,
          tags: mergedRepo.tags.length > 0 ? mergedRepo.tags : (categorization.repoTags[repo.id] ?? repo.tags),
          collections: mergedRepo.collections.length > 0 ? mergedRepo.collections : (categorization.repoCollections[repo.id] ?? repo.collections),
        }
      }

      return mergedRepo
    })
  }, [rawRepos, metadata, categorization])

  const collections = useMemo(() => {
    const dbCollections = metadata?.collections ?? []
    const aiCollections = categorization?.collections ?? []
    const merged = new Map<string, Collection>()
    aiCollections.forEach(c => merged.set(c.name.toLowerCase(), c))
    dbCollections.forEach(c => merged.set(c.name.toLowerCase(), c))
    const allCollections = Array.from(merged.values())
    const dbIds = new Set(dbCollections.map(c => c.id))
    // Compute repoCount from actual repos (reflects live starred list, not stale DB count)
    const countById = new Map<string, number>()
    for (const repo of repos) {
      for (const cid of (repo.collections ?? [])) {
        countById.set(cid, (countById.get(cid) ?? 0) + 1)
      }
    }
    return allCollections
      .map(c => ({ ...c, repoCount: countById.get(c.id) ?? 0 }))
      .sort((a, b) => {
        const aIsDb = dbIds.has(a.id)
        const bIsDb = dbIds.has(b.id)
        if (aIsDb && !bIsDb) return -1
        if (!aIsDb && bIsDb) return 1
        return a.name.localeCompare(b.name)
      })
  }, [metadata?.collections, categorization?.collections, repos])

  const allTags = useMemo(() => {
    const dbTags = metadata?.tags ?? []
    const aiTags = categorization?.allTags ?? []
    const merged = new Map<string, Tag>()
    aiTags.forEach(t => merged.set(t.label.toLowerCase(), t))
    dbTags.forEach(t => merged.set(t.label.toLowerCase(), t))
    const all = Array.from(merged.values())
    const dbIds = new Set(dbTags.map(t => t.id))
    return all.sort((a, b) => {
      const aIsDb = dbIds.has(a.id)
      const bIsDb = dbIds.has(b.id)
      if (aIsDb && !bIsDb) return -1
      if (!aIsDb && bIsDb) return 1
      return a.label.localeCompare(b.label)
    })
  }, [metadata?.tags, categorization?.allTags])

  useEffect(() => {
    const collectionFromUrl = searchParams.get("collection")
    const tagFromUrl = searchParams.get("tag")
    const uncategorizedFromUrl = searchParams.get("uncategorized") === "true"

    setSelectedCollection(collectionFromUrl)
    setSelectedTag(tagFromUrl)
    setShowUncategorized(uncategorizedFromUrl)
  }, [searchParams])

  const replaceDashboardFilterUrl = (filters: {
    collectionId?: string | null
    tagId?: string | null
    uncategorized?: boolean
  }) => {
    const params = new URLSearchParams(searchParams.toString())

    if (filters.collectionId) params.set("collection", filters.collectionId)
    else params.delete("collection")

    if (filters.tagId) params.set("tag", filters.tagId)
    else params.delete("tag")

    if (filters.uncategorized) params.set("uncategorized", "true")
    else params.delete("uncategorized")

    const nextQuery = params.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
  }

  const handleSelectCollection = (collectionId: string | null) => {
    setSelectedCollection(collectionId)
    setSelectedTag(null)
    setShowUncategorized(false)
    replaceDashboardFilterUrl({ collectionId, tagId: null, uncategorized: false })
  }

  const handleSelectTag = (tagId: string | null) => {
    setSelectedCollection(null)
    setSelectedTag(tagId)
    setShowUncategorized(false)
    replaceDashboardFilterUrl({ collectionId: null, tagId, uncategorized: false })
  }

  const handleShowUncategorized = (show: boolean) => {
    setSelectedCollection(null)
    setSelectedTag(null)
    setShowUncategorized(show)
    replaceDashboardFilterUrl({ collectionId: null, tagId: null, uncategorized: show })
  }

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

    // Health filter
    if (healthFilter === "archived") {
      filtered = filtered.filter((repo) => Boolean(repo.archived))
    } else if (healthFilter === "dormant") {
      filtered = filtered.filter((repo) => isDormantRepo(repo.pushedAt))
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

    // Uncategorized filter
    if (showUncategorized) {
      filtered = filtered.filter((repo) => repo.tags.length === 0 && repo.collections.length === 0)
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
  }, [repos, searchQuery, sortBy, languageFilter, healthFilter, selectedCollection, selectedTag, showUncategorized])

  // Reset to page 1 when filters/sort change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, sortBy, languageFilter, healthFilter, selectedCollection, selectedTag, showUncategorized])

  // Reset to page 1 when page size changes
  useEffect(() => {
    setCurrentPage(1)
  }, [pageSize])

  // Pagination calculations
  const totalPages = pageSize === "all" ? 1 : Math.ceil(filteredRepos.length / (pageSize as number))
  const startIndex = pageSize === "all" ? 0 : (currentPage - 1) * (pageSize as number)
  const endIndex = pageSize === "all" ? filteredRepos.length : Math.min(startIndex + (pageSize as number), filteredRepos.length)
  const paginatedRepos = pageSize === "all" ? filteredRepos : filteredRepos.slice(startIndex, endIndex)

  // Fetch repo health data only for the currently visible slice to avoid hammering GitHub.
  const repoIdsForHealth = useMemo(() => {
    const ids = paginatedRepos.map((repo) => repo.id)
    if (selectedRepo?.id) {
      ids.unshift(selectedRepo.id)
    }
    return Array.from(new Set(ids)).slice(0, MAX_HEALTH_REPOS_PER_VIEW)
  }, [paginatedRepos, selectedRepo?.id])

  // Batch health requests in chunks of 50 to avoid long URLs
  const { data: healthData } = useSWR<Record<string, { isTrending: boolean; latestRelease: StarredRepo['latestRelease'] }>>(
    repoIdsForHealth.length > 0 ? ['health', repoIdsForHealth] : null,
    async () => {
      const batchSize = 50
      const batches = []
      for (let i = 0; i < repoIdsForHealth.length; i += batchSize) {
        const batch = repoIdsForHealth.slice(i, i + batchSize)
        batches.push(batch)
      }

      const results = await Promise.all(
        batches.map(async (batch) => {
          const url = `/api/github/health?repoIds=${batch.join(',')}`
          const res = await fetch(url)
          if (!res.ok) return {}
          return res.json()
        })
      )

      return results.reduce((acc, batch) => ({ ...acc, ...batch }), {})
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
      dedupingInterval: 60 * 1000,
    }
  )

  const paginatedReposWithHealth = useMemo(() => {
    return paginatedRepos.map((repo) => {
      const health = healthData?.[repo.id]
      if (!health) return repo

      return {
        ...repo,
        isTrending: health.isTrending,
        latestRelease: health.latestRelease,
      }
    })
  }, [paginatedRepos, healthData])

  const selectedRepoWithHealth = useMemo(() => {
    if (!selectedRepo) return null

    const health = healthData?.[selectedRepo.id]
    if (!health) return selectedRepo

    return {
      ...selectedRepo,
      isTrending: health.isTrending,
      latestRelease: health.latestRelease,
    }
  }, [selectedRepo, healthData])

  const getPageNumbers = (current: number, total: number): (number | "ellipsis")[] => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    if (current <= 4) return [1, 2, 3, 4, 5, "ellipsis", total]
    if (current >= total - 3) return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total]
    return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total]
  }

  const handleRepoClick = (repo: StarredRepo) => {
    if (user?.id) {
      trackRecentlyViewedRepo(user.id, repo, "dashboard")
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

  const clearAllFilters = () => {
    setSearchQuery("")
    setLanguageFilter(null)
    setHealthFilter(null)
    handleSelectCollection(null)
  }

  const handleRefresh = async (triggerSource: string = "dashboard-navbar-refresh") => {
    await refresh({
      manual: true,
      triggerKind: "user",
      triggerSource,
      triggerContext: "dashboard",
    })
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleReconnect = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const isTokenExpired = Boolean(
    error?.message?.includes('token') ||
    error?.message?.includes('expired') ||
    error?.message?.includes('re-authenticate') ||
    data?.error
  )

  const handleCategorize = async () => {
    if (!rawRepos.length) return
    setIsCategorizing(true)
    try {
      const response = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ repos: rawRepos }),
      })
      if (response.status === 429) {
        const result = await response.json()
        setCategorizeLimit({ remaining: 0, nextAllowedAt: result.nextAllowedAt ?? null })
        toast.error(result.error ?? 'AI categorization limit reached')
        return
      }
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to categorize')
      const categorizationResult = result as CategorizationResult
      setCategorization(categorizationResult)
      if (user?.id) localStorage.removeItem(`stardash_categorization_${user.id}`)
      await mutateMetadata()
      const categorizedRepoCount = categorizationResult.categorizedRepoCount ?? Object.keys(categorizationResult.repoTags).length
      if (categorizedRepoCount === 0) {
        toast.info('No new starred repos to categorize')
      } else {
        toast.success(`Categorized ${categorizedRepoCount} ${categorizedRepoCount === 1 ? 'repo' : 'repos'}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to categorize repositories')
    } finally {
      setIsCategorizing(false)
    }
  }

  // Helper: build repoMeta entry preserving existing data
  const buildRepoMetaEntry = (
    prev: UserMetadata | undefined,
    repoId: string,
    dbId: string,
    overrides: Partial<{
      status: RepoStatus | null
      isPinned: boolean
      notes: string | null
      tagIds: string[]
      collectionIds: string[]
    }> = {}
  ): UserMetadata => ({
    tags: prev?.tags ?? [],
    collections: prev?.collections ?? [],
    repoMeta: {
      ...(prev?.repoMeta ?? {}),
      [repoId]: {
        dbId,
        status: overrides.status ?? prev?.repoMeta?.[repoId]?.status ?? null,
        isPinned: overrides.isPinned ?? prev?.repoMeta?.[repoId]?.isPinned ?? false,
        notes: overrides.notes ?? prev?.repoMeta?.[repoId]?.notes ?? null,
        tagIds: overrides.tagIds ?? prev?.repoMeta?.[repoId]?.tagIds ?? [],
        collectionIds: overrides.collectionIds ?? prev?.repoMeta?.[repoId]?.collectionIds ?? [],
      },
    },
  })

  // Helper: get DB UUID for a repo, upserting if needed
  const getDbId = async (repo: StarredRepo): Promise<string> => {
    const existing = metadata?.repoMeta[repo.id]?.dbId
    if (existing) return existing

    const response = await fetch(`/api/user/repo-id?githubRepoId=${repo.id}`)
    if (!response.ok) {
      throw new Error('Repo metadata missing. Refresh your stars and try again.')
    }

    const payload = await response.json()
    const dbId = payload.dbId as string
    mutateMetadata(prev => buildRepoMetaEntry(prev, repo.id, dbId), { revalidate: false })
    return dbId
  }

  const handleStatusChange = async (repo: StarredRepo, status: RepoStatus | null) => {
    try {
      const dbId = await getDbId(repo)
      mutateMetadata(prev => buildRepoMetaEntry(prev, repo.id, dbId, { status }), { revalidate: false })
      await updateRepoStatus(supabase, dbId, status)
    } catch {
      mutateMetadata()
      toast.error('Failed to update status')
    }
  }

  const handleNotesChange = async (repo: StarredRepo, notes: string) => {
    try {
      const dbId = await getDbId(repo)
      await updateRepoNotes(supabase, dbId, notes)
      mutateMetadata(prev => buildRepoMetaEntry(prev, repo.id, dbId, { notes }), { revalidate: false })
    } catch {
      toast.error('Failed to save notes')
    }
  }

  const handlePinToggle = async (repo: StarredRepo) => {
    try {
      const dbId = await getDbId(repo)
      const isPinned = !(metadata?.repoMeta[repo.id]?.isPinned ?? repo.isPinned)
      mutateMetadata(prev => buildRepoMetaEntry(prev, repo.id, dbId, { isPinned }), { revalidate: false })
      await togglePin(supabase, dbId, isPinned)
    } catch {
      mutateMetadata()
      toast.error('Failed to update pin')
    }
  }

  const handleTagToggle = async (repo: StarredRepo, tagId: string) => {
    if (!user?.id) return
    try {
      const dbId = await getDbId(repo)
      const current = metadata?.repoMeta[repo.id]?.tagIds ?? []
      const isAssigned = current.includes(tagId)
      const newTagIds = isAssigned ? current.filter(id => id !== tagId) : [...current, tagId]
      mutateMetadata(prev => buildRepoMetaEntry(prev, repo.id, dbId, { tagIds: newTagIds }), { revalidate: false })
      if (isAssigned) await removeTag(supabase, dbId, user.id, tagId)
      else await assignTag(supabase, dbId, user.id, tagId)
    } catch {
      mutateMetadata()
      toast.error('Failed to update tag')
    }
  }

  const handleTagCreate = async (repo: StarredRepo, label: string) => {
    if (!user?.id) return
    try {
      const newTag = await createTag(supabase, user.id, label, pickTagColor(label))
      const dbId = await getDbId(repo)
      await assignTag(supabase, dbId, user.id, newTag.id)
      mutateMetadata()
    } catch (err) {
      const msg = (err as Error).message
      toast.error(msg.includes('unique') ? 'Tag already exists' : 'Failed to create tag')
    }
  }

  const handleTagCreateSimple = async (label: string) => {
    if (!user?.id) return
    try {
      await createTag(supabase, user.id, label, pickTagColor(label))
      mutateMetadata()
    } catch (err) {
      const msg = (err as Error).message
      toast.error(msg.includes('unique') ? 'Tag already exists' : 'Failed to create tag')
      throw err
    }
  }

  const handleCollectionToggle = async (repo: StarredRepo, collectionId: string, mode: 'toggle' | 'add-only' = 'toggle') => {
    if (!user?.id) return
    try {
      const dbId = await getDbId(repo)
      const current = metadata?.repoMeta[repo.id]?.collectionIds ?? []
      const isAssigned = current.includes(collectionId)
      if (isAssigned && mode === 'add-only') return
      const newCollectionIds = isAssigned ? current.filter(id => id !== collectionId) : [...current, collectionId]
      mutateMetadata(prev => {
        const newMeta = buildRepoMetaEntry(prev, repo.id, dbId, { collectionIds: newCollectionIds })
        const updatedCollections = newMeta.collections.map(c =>
          c.id === collectionId
            ? { ...c, repoCount: Math.max(0, (c.repoCount || 0) + (isAssigned ? -1 : 1)) }
            : c
        )
        return { ...newMeta, collections: updatedCollections }
      }, { revalidate: false })
      if (isAssigned) await removeCollection(supabase, dbId, user.id, collectionId)
      else await assignCollection(supabase, dbId, user.id, collectionId)
    } catch {
      mutateMetadata()
      toast.error('Failed to update collection')
    }
  }

  const handleCollectionCreate = async (name: string, emoji: string, color: string) => {
    if (!user?.id) return
    try {
      await createCollection(supabase, user.id, name, emoji, color)
      mutateMetadata()
    } catch (err) {
      const msg = (err as Error).message
      toast.error(msg.includes('unique') ? 'Collection already exists' : 'Failed to create collection')
    }
  }

  const handleRemoveStarRequest = (repo: StarredRepo) => {
    setRepoToRemove(repo)
  }

  const removeRepoFromLocalState = (repo: StarredRepo) => {
    mutate(prev => prev ? { ...prev, repos: prev.repos.filter(r => r.id !== repo.id) } : prev, { revalidate: false })
    mutateMetadata(prev => {
      if (!prev) return prev
      const { [repo.id]: _, ...remainingMeta } = prev.repoMeta
      return { ...prev, repoMeta: remainingMeta }
    }, { revalidate: false })

    if (selectedRepo?.id === repo.id) {
      setSelectedRepo(null)
      setDetailPanelOpen(false)
      setReadmeViewerOpen(false)
    }

    if (activeRepoId === repo.id) {
      setActiveRepoId(null)
    }

    if (user?.id) {
      const cached = getCachedRepos(user.id)
      if (cached) setCachedRepos(user.id, cached.repos.filter(r => r.id !== repo.id))
    }
  }

  const restoreRepoToLocalState = (repo: StarredRepo) => {
    mutate(prev => {
      if (!prev) return prev
      if (prev.repos.some(r => r.id === repo.id)) return prev
      return { ...prev, repos: [repo, ...prev.repos] }
    }, { revalidate: false })
    mutateMetadata()

    if (user?.id) {
      const cached = getCachedRepos(user.id)
      if (cached && !cached.repos.some(r => r.id === repo.id)) {
        setCachedRepos(user.id, [repo, ...cached.repos])
      }
    }
  }

  const handleRemoveStarConfirm = async () => {
    const repo = repoToRemove
    if (!repo) return
    setRepoToRemove(null)

    // Optimistic remove from SWR cache and localStorage
    removeRepoFromLocalState(repo)
    try {
      const res = await fetch('/api/github/star', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: repo.owner, repo: repo.name, githubRepoId: Number(repo.id) }),
      })

      if (!res.ok) {
        const result = await res.json().catch(() => null)
        throw new Error(result?.error || 'Failed to remove star')
      }

      await refresh({
        triggerKind: "app",
        triggerSource: "repo-unstar-reconcile",
        triggerContext: "dashboard",
      })
      toast(`Removed star from ${repo.owner}/${repo.name}`, {
        icon: <StarOff className="h-4 w-4" />,
      })
    } catch (error) {
      restoreRepoToLocalState(repo)
      const message = error instanceof Error ? error.message : `Failed to remove star from ${repo.owner}/${repo.name}`
      toast.error(message)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveRepoId(null)
    if (!over) return
    const repoId = active.id as string
    const dropTarget = over.id as string
    const repo = repos.find(r => r.id === repoId)
    if (!repo) return
    if (dropTarget.startsWith('collection::')) {
      await handleCollectionToggle(repo, dropTarget.replace('collection::', ''), 'add-only')
    } else if (dropTarget.startsWith('tag::')) {
      await handleTagToggle(repo, dropTarget.replace('tag::', ''))
    }
  }

  const hasActiveFilters = searchQuery || languageFilter || healthFilter || selectedCollection || selectedTag || showUncategorized

  const getActiveFilterLabel = () => {
    if (selectedCollection) {
      const collection = collections.find((c) => c.id === selectedCollection)
      return collection ? `${collection.emoji} ${collection.name}` : null
    }
    if (selectedTag) {
      const tag = allTags.find((t) => t.id === selectedTag)
      return tag ? tag.label : null
    }
    return null
  }

  const getHealthFilterLabel = () => {
    if (healthFilter === "archived") return "Archived"
    if (healthFilter === "dormant") return "Dormant"
    return null
  }

  const renderFilterBadge = (label: string, onRemove: () => void) => (
    <Badge variant="secondary" className="gap-1.5 pr-1">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  )

  const activeRepo = activeRepoId ? repos.find(r => r.id === activeRepoId) : null

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveRepoId(active.id as string)}
      onDragEnd={handleDragEnd}
    >
    <SidebarProvider>
      <AppSidebar
        collections={collections}
        tags={allTags}
        selectedCollection={selectedCollection}
        selectedTag={selectedTag}
        showUncategorized={showUncategorized}
        onSelectCollection={handleSelectCollection}
        onSelectTag={handleSelectTag}
        onShowUncategorized={handleShowUncategorized}
        totalStars={repos.length}
        uncategorizedCount={uncategorizedCount}
        userId={user?.id}
        onAICategorize={handleCategorize}
        onCreateCollection={handleCollectionCreate}
        onCreateTag={handleTagCreateSimple}
      />
      <SidebarInset>
        <DashboardHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          languageFilter={languageFilter}
          onLanguageFilterChange={setLanguageFilter}
          healthFilter={healthFilter}
          onHealthFilterChange={setHealthFilter}
          languages={languages}
          lastSynced={lastSynced}
          user={user}
          onRefresh={isTokenExpired ? undefined : () => handleRefresh("dashboard-navbar-refresh")}
          isRefreshing={isRefreshing || isLoading}
          onCategorize={handleCategorize}
          isCategorizing={isCategorizing}
          categorizeLimit={categorizeLimit}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />
        <DashboardCommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          repos={repos}
          filteredRepos={filteredRepos}
          collections={collections}
          tags={allTags}
          languages={languages}
          searchQuery={searchQuery}
          selectedCollection={selectedCollection}
          selectedTag={selectedTag}
          languageFilter={languageFilter}
          healthFilter={healthFilter}
          showUncategorized={showUncategorized}
          sortBy={sortBy}
          viewMode={viewMode}
          isRefreshing={isLoading}
          isCategorizing={isCategorizing}
          onSearchChange={setSearchQuery}
          onSelectCollection={handleSelectCollection}
          onSelectTag={handleSelectTag}
          onLanguageFilterChange={setLanguageFilter}
          onHealthFilterChange={setHealthFilter}
          onShowUncategorized={handleShowUncategorized}
          onSortChange={setSortBy}
          onViewModeChange={setViewMode}
          onRefresh={() => handleRefresh("dashboard-command-palette")}
          onCategorize={handleCategorize}
          onRepoOpen={handleRepoClick}
          onClearFilters={clearAllFilters}
        />
        <main className="flex-1 p-6">
          {/* Token expiry banner — always at top when expired and cached data exists */}
          {isTokenExpired && hasRepoData && <TokenExpiredBanner onReconnect={handleReconnect} />}

          {/* Loading State — initial sync, no cached data */}
          {isLoading && !hasRepoData && (
            <div className="flex flex-col items-center justify-center py-32 gap-6">
              <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-muted">
                <Star className="h-9 w-9 text-muted-foreground/40" />
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-background ring-2 ring-background">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                </span>
              </div>
              <div className="text-center space-y-1.5">
                <p className="font-medium text-foreground">Syncing your starred repositories</p>
                <p className="text-sm text-muted-foreground">Fetching from GitHub — this may take a moment for large collections.</p>
              </div>
            </div>
          )}

          {/* Full-page error only when no cached data — token error shows reconnect CTA, others show retry */}
          {(error || data?.error) && !hasRepoData && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-destructive">
                {isTokenExpired ? 'Your GitHub session has expired.' : 'Failed to load starred repositories'}
              </p>
              {isTokenExpired ? (
                <Button variant="outline" onClick={handleReconnect}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Reconnect GitHub
                </Button>
              ) : (
                <Button variant="outline" onClick={() => handleRefresh("dashboard-inline-retry")}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}
            </div>
          )}

          {/* Content — shown even when token expired if cached data exists */}
          {hasRepoData && (
            <>
              {/* Active Filters */}
              {hasActiveFilters && (
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Filters:</span>
                  {searchQuery && (
                    renderFilterBadge(`Search: ${searchQuery}`, () => setSearchQuery(""))
                  )}
                  {languageFilter && (
                    renderFilterBadge(languageFilter, () => setLanguageFilter(null))
                  )}
                  {healthFilter && (
                    renderFilterBadge(getHealthFilterLabel() ?? "Health", () => setHealthFilter(null))
                  )}
                  {(selectedCollection || selectedTag) && (
                    renderFilterBadge(getActiveFilterLabel() ?? "Category", () => {
                      handleSelectCollection(null)
                    })
                  )}
                  {showUncategorized && (
                    renderFilterBadge("Uncategorized", () => handleShowUncategorized(false))
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

              {/* Results count + view toggle + per-page selector + top pagination */}
              <div className="mb-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                  <ToggleGroup
                    type="single"
                    value={viewMode}
                    onValueChange={(value) => value && setViewMode(value as "grid" | "list")}
                    className="bg-secondary rounded-md p-0.5"
                  >
                    <ToggleGroupItem value="grid" aria-label="Grid view" className="h-7 w-7 p-0 data-[state=on]:bg-card data-[state=on]:text-foreground">
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="list" aria-label="List view" className="h-7 w-7 p-0 data-[state=on]:bg-card data-[state=on]:text-foreground">
                      <List className="h-3.5 w-3.5" />
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <p className="text-sm text-muted-foreground">
                    {pageSize === "all" || filteredRepos.length === 0
                      ? `${filteredRepos.length} ${filteredRepos.length === 1 ? "repository" : "repositories"}`
                      : `Showing ${startIndex + 1}–${endIndex} of ${filteredRepos.length} ${filteredRepos.length === 1 ? "repository" : "repositories"}`
                    }
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Inline page nav */}
                  {pageSize !== "all" && totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Per page</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(val) => setPageSize(val === "all" ? "all" : Number(val))}
                    >
                      <SelectTrigger className="h-8 w-[80px] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24">24</SelectItem>
                        <SelectItem value="48">48</SelectItem>
                        <SelectItem value="96">96</SelectItem>
                        <SelectItem value="all">All</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Proactive Alerts - Updates on starred repos */}
              <ProactiveAlerts repos={paginatedReposWithHealth} userId={user?.id} />

              {/* Empty State — no repos at all */}
              {repos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-32 gap-6">
                  <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-muted">
                    <Star className="h-9 w-9 text-muted-foreground/50" />
                  </div>
                  <div className="text-center space-y-1.5">
                    <p className="font-medium text-foreground">No starred repositories yet</p>
                    <p className="text-sm text-muted-foreground">
                      Star repositories on GitHub, then sync to see them here.
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => handleRefresh("empty-state-sync")} disabled={isTokenExpired}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync now
                  </Button>
                </div>
              )}

              {/* View */}
              {repos.length > 0 && (
                viewMode === "grid" ? (
                  <RepoGrid repos={paginatedReposWithHealth} onRepoClick={handleRepoClick} onRemoveStar={handleRemoveStarRequest} />
                ) : (
                  <RepoList repos={paginatedReposWithHealth} onRepoClick={handleRepoClick} />
                )
              )}

              {/* Pagination controls - desktop (hidden on mobile) */}
              {repos.length > 0 && pageSize !== "all" && totalPages > 1 && (
                <div className="mt-6 hidden md:flex items-center justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 px-2.5"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          aria-label="Go to previous page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span className="hidden sm:block">Previous</span>
                        </Button>
                      </PaginationItem>

                      {getPageNumbers(currentPage, totalPages).map((page, idx) =>
                        page === "ellipsis" ? (
                          <PaginationItem key={`ellipsis-${idx}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={page}>
                            <PaginationLink
                              isActive={page === currentPage}
                              onClick={(e) => { e.preventDefault(); setCurrentPage(page as number) }}
                              href="#"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      )}

                      <PaginationItem>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 px-2.5"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          aria-label="Go to next page"
                        >
                          <span className="hidden sm:block">Next</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </main>
      </SidebarInset>

      {/* Detail Panel */}
      <RepoDetailPanel
        repo={selectedRepoWithHealth}
        open={detailPanelOpen}
        onClose={handleCloseDetail}
        onViewReadme={handleViewReadme}
        collections={collections}
        tags={allTags}
        onStatusChange={handleStatusChange}
        onTagToggle={handleTagToggle}
        onTagCreate={handleTagCreate}
        onCollectionToggle={handleCollectionToggle}
        onCollectionCreate={handleCollectionCreate}
        onNotesChange={handleNotesChange}
        onPinToggle={handlePinToggle}
      />

      {/* README Viewer */}
      <ReadmeViewer
        repo={selectedRepoWithHealth}
        open={readmeViewerOpen}
        onClose={handleCloseReadme}
      />

      {/* Remove Star Confirmation */}
      <AlertDialog open={!!repoToRemove} onOpenChange={(open) => { if (!open) setRepoToRemove(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove star?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unstar <span className="font-mono font-medium text-foreground">{repoToRemove?.owner}/{repoToRemove?.name}</span> on GitHub and delete all associated tags, collections, and notes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemoveStarConfirm}
            >
              Remove Star
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
    <DragOverlay>
      {activeRepo && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 shadow-xl text-sm font-mono opacity-90 cursor-grabbing">
          {activeRepo.owner}/{activeRepo.name}
        </div>
      )}
    </DragOverlay>
    </DndContext>
  )
}
