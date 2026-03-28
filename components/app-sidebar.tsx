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
} from "lucide-react"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Collection, Tag as TagType } from "@/lib/types"

interface AppSidebarProps {
  collections: Collection[]
  tags: TagType[]
  selectedCollection: string | null
  selectedTag: string | null
  onSelectCollection: (id: string | null) => void
  onSelectTag: (id: string | null) => void
  totalStars: number
  uncategorizedCount: number
}

export function AppSidebar({
  collections,
  tags,
  selectedCollection,
  selectedTag,
  onSelectCollection,
  onSelectTag,
  totalStars,
  uncategorizedCount,
}: AppSidebarProps) {
  const [collectionsOpen, setCollectionsOpen] = useState(true)
  const [tagsOpen, setTagsOpen] = useState(true)

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent">
            <Star className="h-4 w-4 text-accent-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground">StarHub</h1>
            <p className="text-xs text-muted-foreground">Your GitHub stars</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={!selectedCollection && !selectedTag}
                  onClick={() => {
                    onSelectCollection(null)
                    onSelectTag(null)
                  }}
                >
                  <Star className="h-4 w-4" />
                  <span>All Stars</span>
                  <SidebarMenuBadge>{totalStars}</SidebarMenuBadge>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Clock className="h-4 w-4" />
                  <span>Recently Viewed</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <TrendingUp className="h-4 w-4" />
                  <span>Trending</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
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
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {collections.map((collection) => (
                    <SidebarMenuItem key={collection.id}>
                      <SidebarMenuButton
                        isActive={selectedCollection === collection.id}
                        onClick={() => {
                          onSelectCollection(collection.id)
                          onSelectTag(null)
                        }}
                      >
                        <span className="text-base">{collection.emoji}</span>
                        <span>{collection.name}</span>
                        <SidebarMenuBadge>{collection.repoCount}</SidebarMenuBadge>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
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
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {tags.map((tag) => (
                    <SidebarMenuItem key={tag.id}>
                      <SidebarMenuButton
                        isActive={selectedTag === tag.id}
                        onClick={() => {
                          onSelectTag(tag.id)
                          onSelectCollection(null)
                        }}
                      >
                        <Tag className="h-3 w-3" style={{ color: tag.color }} />
                        <span>{tag.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
