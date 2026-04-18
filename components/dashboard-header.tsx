"use client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { User } from "@supabase/supabase-js"
import { AppPageHeader } from "@/components/app-page-header"
import type { RepoHealthFilter } from "@/lib/repo-health"

interface DashboardHeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  sortBy: string
  onSortChange: (value: string) => void
  languageFilter: string | null
  onLanguageFilterChange: (language: string | null) => void
  healthFilter: RepoHealthFilter | null
  onHealthFilterChange: (filter: RepoHealthFilter | null) => void
  languages: string[]
  lastSynced: string | null
  user: User | null
  onRefresh?: () => void | Promise<unknown>
  isRefreshing?: boolean
  onCategorize?: () => void
  isCategorizing?: boolean
  categorizeLimit?: { remaining: number | null; nextAllowedAt: string | null }
  onOpenCommandPalette?: () => void
}

export function DashboardHeader({
  searchQuery,
  onSearchChange: _onSearchChange,
  sortBy,
  onSortChange,
  languageFilter,
  onLanguageFilterChange,
  healthFilter,
  onHealthFilterChange,
  languages,
  lastSynced,
  user,
  onRefresh,
  isRefreshing = false,
  onCategorize,
  isCategorizing = false,
  categorizeLimit,
  onOpenCommandPalette,
}: DashboardHeaderProps) {
  const searchLabel = searchQuery ? `Search: ${searchQuery}` : "Search repositories, tags, and actions"
  const desktopControlClassName =
    "h-10 rounded-xl border border-border/70 bg-secondary/45 text-muted-foreground shadow-none transition-colors hover:bg-accent/60 hover:text-foreground [&_svg]:text-muted-foreground"
  const mobileControlClassName =
    "h-10 rounded-xl border border-border/70 bg-secondary/45 text-muted-foreground shadow-none [&_svg]:text-muted-foreground"

  const filterControls = (
    <>
      <Select
        value={languageFilter ?? "all"}
        onValueChange={(value) => onLanguageFilterChange(value === "all" ? null : value)}
      >
        <SelectTrigger className={`w-32 lg:w-40 ${desktopControlClassName}`}>
          <SelectValue placeholder="Language" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Languages</SelectItem>
          {languages.map((lang) => (
            <SelectItem key={lang} value={lang}>
              {lang}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={healthFilter ?? "all"}
        onValueChange={(value) => onHealthFilterChange(value === "all" ? null : value as RepoHealthFilter)}
      >
        <SelectTrigger className={`w-32 lg:w-36 ${desktopControlClassName}`}>
          <SelectValue placeholder="Health" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Health</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
          <SelectItem value="dormant">Dormant</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortBy} onValueChange={onSortChange}>
        <SelectTrigger className={`w-40 lg:w-52 ${desktopControlClassName}`}>
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="starred-desc">Date Starred (Newest)</SelectItem>
          <SelectItem value="starred-asc">Date Starred (Oldest)</SelectItem>
          <SelectItem value="stars-desc">GitHub Stars (High)</SelectItem>
          <SelectItem value="stars-asc">GitHub Stars (Low)</SelectItem>
          <SelectItem value="updated-desc">Last Updated (Recent)</SelectItem>
          <SelectItem value="name-asc">Name (A-Z)</SelectItem>
        </SelectContent>
      </Select>
    </>
  )

  const mobileFilterControls = (
    <>
      <Select
        value={languageFilter ?? "all"}
        onValueChange={(value) => onLanguageFilterChange(value === "all" ? null : value)}
      >
        <SelectTrigger className={`w-full ${mobileControlClassName}`}>
          <SelectValue placeholder="Language" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Languages</SelectItem>
          {languages.map((lang) => (
            <SelectItem key={lang} value={lang}>
              {lang}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={healthFilter ?? "all"}
        onValueChange={(value) => onHealthFilterChange(value === "all" ? null : value as RepoHealthFilter)}
      >
        <SelectTrigger className={`w-full ${mobileControlClassName}`}>
          <SelectValue placeholder="Health" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Health</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
          <SelectItem value="dormant">Dormant</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortBy} onValueChange={onSortChange}>
        <SelectTrigger className={`w-full ${mobileControlClassName}`}>
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="starred-desc">Date Starred (Newest)</SelectItem>
          <SelectItem value="starred-asc">Date Starred (Oldest)</SelectItem>
          <SelectItem value="stars-desc">GitHub Stars (High)</SelectItem>
          <SelectItem value="stars-asc">GitHub Stars (Low)</SelectItem>
          <SelectItem value="updated-desc">Last Updated (Recent)</SelectItem>
          <SelectItem value="name-asc">Name (A-Z)</SelectItem>
        </SelectContent>
      </Select>
    </>
  )

  return (
    <AppPageHeader
      searchLabel={searchLabel}
      onOpenCommandPalette={onOpenCommandPalette}
      desktopControls={filterControls}
      mobileControls={mobileFilterControls}
      lastSynced={lastSynced}
      user={user}
      onCategorize={onCategorize}
      isCategorizing={isCategorizing}
      categorizeLimit={categorizeLimit}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
    />
  )
}
