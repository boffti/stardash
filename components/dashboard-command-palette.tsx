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
import { useCommandPaletteShortcut } from "@/components/use-command-palette-shortcut"

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

function includesQuery(value: string | undefined | null, query: string) {
  return Boolean(value?.toLowerCase().includes(query))
}

function matchesPaletteQuery(label: string, query: string) {
  return !query || label.toLowerCase().includes(query)
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
  useCommandPaletteShortcut(open, onOpenChange)

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const quickActions = useMemo(() => ([
    {
      value: "refresh-stars",
      label: "Refresh starred repositories",
      searchText: "refresh starred repositories sync",
      shortcut: "Sync",
      icon: RefreshCw,
      onSelect: () => onRefresh(),
      iconClassName: isRefreshing ? "animate-spin" : "",
    },
    {
      value: "auto-categorize",
      label: "Auto-categorize with AI",
      searchText: "auto categorize with ai sparkles",
      shortcut: "AI",
      icon: Sparkles,
      onSelect: () => onCategorize(),
      iconClassName: isCategorizing ? "animate-pulse" : "",
    },
    {
      value: `view-${viewMode === "grid" ? "list" : "grid"}`,
      label: `Switch to ${viewMode === "grid" ? "list" : "grid"} view`,
      searchText: `switch to ${viewMode === "grid" ? "list" : "grid"} view`,
      shortcut: viewMode === "grid" ? "List" : "Grid",
      icon: viewMode === "grid" ? List : LayoutGrid,
      onSelect: () => onViewModeChange(viewMode === "grid" ? "list" : "grid"),
      iconClassName: "",
    },
    {
      value: "clear-filters",
      label: "Clear active filters",
      searchText: "clear active filters reset",
      shortcut: hasActiveFilters ? "Reset" : "Idle",
      icon: SlidersHorizontal,
      onSelect: onClearFilters,
      iconClassName: "",
      disabled: !hasActiveFilters,
    },
  ]), [
    hasActiveFilters,
    isCategorizing,
    isRefreshing,
    onCategorize,
    onClearFilters,
    onRefresh,
    onViewModeChange,
    viewMode,
  ])

  const visibleQuickActions = useMemo(() => {
    return quickActions.filter((action) => matchesPaletteQuery(action.searchText, normalizedQuery))
  }, [normalizedQuery, quickActions])

  const visibleSortOptions = useMemo(() => {
    return Object.entries(sortLabels)
      .map(([value, label]) => ({ value, label }))
      .filter((option) => matchesPaletteQuery(option.label, normalizedQuery))
  }, [normalizedQuery])

  const visibleLanguages = useMemo(() => {
    const options = [
      { value: null as string | null, label: "All languages", commandValue: "language-all" },
      ...languages.map((language) => ({
        value: language,
        label: language,
        commandValue: `language-${language}`,
      })),
    ]
    return options.filter((option) => matchesPaletteQuery(option.label, normalizedQuery))
  }, [languages, normalizedQuery])

  const visibleCollections = useMemo(() => {
    return collections.filter((collection) => (
      matchesPaletteQuery(`${collection.name} ${collection.emoji ?? ""}`, normalizedQuery)
    ))
  }, [collections, normalizedQuery])

  const visibleTags = useMemo(() => {
    return tags
      .filter((tag) => matchesPaletteQuery(tag.label, normalizedQuery))
      .slice(0, 24)
  }, [normalizedQuery, tags])

  const visibleHealthOptions = useMemo(() => {
    const healthOptions: Array<{ value: RepoHealthFilter | null; label: string; commandValue: string }> = [
      { value: null, label: "All health states", commandValue: "health-all" },
      { value: "archived", label: "Archived repositories", commandValue: "health-archived" },
      { value: "dormant", label: "Dormant repositories", commandValue: "health-dormant" },
    ]
    return healthOptions.filter((option) => matchesPaletteQuery(option.label, normalizedQuery))
  }, [normalizedQuery])

  const visibleSpecialFilters = matchesPaletteQuery("show uncategorized repositories", normalizedQuery)

  const orderedItemMatches = useMemo(() => {
    const matches: Array<{ value: string; matchesQuery: boolean }> = []

    if (query.trim()) {
      matches.push({
        value: `search-${query}`,
        matchesQuery: true,
      })
    }

    visibleQuickActions.forEach((action) => {
      matches.push({ value: action.value, matchesQuery: true })
    })

    visibleSortOptions.forEach((option) => {
      matches.push({ value: `sort-${option.value}`, matchesQuery: true })
    })

    visibleLanguages.forEach((option) => {
      matches.push({ value: option.commandValue, matchesQuery: true })
    })

    visibleCollections.forEach((collection) => {
      matches.push({ value: `collection-${collection.name}`, matchesQuery: true })
    })

    visibleTags.forEach((tag) => {
      matches.push({ value: `tag-${tag.label}`, matchesQuery: true })
    })

    visibleHealthOptions.forEach((option) => {
      matches.push({ value: option.commandValue, matchesQuery: true })
    })

    if (visibleSpecialFilters) {
      matches.push({ value: "uncategorized", matchesQuery: true })
    }

    visibleRepos.forEach((repo) => {
      matches.push({
        value: `repo-${repo.owner}-${repo.name}`,
        matchesQuery: true,
      })
    })

    return matches
  }, [
    query,
    visibleCollections,
    visibleHealthOptions,
    visibleLanguages,
    visibleQuickActions,
    visibleRepos,
    visibleSortOptions,
    visibleSpecialFilters,
    visibleTags,
  ])

  useEffect(() => {
    if (!open) return

    const nextSelection =
      orderedItemMatches.find((item) => item.matchesQuery)?.value ?? orderedItemMatches[0]?.value ?? ""

    // eslint-disable-next-line react-hooks/set-state-in-effect
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
                    <span className="truncate">Filter dashboard for &quot;{query.trim()}&quot;</span>
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

            {visibleQuickActions.length > 0 && (
              <CommandGroup heading="Quick Actions">
                {visibleQuickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <CommandItem
                      key={action.value}
                      value={action.value}
                      onSelect={() => runAndClose(action.onSelect)}
                      disabled={action.disabled}
                      className="rounded-md"
                    >
                      <Icon className={`h-4 w-4 ${action.iconClassName}`} />
                      <span className="flex-1">{action.label}</span>
                      <CommandShortcut>{action.shortcut}</CommandShortcut>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}

            {visibleQuickActions.length > 0 && visibleSortOptions.length > 0 && <CommandSeparator />}

            {visibleSortOptions.length > 0 && (
              <CommandGroup heading="Sort">
                {visibleSortOptions.map(({ value, label }) => (
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
            )}

            {visibleSortOptions.length > 0 && visibleLanguages.length > 0 && <CommandSeparator />}

            {visibleLanguages.length > 0 && (
              <CommandGroup heading="Languages">
                {visibleLanguages.map((option) => (
                  <CommandItem
                    key={option.commandValue}
                    value={option.commandValue}
                    onSelect={() => selectLanguage(option.value)}
                    className="rounded-md"
                  >
                    <Check className={`h-4 w-4 ${languageFilter === option.value ? "opacity-100" : "opacity-0"}`} />
                    <span className="flex-1">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {visibleCollections.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Collections">
                  {visibleCollections.map((collection) => (
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

            {visibleTags.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Tags">
                  {visibleTags.map((tag) => (
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

            {visibleHealthOptions.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Health">
                  {visibleHealthOptions.map((option) => (
                    <CommandItem
                      key={option.commandValue}
                      value={option.commandValue}
                      onSelect={() => selectHealthFilter(option.value)}
                      className="rounded-md"
                    >
                      <Check className={`h-4 w-4 ${healthFilter === option.value ? "opacity-100" : "opacity-0"}`} />
                      <span className="flex-1">{option.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {visibleSpecialFilters && (
              <>
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
              </>
            )}

            {visibleRepos.length > 0 && (
              <>
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
              </>
            )}

            {orderedItemMatches.length === 0 && (
              <div className="py-10">
                <div className="space-y-2 text-center">
                  <p className="font-medium">No results for &quot;{query.trim()}&quot;</p>
                  <p className="text-xs text-muted-foreground">
                    Try a repo name, a language, or a dashboard action.
                  </p>
                </div>
              </div>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
