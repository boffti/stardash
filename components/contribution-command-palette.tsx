"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  Bug,
  Check,
  Code2,
  FileText,
  GitPullRequestArrow,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from "lucide-react"
import type {
  ContributionDifficulty,
  ContributionOpportunity,
  ContributionType,
} from "@/lib/contribution-opportunities"
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
import { useCommandPaletteShortcut } from "@/components/use-command-palette-shortcut"
import { cn } from "@/lib/utils"

type SelectableType = ContributionType | "all"
type SelectableDifficulty = ContributionDifficulty | "all"

const typeIcons: Record<ContributionType, React.ElementType> = {
  bugfix: Bug,
  docs: FileText,
  tests: Check,
  frontend: Sparkles,
  backend: Code2,
  infra: ShieldAlert,
  feature: GitPullRequestArrow,
  maintenance: Wrench,
}

const typeLabels: Record<ContributionType, string> = {
  bugfix: "Bugfix",
  docs: "Docs",
  tests: "Tests",
  frontend: "Frontend",
  backend: "Backend",
  infra: "Infra",
  feature: "Feature",
  maintenance: "Maintenance",
}

const difficultyDotClass: Record<SelectableDifficulty, string> = {
  all: "bg-muted-foreground",
  beginner: "bg-emerald-500",
  intermediate: "bg-amber-500",
  advanced: "bg-rose-500",
}

const difficultyLabels: Record<SelectableDifficulty, string> = {
  all: "All difficulties",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
}

function includesQuery(text: string | null | undefined, query: string): boolean {
  if (!text) return false
  return text.toLowerCase().includes(query)
}

export interface ContributionCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  opportunities: ContributionOpportunity[]
  filteredOpportunities: ContributionOpportunity[]
  language: string
  difficulty: SelectableDifficulty
  contributionType: SelectableType
  languageOptions: [string, number][]
  search: string
  isLoadingOpportunities: boolean
  isRefreshing: boolean
  onLanguageChange: (lang: string) => void
  onDifficultyChange: (diff: SelectableDifficulty) => void
  onContributionTypeChange: (type: SelectableType) => void
  onSearchChange: (text: string) => void
  onScanIssues: () => void
  onRefresh: () => void
  onClearFilters: () => void
}

const DIFFICULTIES: SelectableDifficulty[] = ["all", "beginner", "intermediate", "advanced"]
const CONTRIBUTION_TYPES: ContributionType[] = [
  "bugfix", "docs", "tests", "frontend", "backend", "infra", "feature", "maintenance",
]

export function ContributionCommandPalette({
  open,
  onOpenChange,
  opportunities,
  filteredOpportunities,
  language,
  difficulty,
  contributionType,
  languageOptions,
  search,
  isLoadingOpportunities,
  isRefreshing,
  onLanguageChange,
  onDifficultyChange,
  onContributionTypeChange,
  onSearchChange,
  onScanIssues,
  onRefresh,
  onClearFilters,
}: ContributionCommandPaletteProps) {
  const [query, setQuery] = useState("")
  const [selectedValue, setSelectedValue] = useState("")
  useCommandPaletteShortcut(open, onOpenChange)

  useEffect(() => {
    if (!open) {
      setQuery("")
      setSelectedValue("")
    }
  }, [open])

  const normalizedQuery = query.trim().toLowerCase()
  const hasActiveFilters = Boolean(
    search || language !== "all" || difficulty !== "all" || contributionType !== "all",
  )

  const visibleOpportunities = useMemo(() => {
    const baseList = normalizedQuery ? opportunities : filteredOpportunities
    const matched = normalizedQuery
      ? opportunities.filter(
          (opp) =>
            includesQuery(opp.repoFullName, normalizedQuery) ||
            includesQuery(opp.title, normalizedQuery) ||
            includesQuery(opp.repoLanguage, normalizedQuery) ||
            includesQuery(opp.difficulty, normalizedQuery) ||
            opp.contributionTypes.some((t) => includesQuery(t, normalizedQuery)),
        )
      : baseList
    return matched.slice(0, 20)
  }, [opportunities, filteredOpportunities, normalizedQuery])

  const runAndClose = (action: () => void) => {
    action()
    onOpenChange(false)
  }

  const applySearch = () => {
    if (!query.trim()) return
    runAndClose(() => onSearchChange(query.trim()))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden p-0" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Search Contribution Opportunities</DialogTitle>
          <DialogDescription>
            Search open issues, change filters, and run contribution dashboard actions.
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
              <span className="truncate">Search opportunities, change filters, or run actions</span>
              <KbdGroup className="hidden shrink-0 sm:flex">
                <Kbd>Esc</Kbd>
                <Kbd>Enter</Kbd>
              </KbdGroup>
            </div>
          </div>

          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search issues, jump to a repo, or change filters..."
          />

          <CommandList className="max-h-[min(72vh,640px)] px-2 py-2">
            <CommandEmpty>No matching opportunities or actions found.</CommandEmpty>

            {/* Inline search action */}
            {query.trim() && (
              <CommandGroup heading="Search">
                <CommandItem
                  value={`search-${query}`}
                  onSelect={applySearch}
                  className="rounded-md"
                >
                  <Search className="h-4 w-4" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">Filter opportunities for &quot;{query.trim()}&quot;</span>
                    <span className="text-xs text-muted-foreground">Searches repo names and issue titles</span>
                  </div>
                  <CommandShortcut>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </CommandShortcut>
                </CommandItem>
              </CommandGroup>
            )}

            {/* Opportunities */}
            <CommandGroup heading="Opportunities">
              {visibleOpportunities.length === 0 ? (
                <CommandItem
                  disabled
                  value="no-opportunities"
                  className="rounded-md text-muted-foreground"
                >
                  <Search className="h-4 w-4" />
                  <span>No opportunities loaded yet — run a scan first</span>
                </CommandItem>
              ) : (
                visibleOpportunities.map((opp) => (
                  <CommandItem
                    key={opp.id}
                    value={`opportunity-${opp.id}`}
                    onSelect={() =>
                      runAndClose(() => window.open(opp.htmlUrl, "_blank", "noreferrer"))
                    }
                    className="rounded-md"
                  >
                    <GitPullRequestArrow className="h-4 w-4 shrink-0" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-mono text-sm">{opp.repoFullName}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        #{opp.issueNumber} · {opp.difficulty} · {opp.score}% fit
                      </span>
                    </div>
                    <CommandShortcut>Open</CommandShortcut>
                  </CommandItem>
                ))
              )}
            </CommandGroup>

            <CommandSeparator />

            {/* Actions */}
            <CommandGroup heading="Actions">
              <CommandItem
                value="scan-issues"
                onSelect={() => runAndClose(onScanIssues)}
                disabled={isLoadingOpportunities}
                className="rounded-md"
              >
                {isLoadingOpportunities ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span className="flex-1">Scan for contribution opportunities</span>
                <CommandShortcut>Scan</CommandShortcut>
              </CommandItem>
              <CommandItem
                value="refresh-repos"
                onSelect={() => runAndClose(onRefresh)}
                disabled={isRefreshing}
                className="rounded-md"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                <span className="flex-1">Refresh starred repositories</span>
                <CommandShortcut>Sync</CommandShortcut>
              </CommandItem>
              <CommandItem
                value="clear-filters"
                onSelect={() => runAndClose(onClearFilters)}
                disabled={!hasActiveFilters}
                className="rounded-md"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="flex-1">Clear all filters</span>
                <CommandShortcut>{hasActiveFilters ? "Reset" : "Idle"}</CommandShortcut>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            {/* Language filter */}
            <CommandGroup heading="Language">
              <CommandItem
                value="language-all"
                onSelect={() => runAndClose(() => onLanguageChange("all"))}
                className="rounded-md"
              >
                <Check className={cn("h-4 w-4", language === "all" ? "opacity-100" : "opacity-0")} />
                <span className="flex-1">All languages</span>
              </CommandItem>
              {languageOptions.map(([name, count]) => (
                <CommandItem
                  key={name}
                  value={`language-${name}`}
                  onSelect={() => runAndClose(() => onLanguageChange(name))}
                  className="rounded-md"
                >
                  <Check
                    className={cn("h-4 w-4", language === name ? "opacity-100" : "opacity-0")}
                  />
                  <span className="flex-1">{name}</span>
                  <CommandShortcut>{count}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            {/* Difficulty filter */}
            <CommandGroup heading="Difficulty">
              {DIFFICULTIES.map((diff) => (
                <CommandItem
                  key={diff}
                  value={`difficulty-${diff}`}
                  onSelect={() => runAndClose(() => onDifficultyChange(diff))}
                  className="rounded-md"
                >
                  <Check
                    className={cn("h-4 w-4", difficulty === diff ? "opacity-100" : "opacity-0")}
                  />
                  <span className={cn("h-1.5 w-1.5 rounded-full", difficultyDotClass[diff])} />
                  <span className="flex-1">{difficultyLabels[diff]}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            {/* Contribution type filter */}
            <CommandGroup heading="Contribution Type">
              <CommandItem
                value="type-all"
                onSelect={() => runAndClose(() => onContributionTypeChange("all"))}
                className="rounded-md"
              >
                <Check
                  className={cn("h-4 w-4", contributionType === "all" ? "opacity-100" : "opacity-0")}
                />
                <span className="flex-1">Any type</span>
              </CommandItem>
              {CONTRIBUTION_TYPES.map((value) => {
                const Icon = typeIcons[value]
                return (
                  <CommandItem
                    key={value}
                    value={`type-${value}`}
                    onSelect={() => runAndClose(() => onContributionTypeChange(value))}
                    className="rounded-md"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        contributionType === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{typeLabels[value]}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
