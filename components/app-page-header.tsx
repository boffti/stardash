"use client"

import dynamic from "next/dynamic"
import React, { useState } from "react"
import { Menu, RefreshCw, Search, Sparkles, User as UserIcon } from "lucide-react"
import type { User } from "@supabase/supabase-js"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

const UserMenu = dynamic(
  () => import("@/components/user-menu").then((module) => module.UserMenu),
  {
    ssr: false,
    loading: () => (
      <Button variant="ghost" size="icon" className="rounded-full">
        <Avatar className="h-8 w-8">
          <AvatarFallback>
            <UserIcon className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      </Button>
    ),
  },
)

interface AppPageHeaderProps {
  searchLabel?: string
  onOpenCommandPalette?: () => void
  desktopControls?: React.ReactNode
  mobileControls?: React.ReactNode
  actions?: React.ReactNode
  lastSynced: string | null
  user: User | null
  onCategorize?: () => void
  isCategorizing?: boolean
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function AppPageHeader({
  searchLabel,
  onOpenCommandPalette,
  desktopControls,
  mobileControls,
  actions,
  lastSynced,
  user,
  onCategorize,
  isCategorizing = false,
  onRefresh,
  isRefreshing = false,
}: AppPageHeaderProps) {
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false)
  const hasSearch = Boolean(onOpenCommandPalette && searchLabel)
  const hasMobileControls = Boolean(mobileControls)

  return (
    <>
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <SidebarTrigger className="-ml-1 shrink-0" />

          {hasSearch && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="hidden h-9 min-w-[280px] flex-1 items-center gap-3 rounded-xl border border-border/70 bg-secondary/45 px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground md:inline-flex lg:max-w-[420px]"
              aria-label="Open command palette"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{searchLabel}</span>
              <KbdGroup className="shrink-0">
                <Kbd>Ctrl</Kbd>
                <Kbd>K</Kbd>
              </KbdGroup>
            </button>
          )}

          {desktopControls && (
            <div className="hidden md:flex items-center gap-3">
              {desktopControls}
            </div>
          )}

          {hasMobileControls && (
            <button
              type="button"
              className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded bg-secondary/50 text-foreground hover:bg-secondary/70 shrink-0"
              onClick={() => setMobileControlsOpen((open) => !open)}
              aria-label="Toggle filters"
              title="Filters"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

          {hasSearch && (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded bg-secondary/50 text-foreground hover:bg-secondary/70 shrink-0 md:hidden"
              onClick={onOpenCommandPalette}
              aria-label="Open command palette"
              title="Search"
            >
              <Search className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {actions}
          <button
            type="button"
            onClick={onCategorize}
            disabled={Boolean(isCategorizing) || !onCategorize}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title={isCategorizing ? "Analyzing…" : "Auto-categorize with AI"}
          >
            <Sparkles className={`h-3.5 w-3.5 ${isCategorizing ? "animate-pulse text-violet-400" : ""}`} />
            <span suppressHydrationWarning className="hidden sm:inline">
              {isCategorizing ? "Analyzing…" : "Categorize"}
            </span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={Boolean(isRefreshing) || !onRefresh}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title={isRefreshing ? "Syncing…" : (lastSynced ?? "Sync")}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{isRefreshing ? "Syncing…" : "Refresh"}</span>
          </button>
          <UserMenu user={user} lastSynced={lastSynced} />
        </div>
      </header>

      {hasMobileControls && (
        <div className={mobileControlsOpen ? "block md:hidden border-b border-border bg-background/95" : "hidden md:hidden"}>
          <div className="flex items-center gap-3 px-4 py-2">
            {mobileControls}
          </div>
        </div>
      )}
    </>
  )
}
