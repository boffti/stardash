"use client"

import { useState } from "react"
import {
  Star,
  FolderOpen,
  Tag,
  Clock,
  TrendingUp,
  AlertTriangle,
  Plus,
  ChevronDown,
  Search,
  Sparkles,
  Settings,
} from "lucide-react"
import { useDroppable } from "@dnd-kit/core"
import Link from "next/link"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Collection, Tag as TagType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CreateCollectionModal } from "./create-collection-modal"
import { CreateTagModal } from "./create-tag-modal"

const TAGS_VISIBLE_DEFAULT = 10

function DroppableItem({ id, children }: { id: string; children: (isOver: boolean) => React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id })
  return <div ref={setNodeRef}>{children(isOver)}</div>
}

function CollectionsEmptyState({ onAICategorize }: { onAICategorize?: () => void }) {
  return (
    <div className="mx-2 my-1 rounded-md border border-dashed border-border/50 px-3 py-4 flex flex-col items-center gap-2 text-center">
      <div className="flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/30">
        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground/40" />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground/70">No collections yet</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground/40">
          {"Drag a repo onto the sidebar or "}
          {onAICategorize ? (
            <button
              onClick={onAICategorize}
              className="inline-flex items-center gap-0.5 text-violet-400/70 hover:text-violet-400 transition-colors underline underline-offset-2"
            >
              <Sparkles className="h-2.5 w-2.5" />
              {" auto-categorize"}
            </button>
          ) : (
            "run AI categorize"
          )}
        </p>
      </div>
    </div>
  )
}

function TagsEmptyState() {
  return (
    <div className="mx-2 my-1 rounded-md border border-dashed border-border/50 px-3 py-4 flex flex-col items-center gap-2 text-center">
      <div className="flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/30">
        <Tag className="h-3.5 w-3.5 text-muted-foreground/40" />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground/70">No tags yet</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground/40">
          Open any repo and add tags<br />from the detail panel
        </p>
      </div>
    </div>
  )
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
  onAICategorize?: () => void
  onCreateCollection?: (name: string, emoji: string, color: string) => Promise<void>
  onCreateTag?: (label: string) => Promise<void>
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
  onAICategorize,
  onCreateCollection,
  onCreateTag,
}: AppSidebarProps) {
  const pathname = usePathname()
  const [collectionsOpen, setCollectionsOpen] = useState(true)
  const [tagsOpen, setTagsOpen] = useState(true)
  const [tagSearch, setTagSearch] = useState("")
  const [tagsExpanded, setTagsExpanded] = useState(false)
  const [collectionModalOpen, setCollectionModalOpen] = useState(false)
  const [tagModalOpen, setTagModalOpen] = useState(false)

  const filteredTags = tagSearch.trim()
    ? tags.filter(t => t.label.toLowerCase().includes(tagSearch.toLowerCase()))
    : tags
  const visibleTags = tagsExpanded || tagSearch.trim()
    ? filteredTags
    : filteredTags.slice(0, TAGS_VISIBLE_DEFAULT)
  const hiddenCount = filteredTags.length - visibleTags.length
  const isHomeRoute = pathname === "/"
  const isTrendingRoute = pathname === "/trending"
  const isSettingsRoute = pathname === "/settings"

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent" suppressHydrationWarning>
            <Star className="h-4 w-4 text-accent-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground">StarDash</h1>
            <p className="text-xs text-muted-foreground">Your GitHub stars</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                {isHomeRoute ? (
                  <SidebarMenuButton
                    isActive={!selectedCollection && !selectedTag && !showUncategorized}
                    onClick={() => {
                      onSelectCollection(null)
                      onSelectTag(null)
                      onShowUncategorized(false)
                    }}
                  >
                    <Star className="h-4 w-4" />
                    <span>All Stars</span>
                    <SidebarMenuBadge>{totalStars}</SidebarMenuBadge>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton asChild isActive={false}>
                    <Link href="/">
                      <Star className="h-4 w-4" />
                      <span>All Stars</span>
                      <SidebarMenuBadge>{totalStars}</SidebarMenuBadge>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Clock className="h-4 w-4" />
                  <span>Recently Viewed</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isTrendingRoute}>
                  <Link href="/trending">
                    <TrendingUp className="h-4 w-4" />
                    <span>Trending</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isSettingsRoute}>
                  <Link href="/settings">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={showUncategorized}
                  onClick={() => {
                    onShowUncategorized(!showUncategorized)
                    onSelectCollection(null)
                    onSelectTag(null)
                  }}
                >
                  <AlertTriangle className="h-4 w-4" />
                  <span>Uncategorized</span>
                  {uncategorizedCount > 0 && (
                    <SidebarMenuBadge className="bg-orange-500/20 text-orange-400">
                      {uncategorizedCount}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <Collapsible open={collectionsOpen} onOpenChange={setCollectionsOpen}>
            <div className="flex items-center justify-between px-2">
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:text-foreground flex items-center gap-1">
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${collectionsOpen ? "" : "-rotate-90"}`}
                  />
                  Collections
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setCollectionModalOpen(true)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {collections.length === 0 && (
                    <CollectionsEmptyState onAICategorize={onAICategorize} />
                  )}
                  {collections.map((collection) => (
                    <DroppableItem key={collection.id} id={`collection::${collection.id}`}>
                      {(isOver) => (
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            isActive={selectedCollection === collection.id}
                            onClick={() => {
                              onSelectCollection(collection.id)
                              onSelectTag(null)
                              onShowUncategorized(false)
                            }}
                            className={cn(isOver && "ring-1 ring-violet-500 bg-violet-500/10")}
                          >
                            <span className="shrink-0">{collection.emoji}</span>
                            <span className="flex-1 truncate min-w-0" title={collection.name}>{collection.name}</span>
                            {isOver
                              ? <Plus className="h-3 w-3 shrink-0 text-violet-400" />
                              : <SidebarMenuBadge>{collection.repoCount}</SidebarMenuBadge>
                            }
                          </SidebarMenuButton>
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
            <div className="flex items-center justify-between px-2">
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:text-foreground flex items-center gap-1">
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${tagsOpen ? "" : "-rotate-90"}`}
                  />
                  Tags
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setTagModalOpen(true)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <CollapsibleContent>
              <SidebarGroupContent>
                {tags.length === 0 ? (
                  <TagsEmptyState />
                ) : (
                  <>
                    {tags.length > TAGS_VISIBLE_DEFAULT && (
                      <div className="relative mx-2 mb-1">
                        <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" />
                        <Input
                          placeholder={`Search ${tags.length} tags…`}
                          value={tagSearch}
                          onChange={e => {
                            setTagSearch(e.target.value)
                            setTagsExpanded(false)
                          }}
                          className="h-7 pl-7 text-xs bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>
                    )}
                    <SidebarMenu>
                      {filteredTags.length === 0 ? (
                        <p className="px-4 py-2 text-xs text-muted-foreground/50">No tags match</p>
                      ) : (
                        visibleTags.map((tag) => (
                          <DroppableItem key={tag.id} id={`tag::${tag.id}`}>
                            {(isOver) => (
                              <SidebarMenuItem>
                                <SidebarMenuButton
                                  isActive={selectedTag === tag.id}
                                  onClick={() => {
                                    onSelectTag(tag.id)
                                    onSelectCollection(null)
                                    onShowUncategorized(false)
                                  }}
                                  className={cn(isOver && "ring-1 ring-violet-500 bg-violet-500/10")}
                                >
                                  <Tag className="h-3 w-3 shrink-0" style={{ color: isOver ? '#8b5cf6' : tag.color }} />
                                  <span className="flex-1 truncate min-w-0">{tag.label}</span>
                                  {isOver && <Plus className="h-3 w-3 shrink-0 ml-auto text-violet-400" />}
                                </SidebarMenuButton>
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
                            <Plus className="h-3 w-3 shrink-0" />
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
                            <ChevronDown className="h-3 w-3 shrink-0 rotate-180" />
                            <span className="text-xs">Show less</span>
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
        <CreateTagModal
          open={tagModalOpen}
          onOpenChange={setTagModalOpen}
          onCreate={onCreateTag}
        />
      )}
    </Sidebar>
  )
}
