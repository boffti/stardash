"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { getCachedRepos, setCachedRepos } from "@/lib/repo-cache"
import type { StarredRepo } from "@/lib/types"
import { toast } from "sonner"

export interface StarredReposResponse {
  repos: StarredRepo[]
  lastSynced: string
  fromCache?: boolean
  error?: string
}

interface RefreshOptions {
  manual?: boolean
}

async function fetchStarredRepos(url: string, userId?: string) {
  const response = await fetch(url)
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
    userId ? "/api/github/starred" : null,
    (url: string) => fetchStarredRepos(url, userId),
    {
      revalidateOnMount: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      keepPreviousData: true,
      dedupingInterval: 15 * 1000,
      shouldRetryOnError: false,
    }
  )

  const refresh = async ({ manual = false }: RefreshOptions = {}) => {
    manualRefreshRef.current = manual
    return swr.mutate()
  }

  const data = swr.data ?? cachedData

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

    if (!backgroundFailureNotifiedRef.current && data) {
      toast.error("Background sync failed. Showing cached repositories.")
      backgroundFailureNotifiedRef.current = true
    }
  }, [data, swr.error])

  return {
    ...swr,
    data,
    refresh,
    isLoading: swr.isLoading && !data,
    isRefreshing: swr.isValidating && Boolean(data),
  }
}
