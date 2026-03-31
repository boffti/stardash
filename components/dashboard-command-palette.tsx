"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  Check,
  FolderOpen,
  Hash,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
} from "lucide-react"

import type { Collection, StarredRepo, Tag as RepoTag } from "@/lib/types"
import type { RepoHealthFilter } from "@/lib/repo-health"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

interface DashboardCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  repos: StarredRepo[]
  filteredRepos: StarredRepo[]
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
  viewMode: "grid" | "list"
  isRefreshing: boolean
  isCategorizing: boolean
  onSearchChange: (query: string) => void
  onSelectCollection: (collectionId: string | null) => void
  onSelectTag: (tagId: string | null) => void
  onLanguageFilterChange: (language: string | null) => void
  onHealthFilterChange: (filter: RepoHealthFilter | null) => void
  onShowUncategorized: (value: boolean) => void
  onSortChange: (value: string) => void
  onViewModeChange: (value: "grid" | "list") => void
  onRefresh: () => void
  onCategorize: () => void
  onRepoOpen: (repo: StarredRepo) => void
  onClearFilters: () => void
}

const RESULT_LIMIT = 24

const sortLabels: Record<string, string> = {
  "starred-desc": "Newest starred",
  "starred-asc": "Oldest starred",
  "stars-desc": "Most GitHub stars",
  "stars-asc": "Fewest GitHub stars",
  "updated-desc": "Recently updated",
  "name-asc": "Name A-Z",
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"]'
    )
  )
}

function includesQuery(value: string | undefined | null, query: string) {
  return Boolean(value?.toLowerCase().includes(query))
}

export function DashboardCommandPalette({
  open,
  onOpenChange,
  repos,
  filteredRepos,
  collections,
  tags,
  languages,
  searchQuery,
  selectedCollection,
  selectedTag,
  languageFilter,
  healthFilter,
  showUncategorized,
  sortBy,
  viewMode,
  isRefreshing,
  isCategorizing,
  onSearchChange,
  onSelectCollection,
  onSelectTag,
  onLanguageFilterChange,
  onHealthFilterChange,
  onShowUncategorized,
  onSortChange,
  onViewModeChange,
  onRefresh,
  onCategorize,
  onRepoOpen,
  onClearFilters,
}: DashboardCommandPaletteProps) {
  const [query, setQuery] = useState("")
  const [selectedValue, setSelectedValue] = useState("")

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (!open && isEditableTarget(event.target)) return
        event.preventDefault()
        onOpenChange(!open)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setSelectedValue("")
    }
  }, [open])

  const normalizedQuery = query.trim().toLowerCase()
  const hasActiveFilters = Boolean(
    searchQuery || selectedCollection || selectedTag || languageFilter || healthFilter || showUncategorized
  )

  const visibleRepos = useMemo(() => {
    const baseRepos = normalizedQuery ? repos : filteredRepos

    const matched = normalizedQuery
      ? repos.filter((repo) => {
          return (
            includesQuery(repo.name, normalizedQuery) ||
            includesQuery(repo.owner, normalizedQuery) ||
            includesQuery(repo.description, normalizedQuery) ||
            includesQuery(repo.notes, normalizedQuery) ||
            includesQuery(repo.language, normalizedQuery) ||
            repo.tags.some((tag) => includesQuery(tag.label, normalizedQuery))
          )
        })
      : baseRepos

    return [...matched]
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1
        if (!a.isPinned && b.isPinned) return 1
        return new Date(b.starredAt).getTime() - new Date(a.starredAt).getTime()
      })
      .slice(0, RESULT_LIMIT)
  }, [filteredRepos, normalizedQuery, repos])

  const orderedItemMatches = useMemo(() => {
    const matches: Array<{ value: string; matchesQuery: boolean }> = []

    if (query.trim()) {
      matches.push({
        value: `search-${query}`,
        matchesQuery: true,
      })
    }

    matches.push(
      {
        value: "refresh-stars",
        matchesQuery: "refresh starred repositories sync".includes(normalizedQuery),
      },
      {
        value: "auto-categorize",
        matchesQuery: "auto categorize with ai sparkles".includes(normalizedQuery),
      },
      {
        value: `view-${viewMode === "grid" ? "list" : "grid"}`,
        matchesQuery: `switch to ${viewMode === "grid" ? "list" : "grid"} view`.includes(normalizedQuery),
      },
      {
        value: "clear-filters",
        matchesQuery: hasActiveFilters && "clear active filters reset".includes(normalizedQuery),
      }
    )

    Object.entries(sortLabels).forEach(([value, label]) => {
      matches.push({
        value: `sort-${value}`,
        matchesQuery: label.toLowerCase().includes(normalizedQuery),
      })
    })

    matches.push({
      value: "language-all",
      matchesQuery: "all languages".includes(normalizedQuery),
    })

    languages.forEach((language) => {
      matches.push({
        value: `language-${language}`,
        matchesQuery: language.toLowerCase().includes(normalizedQuery),
      })
    })

    collections.forEach((collection) => {
      matches.push({
        value: `collection-${collection.name}`,
        matchesQuery: `${collection.name} ${collection.emoji ?? ""}`.toLowerCase().includes(normalizedQuery),
      })
    })

    tags.slice(0, 24).forEach((tag) => {
      matches.push({
        value: `tag-${tag.label}`,
        matchesQuery: tag.label.toLowerCase().includes(normalizedQuery),
      })
    })

    matches.push(
      {
        value: "health-all",
        matchesQuery: "all health states".includes(normalizedQuery),
      },
      {
        value: "health-archived",
        matchesQuery: "archived repositories".includes(normalizedQuery),
      },
      {
        value: "health-dormant",
        matchesQuery: "dormant repositories".includes(normalizedQuery),
      },
      {
        value: "uncategorized",
        matchesQuery: "show uncategorized repositories".includes(normalizedQuery),
      }
    )

    visibleRepos.forEach((repo) => {
      matches.push({
        value: `repo-${repo.owner}-${repo.name}`,
        matchesQuery: [
          repo.owner,
          repo.name,
          repo.description,
          repo.notes,
          repo.language,
          ...repo.tags.map((tag) => tag.label),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      })
    })

    return matches
  }, [collections, hasActiveFilters, languages, normalizedQuery, query, tags, viewMode, visibleRepos])

  useEffect(() => {
    if (!open) return

    const nextSelection =
      orderedItemMatches.find((item) => item.matchesQuery)?.value ?? orderedItemMatches[0]?.value ?? ""

    setSelectedValue(nextSelection)
  }, [open, orderedItemMatches])

  const applyDashboardSearch = () => {
    if (!query.trim()) return
    onSearchChange(query.trim())
    onOpenChange(false)
  }

  const selectCollection = (collectionId: string | null) => {
    onSelectCollection(collectionId)
    onOpenChange(false)
  }

  const selectTag = (tagId: string | null) => {
    onSelectTag(tagId)
    onOpenChange(false)
  }

  const selectLanguage = (language: string | null) => {
    onLanguageFilterChange(language)
    onOpenChange(false)
  }

  const selectHealthFilter = (filter: RepoHealthFilter | null) => {
    onHealthFilterChange(filter)
    onOpenChange(false)
  }

  const toggleUncategorized = () => {
    onShowUncategorized(!showUncategorized)
    onOpenChange(false)
  }

  const runAndClose = (action: () => void) => {
    action()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl overflow-hidden p-0" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Search StarDash</DialogTitle>
          <DialogDescription>
            Search repositories, switch dashboard filters, and run quick actions.
          </DialogDescription>
        </DialogHeader>
        <Command
          shouldFilter={false}
          value={selectedValue}
          onValueChange={setSelectedValue}
          className="rounded-none bg-popover text-popover-foreground [&_[data-slot=command-input-wrapper]]:h-14 [&_[data-slot=command-input-wrapper]]:border-b [&_[data-slot=command-input-wrapper]]:border-border/70 [&_[data-slot=command-input-wrapper]]:px-4 [&_[data-slot=command-input-wrapper]_svg]:h-4 [&_[data-slot=command-input-wrapper]_svg]:w-4 [&_[data-slot=command-input]]:h-14 [&_[data-slot=command-input]]:text-sm"
        >
          <div className="border-b border-border/70 bg-secondary/20">
            <div className="flex items-center justify-between gap-3 px-4 py-2 text-xs text-muted-foreground">
              <span className="truncate">Search repositories, filters, and dashboard actions</span>
              <KbdGroup className="hidden shrink-0 sm:flex">
                <Kbd>Esc</Kbd>
                <Kbd>Enter</Kbd>
              </KbdGroup>
            </div>
          </div>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Jump to a repo, language, collection, or action..."
          />

          <CommandList className="max-h-[min(72vh,680px)] px-2 py-2">
            {query.trim() && (
              <CommandGroup heading="Search">
                <CommandItem
                  value={`search-${query}`}
                  onSelect={applyDashboardSearch}
                  className="rounded-md"
                >
                  <Search className="h-4 w-4" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">Filter dashboard for "{query.trim()}"</span>
                    <span className="text-xs text-muted-foreground">
                      Updates the persistent repo search field
                    </span>
                  </div>
                  <CommandShortcut>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </CommandShortcut>
                </CommandItem>
              </CommandGroup>
            )}

            <CommandGroup heading="Quick Actions">
              <CommandItem value="refresh-stars" onSelect={() => runAndClose(onRefresh)} className="rounded-md">
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                <span className="flex-1">Refresh starred repositories</span>
                <CommandShortcut>Sync</CommandShortcut>
              </CommandItem>
              <CommandItem value="auto-categorize" onSelect={() => runAndClose(onCategorize)} className="rounded-md">
                <Sparkles className={`h-4 w-4 ${isCategorizing ? "animate-pulse" : ""}`} />
                <span className="flex-1">Auto-categorize with AI</span>
                <CommandShortcut>AI</CommandShortcut>
              </CommandItem>
              <CommandItem
                value={`view-${viewMode === "grid" ? "list" : "grid"}`}
                onSelect={() => runAndClose(() => onViewModeChange(viewMode === "grid" ? "list" : "grid"))}
                className="rounded-md"
              >
                {viewMode === "grid" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                <span className="flex-1">Switch to {viewMode === "grid" ? "list" : "grid"} view</span>
                <CommandShortcut>{viewMode === "grid" ? "List" : "Grid"}</CommandShortcut>
              </CommandItem>
              <CommandItem
                value="clear-filters"
                onSelect={() => runAndClose(onClearFilters)}
                disabled={!hasActiveFilters}
                className="rounded-md"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="flex-1">Clear active filters</span>
                <CommandShortcut>{hasActiveFilters ? "Reset" : "Idle"}</CommandShortcut>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Sort">
              {Object.entries(sortLabels).map(([value, label]) => (
                <CommandItem
                  key={value}
                  value={`sort-${value}`}
                  onSelect={() => runAndClose(() => onSortChange(value))}
                  className="rounded-md"
                >
                  <Check className={`h-4 w-4 ${sortBy === value ? "opacity-100" : "opacity-0"}`} />
                  <span className="flex-1">{label}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Languages">
              <CommandItem value="language-all" onSelect={() => selectLanguage(null)} className="rounded-md">
                <Check className={`h-4 w-4 ${languageFilter === null ? "opacity-100" : "opacity-0"}`} />
                <span className="flex-1">All languages</span>
              </CommandItem>
              {languages.map((language) => (
                <CommandItem
                  key={language}
                  value={`language-${language}`}
                  onSelect={() => selectLanguage(language)}
                  className="rounded-md"
                >
                  <Check className={`h-4 w-4 ${languageFilter === language ? "opacity-100" : "opacity-0"}`} />
                  <span className="flex-1">{language}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            {collections.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Collections">
                  {collections.map((collection) => (
                    <CommandItem
                      key={collection.id}
                      value={`collection-${collection.name}`}
                      onSelect={() => selectCollection(collection.id)}
                      className="rounded-md"
                    >
                      <FolderOpen className="h-4 w-4" />
                      <span className="flex-1 truncate">
                        {collection.emoji} {collection.name}
                      </span>
                      {selectedCollection === collection.id && <Check className="h-4 w-4" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {tags.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Tags">
                  {tags.slice(0, 24).map((tag) => (
                    <CommandItem
                      key={tag.id}
                      value={`tag-${tag.label}`}
                      onSelect={() => selectTag(tag.id)}
                      className="rounded-md"
                    >
                      <Tag className="h-4 w-4" style={{ color: tag.color }} />
                      <span className="flex-1 truncate">{tag.label}</span>
                      {selectedTag === tag.id && <Check className="h-4 w-4" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            <CommandSeparator />

            <CommandGroup heading="Health">
              <CommandItem value="health-all" onSelect={() => selectHealthFilter(null)} className="rounded-md">
                <Check className={`h-4 w-4 ${healthFilter === null ? "opacity-100" : "opacity-0"}`} />
                <span className="flex-1">All health states</span>
              </CommandItem>
              <CommandItem value="health-archived" onSelect={() => selectHealthFilter("archived")} className="rounded-md">
                <Check className={`h-4 w-4 ${healthFilter === "archived" ? "opacity-100" : "opacity-0"}`} />
                <span className="flex-1">Archived repositories</span>
              </CommandItem>
              <CommandItem value="health-dormant" onSelect={() => selectHealthFilter("dormant")} className="rounded-md">
                <Check className={`h-4 w-4 ${healthFilter === "dormant" ? "opacity-100" : "opacity-0"}`} />
                <span className="flex-1">Dormant repositories</span>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Special Filters">
              <CommandItem
                value="uncategorized"
                onSelect={toggleUncategorized}
                className="rounded-md"
              >
                <Hash className="h-4 w-4" />
                <span className="flex-1">Show uncategorized repositories</span>
                {showUncategorized && <Check className="h-4 w-4" />}
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading={normalizedQuery ? "Matching Repositories" : "Repositories"}>
              {visibleRepos.map((repo) => (
                <CommandItem
                  key={repo.id}
                  value={`repo-${repo.owner}-${repo.name}`}
                  onSelect={() => runAndClose(() => onRepoOpen(repo))}
                  className="items-start rounded-md py-3"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {repo.owner}/{repo.name}
                      </span>
                      {repo.isPinned && (
                        <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Pinned
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {repo.description}
                      </span>
                    )}
                  </div>
                  <CommandShortcut>{repo.language ?? "Repo"}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandEmpty className="py-10">
              <div className="space-y-2 text-center">
                <p className="font-medium">No results for "{query.trim()}"</p>
                <p className="text-xs text-muted-foreground">
                  Try a repo name, a language, or a dashboard action.
                </p>
              </div>
            </CommandEmpty>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
