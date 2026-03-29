"use client"

import { Search, RefreshCw, Sparkles } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { UserMenu } from "@/components/user-menu"
import type { User } from "@supabase/supabase-js"

interface DashboardHeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  sortBy: string
  onSortChange: (value: string) => void
  languageFilter: string | null
  onLanguageFilterChange: (language: string | null) => void
  languages: string[]
  lastSynced: string | null
  user: User | null
  onRefresh?: () => void
  isRefreshing?: boolean
  onCategorize?: () => void
  isCategorizing?: boolean
}

export function DashboardHeader({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  languageFilter,
  onLanguageFilterChange,
  languages,
  lastSynced,
  user,
  onRefresh,
  isRefreshing = false,
  onCategorize,
  isCategorizing = false,
}: DashboardHeaderProps) {

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-1" />

        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search repos, notes, tags..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <Select
          value={languageFilter ?? "all"}
          onValueChange={(value) => onLanguageFilterChange(value === "all" ? null : value)}
        >
          <SelectTrigger className="w-40 bg-secondary border-0">
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

        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="w-52 bg-secondary border-0">
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
      </div>

      <div className="flex items-center gap-3">
        <button
          key="categorize-btn"
          type="button"
          onClick={onCategorize}
          disabled={Boolean(isCategorizing)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title="Auto-categorize with AI"
        >
          <Sparkles className={`h-3.5 w-3.5 ${isCategorizing ? 'animate-pulse text-violet-400' : ''}`} />
          {isCategorizing && <span className="text-violet-400">Analyzing…</span>}
        </button>

        <button
          key="refresh-btn"
          type="button"
          onClick={onRefresh}
          disabled={Boolean(isRefreshing)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title={isRefreshing ? "Syncing…" : (lastSynced ?? "Sync")}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing && <span>Syncing…</span>}
        </button>

        <UserMenu user={user} lastSynced={lastSynced} />
      </div>
    </header>
  )
}
