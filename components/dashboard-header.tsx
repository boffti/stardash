"use client"

import { Search, RefreshCw, Sparkles, Menu } from "lucide-react"
import React, { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { UserMenu } from "@/components/user-menu"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
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
  onOpenCommandPalette?: () => void
}

export function DashboardHeader({
  searchQuery,
  onSearchChange: _onSearchChange,
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
  onOpenCommandPalette,
}: DashboardHeaderProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const searchLabel = searchQuery ? `Search: ${searchQuery}` : "Search repositories, tags, and actions"

  return (
    <>
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Left side: Sidebar trigger, Search, Filters (desktop) */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <SidebarTrigger className="-ml-1 shrink-0" />

          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="hidden h-10 min-w-[280px] flex-1 items-center gap-3 rounded-xl border border-border/70 bg-secondary/45 px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground md:inline-flex lg:max-w-[420px]"
            aria-label="Open command palette"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{searchLabel}</span>
            <KbdGroup className="shrink-0">
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </button>

          {/* Desktop filters */}
          <div className="hidden md:flex items-center gap-3">
            <Select
              value={languageFilter ?? "all"}
              onValueChange={(value) => onLanguageFilterChange(value === "all" ? null : value)}
            >
              <SelectTrigger className="w-32 lg:w-40 bg-secondary border-0">
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
              <SelectTrigger className="w-40 lg:w-52 bg-secondary border-0">
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

          {/* Mobile filter toggle */}
          <button
            type="button"
            className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded bg-secondary/50 text-foreground hover:bg-secondary/70 shrink-0"
            onClick={() => setMobileFiltersOpen((s) => !s)}
            aria-label="Toggle filters"
            title="Filters"
          >
            <Menu className="h-4 w-4" />
          </button>

          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded bg-secondary/50 text-foreground hover:bg-secondary/70 shrink-0 md:hidden"
            onClick={onOpenCommandPalette}
            aria-label="Open command palette"
            title="Search"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        {/* Right side: AI, Refresh, User */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            key="categorize-btn"
            type="button"
            onClick={onCategorize}
            disabled={Boolean(isCategorizing)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Auto-categorize with AI"
          >
            <Sparkles className={`h-3.5 w-3.5 ${isCategorizing ? 'animate-pulse text-violet-400' : ''}`} />
            <span className="hidden sm:inline">{isCategorizing && 'Analyzing…'}</span>
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
            <span className="hidden sm:inline">{isRefreshing && 'Syncing…'}</span>
          </button>

          <UserMenu user={user} lastSynced={lastSynced} />
        </div>
      </header>

      {/* Mobile collapsible filters panel */}
      <div className={mobileFiltersOpen ? 'block md:hidden border-b border-border bg-background/95' : 'hidden md:hidden'}>
        <div className="flex items-center gap-3 px-4 py-2">
          <Select
            value={languageFilter ?? "all"}
            onValueChange={(value) => onLanguageFilterChange(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-full bg-secondary border-0">
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
            <SelectTrigger className="w-full bg-secondary border-0">
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
      </div>
    </>
  )
}
