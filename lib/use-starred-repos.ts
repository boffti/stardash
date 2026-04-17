"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { getCachedRepos, setCachedRepos } from "@/lib/repo-cache"
import type { StarredRepo } from "@/lib/types"
import { toast } from "sonner"

const MIN_BACKGROUND_SYNC_INTERVAL_MS = 5 * 60 * 1000
const STARRED_REPOS_SYNC_URL = "/api/github/starred"

export type StarredReposSyncTriggerKind = "time-based" | "user" | "app"

export interface StarredReposResponse {
  repos: StarredRepo[]
  lastSynced: string
  fromCache?: boolean
  error?: string
}

interface RefreshOptions {
  manual?: boolean
  triggerKind?: StarredReposSyncTriggerKind
  triggerSource?: string
  triggerContext?: string
}

function buildStarredReposSyncUrl(url: string, options: RefreshOptions = {}) {
  const params = new URLSearchParams()

  if (options.triggerKind) {
    params.set("triggerKind", options.triggerKind)
  }

  if (options.triggerSource) {
    params.set("triggerSource", options.triggerSource)
  }

  if (options.triggerContext) {
    params.set("triggerContext", options.triggerContext)
  }

  const query = params.toString()
  return query ? `${url}?${query}` : url
}

async function fetchStarredRepos(url: string, userId?: string, options: RefreshOptions = {}) {
  const response = await fetch(buildStarredReposSyncUrl(url, options))
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || "Failed to fetch starred repositories")
  }

  if (userId && result.repos) {
    setCachedRepos(userId, result.repos)
  }

  return result as StarredReposResponse
}

export function useStarredRepos(userId?: string) {
  const [cachedData, setCachedData] = useState<StarredReposResponse | undefined>(undefined)
  const manualRefreshRef = useRef(false)
  const backgroundFailureNotifiedRef = useRef(false)
  const lastSuccessfulSyncRef = useRef<string | null>(null)
  const initialSyncCheckedRef = useRef(false)

  useEffect(() => {
    initialSyncCheckedRef.current = false
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setCachedData(undefined)
      return
    }

    const cached = getCachedRepos(userId)
    if (!cached) return

    setCachedData({
      repos: cached.repos,
      lastSynced: cached.cachedAt,
      fromCache: true,
    })
  }, [userId])

  const swr = useSWR<StarredReposResponse>(
    userId ? STARRED_REPOS_SYNC_URL : null,
    (url: string) => fetchStarredRepos(url, userId),
    {
      revalidateOnMount: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      keepPreviousData: true,
      dedupingInterval: 15 * 1000,
      shouldRetryOnError: false,
    }
  )

  const refresh = async ({ manual = false, ...options }: RefreshOptions = {}) => {
    manualRefreshRef.current = manual
    return swr.mutate(fetchStarredRepos(STARRED_REPOS_SYNC_URL, userId, { manual, ...options }), {
      revalidate: false,
    })
  }

  const data = swr.data ?? cachedData

  useEffect(() => {
    if (!userId || initialSyncCheckedRef.current) return

    const cached = getCachedRepos(userId)
    const shouldBackgroundSync = !cached || (Date.now() - new Date(cached.cachedAt).getTime()) >= MIN_BACKGROUND_SYNC_INTERVAL_MS

    initialSyncCheckedRef.current = true

    if (shouldBackgroundSync) {
      void refresh({
        triggerKind: "time-based",
        triggerSource: cached ? "background-cooldown-expired" : "initial-load-no-cache",
        triggerContext: "use-starred-repos",
      })
    }
  }, [userId])

  useEffect(() => {
    if (!data?.lastSynced) return

    const isNewSuccess = data.lastSynced !== lastSuccessfulSyncRef.current
    if (!isNewSuccess) return

    lastSuccessfulSyncRef.current = data.lastSynced

    if (backgroundFailureNotifiedRef.current) {
      toast.success("Star sync is working again")
      backgroundFailureNotifiedRef.current = false
    } else if (manualRefreshRef.current) {
      toast.success("Repositories refreshed")
    }

    manualRefreshRef.current = false
  }, [data?.lastSynced])

  useEffect(() => {
    if (!swr.error) return

    if (manualRefreshRef.current) {
      toast.error(swr.error.message || "Failed to refresh repositories")
      manualRefreshRef.current = false
      return
    }

    if (!backgroundFailureNotifiedRef.current) {
      if (data) {
        toast.error("Background sync failed. Showing cached repositories.")
      } else {
        toast.error("Failed to sync starred repositories.")
      }
      backgroundFailureNotifiedRef.current = true
    }
  }, [data, swr.error])

  return {
    ...swr,
    data,
    refresh,
    isLoading: (swr.isLoading || swr.isValidating) && !data,
    isRefreshing: swr.isValidating && Boolean(data),
  }
}
