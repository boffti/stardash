"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { History, Search } from "lucide-react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/components/i18n-provider"
import { zhCN } from "date-fns/locale"
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { RepoDetailPanel } from "@/components/repo-detail-panel"
import { ReadmeViewer } from "@/components/readme-viewer"
import { RepoGrid } from "@/components/repo-grid"
import { useStarredRepos } from "@/lib/use-starred-repos"
import { useRecentlyViewed, trackRecentlyViewedRepo } from "@/lib/recently-viewed"
import type { StarredRepo, UserMetadata } from "@/lib/types"
import { AppPageHeader } from "@/components/app-page-header"
import { usePaletteGroups } from "@/components/command-palette"
import { useUser } from "@/components/providers/user-provider"

export function RecentlyViewedDashboard() {
  const { t, locale } = useI18n()
  const { user } = useUser()
  const [selectedRepo, setSelectedRepo] = useState<StarredRepo | null>(null)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)
  const [readmeViewerOpen, setReadmeViewerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const { data, isRefreshing, refresh } = useStarredRepos(user?.id)
  const { data: metadata } = useSWR<UserMetadata>(
    user?.id ? "/api/user/metadata" : null,
    (url: string) => fetch(url).then((response) => response.json()),
    { revalidateOnFocus: false },
  )
  const recentEntries = useRecentlyViewed(user?.id)

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

  const recentRepos = useMemo(() => {
    const repoById = new Map(repos.map((repo) => [repo.id, repo]))

    return recentEntries
      .map((entry) => ({
        ...entry,
        repo: repoById.get(entry.repo.id) ?? entry.repo,
      }))
      .filter(({ repo }) => {
        if (!searchQuery.trim()) return true

        const query = searchQuery.toLowerCase()
        return (
          repo.fullName.toLowerCase().includes(query) ||
          repo.description?.toLowerCase().includes(query) ||
          repo.language?.toLowerCase().includes(query) ||
          repo.tags.some((tag) => tag.label.toLowerCase().includes(query))
        )
      })
  }, [recentEntries, repos, searchQuery])

  const lastSynced = data?.lastSynced
    ? t(data.fromCache ? "Cached " : "Synced ", data.fromCache ? "缓存于" : "同步于") +
      formatDistanceToNow(new Date(data.lastSynced), {
        addSuffix: true,
        locale: locale === "zh-CN" ? zhCN : undefined,
      })
    : null

  const collections = metadata?.collections ?? []
  const tags = metadata?.tags ?? []
  const uncategorizedCount = useMemo(() => {
    return repos.filter((repo) => repo.tags.length === 0 && repo.collections.length === 0).length
  }, [repos])

  const handleRefresh = async (triggerSource: string = "recently-viewed-navbar-refresh") => {
    await refresh({
      manual: true,
      triggerKind: "user",
      triggerSource,
      triggerContext: "recently-viewed",
    })
  }

  const handleRepoClick = (repo: StarredRepo) => {
    if (user?.id) {
      trackRecentlyViewedRepo(user.id, repo, "recently-viewed")
    }
    setSelectedRepo(repo)
    setDetailPanelOpen(true)
  }

  usePaletteGroups({
    onRepo: handleRepoClick,
    groups: [
      {
        heading: t("Recently viewed", "最近浏览"),
        limit: 12,
        items: recentRepos.map(({ repo }) => ({
          id: `recent-${repo.fullName}`,
          label: repo.fullName,
          hint: repo.description ?? undefined,
          icon: History,
          onSelect: () => handleRepoClick(repo),
        })),
      },
    ],
  })

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
        totalStars={repos.length}
        uncategorizedCount={uncategorizedCount}
        recentCount={recentEntries.length}
        userId={user?.id}
      />
      <SidebarInset className="overflow-x-hidden">
        <AppPageHeader
          searchLabel={t("Search recently viewed repos", "搜索最近浏览的仓库")}
          lastSynced={lastSynced}
          onRefresh={() => handleRefresh("recently-viewed-navbar-refresh")}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 p-6">
          <section className="mb-8 space-y-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                {t("Recently viewed", "最近浏览")}
              </h1>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("Search recently viewed repos", "搜索最近浏览的仓库")}
                  className="pl-9"
                />
              </div>
            </div>
          </section>

          {recentRepos.length === 0 ? (
            <Empty className="py-16">
              <EmptyMedia variant="icon">
                <History className="h-10 w-10" />
              </EmptyMedia>
              <EmptyTitle>
                {searchQuery
                  ? t("No matching repositories", "没有匹配的仓库")
                  : t("No recently viewed repositories", "暂无最近浏览的仓库")}
              </EmptyTitle>
              <EmptyDescription>
                {searchQuery ? (
                  t("Try another search.", "试试其他搜索词。")
                ) : (
                  <Link href="/dashboard" className="underline underline-offset-4">
                    {t("Browse your stars", "浏览星标仓库")}
                  </Link>
                )}
              </EmptyDescription>
            </Empty>
          ) : (
            <section>
              <RepoGrid repos={recentRepos.map(({ repo }) => repo)} onRepoClick={handleRepoClick} />
            </section>
          )}
        </main>
      </SidebarInset>

      <RepoDetailPanel
        repo={selectedRepo}
        open={detailPanelOpen}
        onClose={handleCloseDetail}
        onViewReadme={handleViewReadme}
        collections={collections}
        tags={tags}
        onStatusChange={() => {}}
        onTagToggle={() => {}}
        onTagCreate={() => {}}
        onCollectionToggle={() => {}}
        onCollectionCreate={() => {}}
        onNotesChange={() => {}}
        onPinToggle={() => {}}
      />

      <ReadmeViewer repo={selectedRepo} open={readmeViewerOpen} onClose={handleCloseReadme} />
    </SidebarProvider>
  )
}
