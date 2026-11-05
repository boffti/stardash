"use client"

import { FolderOpen, Hash, LayoutGrid, List, SlidersHorizontal, Sparkles, Tag } from "lucide-react"

import type { Collection, StarredRepo, Tag as RepoTag } from "@/lib/types"
import type { RepoHealthFilter } from "@/lib/repo-health"
import { usePaletteGroups } from "@/components/command-palette"

interface DashboardCommandPaletteProps {
  collections: Collection[]
  tags: RepoTag[]
  languages: string[]
  searchQuery: string
  selectedCollection: string | null
  selectedTag: string | null
  languageFilter: string | null
  healthFilter: RepoHealthFilter | null
  showUncategorized: boolean
  sortBy: string
  viewMode: "grid" | "list" | "graph"
  isCategorizing: boolean
  onSearchChange: (query: string) => void
  onSelectCollection: (collectionId: string | null) => void
  onSelectTag: (tagId: string | null) => void
  onLanguageFilterChange: (language: string | null) => void
  onHealthFilterChange: (filter: RepoHealthFilter | null) => void
  onShowUncategorized: (value: boolean) => void
  onSortChange: (value: string) => void
  onViewModeChange: (value: "grid" | "list") => void
  onCategorize: () => void
  onRepoOpen: (repo: StarredRepo) => void
  onClearFilters: () => void
}

const sortLabels: Record<string, string> = {
  "starred-desc": "Newest starred",
  "starred-asc": "Oldest starred",
  "stars-desc": "Most GitHub stars",
  "stars-asc": "Fewest GitHub stars",
  "updated-desc": "Recently updated",
  "name-asc": "Name A-Z",
}

/** All Stars' commands in the app-wide palette. Renders nothing. */
export function DashboardCommandPalette(p: DashboardCommandPaletteProps) {
  const hasActiveFilters = Boolean(
    p.searchQuery ||
    p.selectedCollection ||
    p.selectedTag ||
    p.languageFilter ||
    p.healthFilter ||
    p.showUncategorized,
  )
  const nextView = p.viewMode === "grid" ? "list" : "grid"

  usePaletteGroups({
    placeholder: "Jump to a repo, language, collection, or action...",
    search: { label: "Filter All Stars", run: p.onSearchChange },
    onRepo: p.onRepoOpen,
    groups: [
      {
        heading: "All Stars actions",
        items: [
          {
            id: "dash-categorize",
            label: "Auto-categorize with AI",
            keywords: "ai tags collections organize",
            icon: Sparkles,
            iconClassName: p.isCategorizing ? "animate-pulse" : undefined,
            shortcut: "AI",
            onSelect: p.onCategorize,
          },
          {
            id: `dash-view-${nextView}`,
            label: `Switch to ${nextView} view`,
            keywords: "layout",
            icon: nextView === "list" ? List : LayoutGrid,
            onSelect: () => p.onViewModeChange(nextView),
          },
          {
            id: "dash-clear",
            label: "Clear active filters",
            keywords: "reset",
            icon: SlidersHorizontal,
            disabled: !hasActiveFilters,
            onSelect: p.onClearFilters,
          },
          {
            id: "dash-uncategorized",
            label: "Show uncategorized repositories",
            keywords: "untagged special filter",
            icon: Hash,
            checked: p.showUncategorized,
            onSelect: () => p.onShowUncategorized(!p.showUncategorized),
          },
        ],
      },
      {
        heading: "Sort",
        items: Object.entries(sortLabels).map(([value, label]) => ({
          id: `sort-${value}`,
          label,
          keywords: "sort order",
          checked: p.sortBy === value,
          onSelect: () => p.onSortChange(value),
        })),
      },
      {
        heading: "Collections",
        items: p.collections.map((c) => ({
          id: `collection-${c.id}`,
          label: `${c.emoji ?? ""} ${c.name}`.trim(),
          keywords: "collection",
          icon: p.selectedCollection === c.id ? undefined : FolderOpen,
          checked: p.selectedCollection === c.id ? true : undefined,
          onSelect: () => p.onSelectCollection(p.selectedCollection === c.id ? null : c.id),
        })),
      },
      {
        heading: "Tags",
        limit: 24,
        items: p.tags.map((t) => ({
          id: `tag-${t.id}`,
          label: t.label,
          keywords: "tag",
          icon: p.selectedTag === t.id ? undefined : Tag,
          iconColor: t.color,
          checked: p.selectedTag === t.id ? true : undefined,
          onSelect: () => p.onSelectTag(p.selectedTag === t.id ? null : t.id),
        })),
      },
      {
        heading: "Languages",
        limit: 12,
        items: [null, ...p.languages].map((lang) => ({
          id: `language-${lang ?? "all"}`,
          label: lang ?? "All languages",
          keywords: "language",
          checked: p.languageFilter === lang,
          onSelect: () => p.onLanguageFilterChange(lang),
        })),
      },
      {
        heading: "Health",
        items: (
          [
            [null, "All health states"],
            ["archived", "Archived repositories"],
            ["dormant", "Dormant repositories"],
          ] as [RepoHealthFilter | null, string][]
        ).map(([value, label]) => ({
          id: `health-${value ?? "all"}`,
          label,
          keywords: "health",
          checked: p.healthFilter === value,
          onSelect: () => p.onHealthFilterChange(value),
        })),
      },
    ],
  })
  return null
}
