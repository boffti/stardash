"use client"

import { useMemo, useState } from "react"
import { Codicon } from "@/components/icons/codicon"
import { useDroppable } from "@dnd-kit/core"
import useSWR from "swr"
import { RADAR_ENABLED } from "@/lib/flags"
import Link from "next/link"
import { useI18n } from "@/components/i18n-provider"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Collection, Tag as TagType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CreateCollectionModal } from "./create-collection-modal"
import { CreateTagModal } from "./create-tag-modal"
import { useRecentlyViewed } from "@/lib/recently-viewed"
import { Skeleton } from "@/components/ui/skeleton"

const TAGS_VISIBLE_DEFAULT = 10

function createDashboardFilterHref(filters: {
  collectionId?: string | null
  tagId?: string | null
  uncategorized?: boolean
}) {
  const params = new URLSearchParams()

  if (filters.collectionId) {
    params.set("collection", filters.collectionId)
  }

  if (filters.tagId) {
    params.set("tag", filters.tagId)
  }

  if (filters.uncategorized) {
    params.set("uncategorized", "true")
  }

  const query = params.toString()
  return query ? `/dashboard?${query}` : "/dashboard"
}

function DroppableItem({
  id,
  children,
}: {
  id: string
  children: (isOver: boolean) => React.ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({ id })
  return <div ref={setNodeRef}>{children(isOver)}</div>
}

interface AppSidebarProps {
  collections: Collection[]
  tags: TagType[]
  selectedCollection: string | null
  selectedTag: string | null
  showUncategorized: boolean
  onSelectCollection: (id: string | null) => void
  onSelectTag: (id: string | null) => void
  onShowUncategorized: (show: boolean) => void
  totalStars: number
  uncategorizedCount: number
  recentCount?: number
  userId?: string
  onAICategorize?: () => void
  onCreateCollection?: (name: string, emoji: string, color: string) => Promise<void>
  onCreateTag?: (label: string) => Promise<void>
  isLoading?: boolean
}

export function AppSidebar({
  collections,
  tags,
  selectedCollection,
  selectedTag,
  showUncategorized,
  onSelectCollection,
  onSelectTag,
  onShowUncategorized,
  totalStars,
  uncategorizedCount,
  recentCount,
  userId,
  onCreateCollection,
  onCreateTag,
  isLoading = false,
}: AppSidebarProps) {
  const { t } = useI18n()
  const pathname = usePathname()
  const [collectionsOpen, setCollectionsOpen] = useState(true)
  const [tagsOpen, setTagsOpen] = useState(true)
  const [tagSearch, setTagSearch] = useState("")
  const [tagsExpanded, setTagsExpanded] = useState(false)
  const [collectionModalOpen, setCollectionModalOpen] = useState(false)
  const [tagModalOpen, setTagModalOpen] = useState(false)

  const filteredTags = tagSearch.trim()
    ? tags.filter((t) => t.label.toLowerCase().includes(tagSearch.toLowerCase()))
    : tags
  const visibleTags =
    tagsExpanded || tagSearch.trim() ? filteredTags : filteredTags.slice(0, TAGS_VISIBLE_DEFAULT)
  const hiddenCount = filteredTags.length - visibleTags.length
  const isHomeRoute = pathname === "/dashboard"
  const isRecentlyViewedRoute = pathname === "/recently-viewed"
  const isRadarRoute = pathname === "/radar"
  const { data: radar } = useSWR<{ total?: number }>(
    RADAR_ENABLED && userId ? "/api/radar" : null,
    (url: string) => fetch(url).then((r) => r.json()),
    { revalidateOnFocus: false, dedupingInterval: 5 * 60_000 },
  )
  const radarCount = radar?.total ?? 0
  const isIntelRoute = pathname === "/intel"
  const isContributeRoute = pathname === "/contribute"
  const isSettingsRoute = pathname === "/settings"
  const isSearchRoute = pathname === "/search"
  const recentEntries = useRecentlyViewed(userId)
  const resolvedRecentCount = useMemo(
    () => recentCount ?? recentEntries.length,
    [recentCount, recentEntries.length],
  )

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-sm font-semibold tracking-tight text-foreground">Stellan</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {RADAR_ENABLED && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isRadarRoute}>
                    <Link href="/radar">
                      <Codicon name="compass" className="h-4 w-4" />
                      <span>{t("Radar", "雷达")}</span>
                      {radarCount > 0 && (
                        <SidebarMenuBadge className="text-muted-foreground">
                          {radarCount}
                        </SidebarMenuBadge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                {isHomeRoute ? (
                  <SidebarMenuButton
                    isActive={!selectedCollection && !selectedTag && !showUncategorized}
                    onClick={() => {
                      onSelectCollection(null)
                    }}
                  >
                    <Codicon name="star" className="h-4 w-4" />
                    <span>{t("All Stars", "全部星标")}</span>
                    {isLoading ? (
                      <Skeleton className="ml-auto h-4 w-6 rounded" />
                    ) : (
                      <SidebarMenuBadge>{totalStars}</SidebarMenuBadge>
                    )}
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton asChild isActive={false}>
                    <Link href="/dashboard">
                      <Codicon name="star" className="h-4 w-4" />
                      <span>{t("All Stars", "全部星标")}</span>
                      {isLoading ? (
                        <Skeleton className="ml-auto h-4 w-6 rounded" />
                      ) : (
                        <SidebarMenuBadge>{totalStars}</SidebarMenuBadge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isSearchRoute}>
                  <Link href="/search">
                    <Codicon name="search" className="h-4 w-4" />
                    <span>{t("Discover", "发现")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isRecentlyViewedRoute}>
                  <Link href="/recently-viewed">
                    <Codicon name="history" className="h-4 w-4" />
                    <span>{t("Recently Viewed", "最近浏览")}</span>
                    {resolvedRecentCount > 0 && (
                      <SidebarMenuBadge>{resolvedRecentCount}</SidebarMenuBadge>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isIntelRoute}>
                  <Link href="/intel">
                    <Codicon name="target" className="h-4 w-4" />
                    <span>{t("Intel", "情报")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isContributeRoute}>
                  <Link href="/contribute">
                    <Codicon name="git-pull-request" className="h-4 w-4" />
                    <span>{t("Contribute", "贡献")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isSettingsRoute}>
                  <Link href="/settings">
                    <Codicon name="settings-gear" className="h-4 w-4" />
                    <span>{t("Settings", "设置")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                {isHomeRoute ? (
                  <SidebarMenuButton
                    isActive={showUncategorized}
                    onClick={() => {
                      onShowUncategorized(!showUncategorized)
                    }}
                  >
                    <Codicon name="warning" className="h-4 w-4" />
                    <span>{t("Uncategorized", "未分类")}</span>
                    {uncategorizedCount > 0 && (
                      <SidebarMenuBadge className="text-muted-foreground">
                        {uncategorizedCount}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton asChild isActive={false}>
                    <Link href={createDashboardFilterHref({ uncategorized: true })}>
                      <Codicon name="warning" className="h-4 w-4" />
                      <span>{t("Uncategorized", "未分类")}</span>
                      {uncategorizedCount > 0 && (
                        <SidebarMenuBadge className="text-muted-foreground">
                          {uncategorizedCount}
                        </SidebarMenuBadge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <Collapsible open={collectionsOpen} onOpenChange={setCollectionsOpen}>
            <div className="flex h-8 items-center gap-1">
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel asChild className="flex-1 gap-2 hover:text-foreground">
                  <button type="button">
                    <span className="grid size-4 shrink-0 place-items-center">
                      <Codicon
                        name="chevron-down"
                        className={`transition-transform ${collectionsOpen ? "" : "-rotate-90"}`}
                      />
                    </span>
                    {t("Collections", "收藏夹")}
                  </button>
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label={t("Add collection", "新建收藏夹")}
                onClick={() => setCollectionModalOpen(true)}
              >
                <Codicon name="plus" className="h-3 w-3" />
              </Button>
            </div>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {isLoading &&
                    collections.length === 0 &&
                    Array.from({ length: 3 }).map((_, i) => (
                      <SidebarMenuItem key={i}>
                        <SidebarMenuButton disabled className="pointer-events-none">
                          <Skeleton className="h-4 w-4 rounded shrink-0" />
                          <Skeleton className="h-3 flex-1 rounded" />
                          <Skeleton className="h-4 w-5 rounded ml-auto" />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  {collections.map((collection) => (
                    <DroppableItem key={collection.id} id={`collection::${collection.id}`}>
                      {(isOver) => (
                        <SidebarMenuItem>
                          {isHomeRoute ? (
                            <SidebarMenuButton
                              isActive={selectedCollection === collection.id}
                              onClick={() => onSelectCollection(collection.id)}
                              className={cn(isOver && "ring-1 ring-violet-500 bg-violet-500/10")}
                            >
                              <span className="shrink-0">{collection.emoji}</span>
                              <span className="flex-1 truncate min-w-0" title={collection.name}>
                                {collection.name}
                              </span>
                              {isOver ? (
                                <Codicon name="plus" className="h-3 w-3 shrink-0 text-violet-400" />
                              ) : (
                                <SidebarMenuBadge>{collection.repoCount}</SidebarMenuBadge>
                              )}
                            </SidebarMenuButton>
                          ) : (
                            <SidebarMenuButton
                              asChild
                              isActive={false}
                              className={cn(isOver && "ring-1 ring-violet-500 bg-violet-500/10")}
                            >
                              <Link
                                href={createDashboardFilterHref({ collectionId: collection.id })}
                              >
                                <span className="shrink-0">{collection.emoji}</span>
                                <span className="flex-1 truncate min-w-0" title={collection.name}>
                                  {collection.name}
                                </span>
                                {isOver ? (
                                  <Codicon
                                    name="plus"
                                    className="h-3 w-3 shrink-0 text-violet-400"
                                  />
                                ) : (
                                  <SidebarMenuBadge>{collection.repoCount}</SidebarMenuBadge>
                                )}
                              </Link>
                            </SidebarMenuButton>
                          )}
                        </SidebarMenuItem>
                      )}
                    </DroppableItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        <SidebarGroup>
          <Collapsible open={tagsOpen} onOpenChange={setTagsOpen}>
            <div className="flex h-8 items-center gap-1">
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel asChild className="flex-1 gap-2 hover:text-foreground">
                  <button type="button">
                    <span className="grid size-4 shrink-0 place-items-center">
                      <Codicon
                        name="chevron-down"
                        className={`transition-transform ${tagsOpen ? "" : "-rotate-90"}`}
                      />
                    </span>
                    {t("Tags", "标签")}
                  </button>
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label={t("Add tag", "新建标签")}
                onClick={() => setTagModalOpen(true)}
              >
                <Codicon name="plus" className="h-3 w-3" />
              </Button>
            </div>
            <CollapsibleContent>
              <SidebarGroupContent>
                {isLoading && tags.length === 0 ? (
                  <SidebarMenu>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <SidebarMenuItem key={i}>
                        <SidebarMenuButton disabled className="pointer-events-none">
                          <Skeleton className="h-3 w-3 rounded-full shrink-0" />
                          <Skeleton className="h-3 rounded" style={{ width: `${50 + i * 10}%` }} />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                ) : tags.length === 0 ? null : (
                  <>
                    {tags.length > TAGS_VISIBLE_DEFAULT && (
                      <div className="relative mx-2 mb-1">
                        <Codicon
                          name="search"
                          className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50"
                        />
                        <Input
                          placeholder={t(
                            `Search ${tags.length} tags…`,
                            `搜索 ${tags.length} 个标签…`,
                          )}
                          value={tagSearch}
                          onChange={(e) => {
                            setTagSearch(e.target.value)
                            setTagsExpanded(false)
                          }}
                          className="h-7 pl-7 text-xs bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>
                    )}
                    <SidebarMenu>
                      {filteredTags.length === 0 ? (
                        <p className="px-4 py-2 text-xs text-muted-foreground/50">
                          {t("No tags match", "没有匹配的标签")}
                        </p>
                      ) : (
                        visibleTags.map((tag) => (
                          <DroppableItem key={tag.id} id={`tag::${tag.id}`}>
                            {(isOver) => (
                              <SidebarMenuItem>
                                {isHomeRoute ? (
                                  <SidebarMenuButton
                                    isActive={selectedTag === tag.id}
                                    onClick={() => onSelectTag(tag.id)}
                                    className={cn(
                                      isOver && "ring-1 ring-violet-500 bg-violet-500/10",
                                    )}
                                  >
                                    <Codicon
                                      name="tag"
                                      className="h-3 w-3 shrink-0"
                                      style={{ color: isOver ? "#8b5cf6" : tag.color }}
                                    />
                                    <span className="flex-1 truncate min-w-0">{tag.label}</span>
                                    {isOver && (
                                      <Codicon
                                        name="plus"
                                        className="h-3 w-3 shrink-0 ml-auto text-violet-400"
                                      />
                                    )}
                                  </SidebarMenuButton>
                                ) : (
                                  <SidebarMenuButton
                                    asChild
                                    isActive={false}
                                    className={cn(
                                      isOver && "ring-1 ring-violet-500 bg-violet-500/10",
                                    )}
                                  >
                                    <Link href={createDashboardFilterHref({ tagId: tag.id })}>
                                      <Codicon
                                        name="tag"
                                        className="h-3 w-3 shrink-0"
                                        style={{ color: isOver ? "#8b5cf6" : tag.color }}
                                      />
                                      <span className="flex-1 truncate min-w-0">{tag.label}</span>
                                      {isOver && (
                                        <Codicon
                                          name="plus"
                                          className="h-3 w-3 shrink-0 ml-auto text-violet-400"
                                        />
                                      )}
                                    </Link>
                                  </SidebarMenuButton>
                                )}
                              </SidebarMenuItem>
                            )}
                          </DroppableItem>
                        ))
                      )}
                      {hiddenCount > 0 && (
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            onClick={() => setTagsExpanded(true)}
                            className="text-muted-foreground/60 hover:text-muted-foreground"
                          >
                            <Codicon name="plus" className="h-3 w-3 shrink-0" />
                            <span className="text-xs">{hiddenCount} more tags</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )}
                      {tagsExpanded && !tagSearch && (
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            onClick={() => setTagsExpanded(false)}
                            className="text-muted-foreground/60 hover:text-muted-foreground"
                          >
                            <Codicon name="chevron-down" className="h-3 w-3 shrink-0 rotate-180" />
                            <span className="text-xs">{t("Show less", "收起")}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )}
                    </SidebarMenu>
                  </>
                )}
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
      </SidebarContent>

      {onCreateCollection && (
        <CreateCollectionModal
          open={collectionModalOpen}
          onOpenChange={setCollectionModalOpen}
          onCreate={onCreateCollection}
        />
      )}

      {onCreateTag && (
        <CreateTagModal open={tagModalOpen} onOpenChange={setTagModalOpen} onCreate={onCreateTag} />
      )}
    </Sidebar>
  )
}
