"use client"

import dynamic from "next/dynamic"
import { useI18n } from "@/components/i18n-provider"
import React, { useState } from "react"
import {
  Menu,
  MessageCircleQuestion,
  RefreshCw,
  Search,
  Sparkles,
  User as UserIcon,
} from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatWhen } from "@/lib/utils"
import { useOptionalCommandPalette } from "@/components/command-palette"

const UserMenu = dynamic(() => import("@/components/user-menu").then((module) => module.UserMenu), {
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
})

interface AppPageHeaderProps {
  searchLabel?: string
  searchShortcutLabel?: string
  desktopControls?: React.ReactNode
  mobileControls?: React.ReactNode
  actions?: React.ReactNode
  lastSynced: string | null
  onCategorize?: () => void
  isCategorizing?: boolean
  categorizeLimit?: { remaining: number | null; nextAllowedAt: string | null }
  onRefresh?: () => void | Promise<unknown>
  isRefreshing?: boolean
  /** Hides the Categorize and Sync ghost buttons. Use on pages that don't need them. */
  hideNavActions?: boolean
}

export function AppPageHeader({
  searchLabel = "Search",
  searchShortcutLabel = "⌘",
  desktopControls,
  mobileControls,
  actions,
  lastSynced,
  onCategorize,
  isCategorizing = false,
  categorizeLimit,
  onRefresh,
  isRefreshing = false,
  hideNavActions = false,
}: AppPageHeaderProps) {
  const { t } = useI18n()
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false)
  const [localRefreshing, setLocalRefreshing] = useState(false)

  const spinning = localRefreshing || isRefreshing

  const handleRefreshClick = async () => {
    if (!onRefresh || spinning) return
    setLocalRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setLocalRefreshing(false)
    }
  }

  const palette = useOptionalCommandPalette()
  const onOpenCommandPalette = () => palette?.setOpen(true)
  const hasSearch = Boolean(palette)
  const hasMobileControls = Boolean(mobileControls)

  return (
    <>
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <SidebarTrigger className="-ml-1 shrink-0" />

          {hasSearch && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="hidden h-9 min-w-0 flex-1 items-center gap-3 rounded-md border border-transparent bg-muted/40 px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground md:inline-flex lg:max-w-[320px]"
              aria-label={t("Open command palette", "打开命令面板")}
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{searchLabel}</span>
              <KbdGroup className="shrink-0">
                <Kbd>{searchShortcutLabel}</Kbd>
                <Kbd>K</Kbd>
              </KbdGroup>
            </button>
          )}

          {hasSearch && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => palette?.openAsk()}
              className="h-9 shrink-0 gap-1.5 rounded-xl px-2.5 text-muted-foreground hover:text-foreground"
              aria-label={t("Ask your stars", "询问收藏")}
              title={t("Ask your stars a question", "向收藏提问")}
            >
              <MessageCircleQuestion className="h-4 w-4" />
              <span className="hidden lg:inline">{t("Ask", "提问")}</span>
            </Button>
          )}

          {desktopControls && (
            <div className="hidden xl:flex items-center gap-3">{desktopControls}</div>
          )}

          {hasMobileControls && (
            <button
              type="button"
              className="xl:hidden inline-flex h-8 w-8 items-center justify-center rounded bg-secondary/50 text-foreground hover:bg-secondary/70 shrink-0"
              onClick={() => setMobileControlsOpen((open) => !open)}
              aria-label={t("Toggle filters", "切换筛选")}
              title={t("Filters", "筛选")}
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

          {hasSearch && (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded bg-secondary/50 text-foreground hover:bg-secondary/70 shrink-0 md:hidden"
              onClick={onOpenCommandPalette}
              aria-label={t("Open command palette", "打开命令面板")}
              title={t("Search", "搜索")}
            >
              <Search className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="ml-3 flex shrink-0 items-center gap-2 sm:gap-3">
          {actions}
          {!hideNavActions && (
            <>
              {(() => {
                const isCategorizeLimited = categorizeLimit?.remaining === 0
                const categorizeTooltip = isCategorizing
                  ? "Analyzing…"
                  : isCategorizeLimited && categorizeLimit?.nextAllowedAt
                    ? `Runs once a week. Next run ${formatWhen(categorizeLimit.nextAllowedAt)}`
                    : "AI categorize"
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <button
                          type="button"
                          onClick={onCategorize}
                          disabled={Boolean(isCategorizing) || !onCategorize || isCategorizeLimited}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Sparkles
                            className={`h-3.5 w-3.5 ${isCategorizing ? "animate-pulse text-violet-400" : ""}`}
                          />
                          <span suppressHydrationWarning className="hidden sm:inline">
                            {isCategorizing ? t("Analyzing…", "分析中…") : t("Categorize", "分类")}
                          </span>
                        </button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{categorizeTooltip}</TooltipContent>
                  </Tooltip>
                )
              })()}
              <button
                type="button"
                onClick={handleRefreshClick}
                aria-disabled={spinning || !onRefresh}
                className={`flex items-center gap-1.5 text-xs transition-colors ${spinning ? "text-blue-400 cursor-default" : !onRefresh ? "text-muted-foreground opacity-50 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"}`}
                title={spinning ? "Syncing…" : (lastSynced ?? "Sync")}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">
                  {spinning ? t("Syncing…", "同步中…") : t("Sync", "同步")}
                </span>
              </button>
            </>
          )}
          <UserMenu lastSynced={lastSynced} />
        </div>
      </header>

      {hasMobileControls && (
        <div
          className={
            mobileControlsOpen
              ? "block xl:hidden border-b border-border bg-background/95"
              : "hidden"
          }
        >
          <div className="flex flex-wrap items-center gap-3 px-4 py-2 [&>*]:min-w-[10rem] [&>*]:flex-1">
            {mobileControls}
          </div>
        </div>
      )}
    </>
  )
}
