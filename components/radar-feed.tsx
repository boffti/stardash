"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import useSWR, { mutate as globalMutate } from "swr"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  ExternalLink,
  Flame,
  GitFork,
  Loader2,
  MoonStar,
  RefreshCw,
  Sparkles,
  Star,
  Telescope,
  TrendingUp,
  Users,
  X,
} from "lucide-react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppPageHeader } from "@/components/app-page-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { chipHue } from "@/lib/more-color"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useI18n } from "@/components/i18n-provider"
import { Skeleton } from "@/components/ui/skeleton"
import { SearchStarPopover } from "@/components/search-star-popover"
import { TrendingSections } from "@/components/trending-sections"
import { ReleasesInbox } from "@/components/releases-inbox"
import { useUser } from "@/components/providers/user-provider"
import { useStarredRepos } from "@/lib/use-starred-repos"
import { LANGUAGE_COLORS, type UserMetadata } from "@/lib/types"
import type { RadarReasonKind } from "@/lib/radar"
import type { RadarItem, RadarResponse } from "@/app/api/radar/route"
import { cn } from "@/lib/utils"

const RADAR_KEY = "/api/radar"
const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Tab = "inbox" | "releases" | "stars"
type Filter = "all" | "following" | "hn" | "velocity" | "new"

const FILTERS: { id: Filter; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "On the radar", icon: Telescope },
  { id: "following", label: "People you follow", icon: Users },
  { id: "hn", label: "Hacker News", icon: Flame },
  { id: "velocity", label: "Rising", icon: TrendingUp },
  { id: "new", label: "New this week", icon: Sparkles },
]

// One hue per signal kind, used for the reason dots and the signal badge.
const KIND_DOT: Record<RadarReasonKind, string> = {
  following: "bg-muted-foreground/70",
  hn: "bg-muted-foreground/70",
  velocity: "bg-muted-foreground/70",
  new: "bg-muted-foreground/70",
  topic: "bg-muted-foreground/70",
  language: "bg-muted-foreground/70",
}

const KIND_LABEL: Partial<Record<RadarReasonKind, string>> = {
  following: "People you follow",
  hn: "Hacker News",
  velocity: "Rising",
  new: "New this week",
}

function formatNumber(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : n.toString()
}

async function sendAction(
  githubRepoId: number,
  action: "dismissed" | "snoozed" | "starred" | "undo",
) {
  const res = await fetch("/api/radar/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ githubRepoId, action }),
  })
  if (!res.ok) throw new Error("Action failed")
}

export function RadarFeed() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawTab = searchParams.get("tab")
  const tab: Tab = rawTab === "stars" || rawTab === "releases" ? rawTab : "inbox"
  const setTab = (next: Tab) =>
    router.replace(next === "inbox" ? "/radar" : `/radar?tab=${next}`, { scroll: false })
  const { user } = useUser()
  const { data: starData } = useStarredRepos(user?.id)
  const { data: metadata } = useSWR<UserMetadata>(user?.id ? "/api/user/metadata" : null, fetcher, {
    revalidateOnFocus: false,
  })
  const { data, error, isLoading, mutate } = useSWR<RadarResponse & { error?: string }>(
    RADAR_KEY,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  )

  const [filter, setFilter] = useState<Filter>("all")
  const [hidden, setHidden] = useState<Set<number>>(new Set())
  const [cursor, setCursor] = useState(0)
  const [scanning, setScanning] = useState(false)

  const items = useMemo(() => {
    const all = (data?.items ?? []).filter((i) => !hidden.has(i.id))
    if (filter === "all") return all
    return all.filter((i) => i.reasons.some((r) => r.kind === filter))
  }, [data?.items, hidden, filter])

  // Clamp instead of resetting in an effect: rows vanish on triage, cursor stays put.
  const activeIndex = Math.min(cursor, Math.max(0, items.length - 1))

  const hide = useCallback((id: number) => {
    setHidden((prev) => new Set(prev).add(id))
  }, [])

  const unhide = useCallback((id: number) => {
    setHidden((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const triage = useCallback(
    async (item: RadarItem, action: "dismissed" | "snoozed") => {
      hide(item.id)
      try {
        await sendAction(item.id, action)
        toast(
          action === "dismissed"
            ? t(`Dismissed ${item.fullName}`, `已忽略 ${item.fullName}`)
            : t(`Snoozed ${item.fullName} for a week`, `已将 ${item.fullName} 暂缓一周`),
          {
            action: {
              label: t("Undo", "撤销"),
              onClick: async () => {
                unhide(item.id)
                await sendAction(item.id, "undo").catch(() => hide(item.id))
              },
            },
          },
        )
      } catch {
        unhide(item.id)
        toast.error(t("Could not save. Try again.", "保存失败，请重试。"))
      }
    },
    [hide, unhide, t],
  )

  const onStarred = useCallback(
    (item: RadarItem) => {
      hide(item.id)
      void sendAction(item.id, "starred").catch(() => {})
      void globalMutate("/api/user/metadata")
    },
    [hide],
  )

  const scanNow = useCallback(async () => {
    setScanning(true)
    try {
      const res = await fetch("/api/radar/scan", { method: "POST" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error ?? t("Scan failed", "扫描失败"))
        return
      }
      await mutate()
      toast.success(
        t(`Scanned ${body.candidates ?? 0} repositories`, `已扫描 ${body.candidates ?? 0} 个仓库`),
      )
    } finally {
      setScanning(false)
    }
  }, [mutate, t])

  // Keyboard triage: j/k move, x dismiss, z snooze, o open. Releases has its own.
  useEffect(() => {
    if (tab !== "inbox") return
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return
      if (target?.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return
      const current = items[activeIndex]
      switch (e.key) {
        case "j":
          setCursor((c) => Math.min(items.length - 1, c + 1))
          break
        case "k":
          setCursor((c) => Math.max(0, c - 1))
          break
        case "x":
          if (current) void triage(current, "dismissed")
          break
        case "z":
          if (current) void triage(current, "snoozed")
          break
        case "o":
          if (current) window.open(current.htmlUrl, "_blank", "noopener")
          break
        default:
          return
      }
      e.preventDefault()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [tab, items, activeIndex, triage])

  const pointerMoved = useRef(false)
  useEffect(() => {
    if (pointerMoved.current) {
      pointerMoved.current = false
      return
    }
    document
      .getElementById(`radar-row-${items[activeIndex]?.id}`)
      ?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, items])

  const collections = metadata?.collections ?? []
  const tags = metadata?.tags ?? []
  const totalStars = starData?.repos.length ?? 0
  const uncategorizedCount = useMemo(
    () =>
      (starData?.repos ?? []).filter((r) => r.tags.length === 0 && r.collections.length === 0)
        .length,
    [starData?.repos],
  )

  const counts = useMemo(() => {
    const visible = (data?.items ?? []).filter((i) => !hidden.has(i.id))
    const c: Record<Filter, number> = {
      all: visible.length,
      following: 0,
      hn: 0,
      velocity: 0,
      new: 0,
    }
    for (const item of visible) {
      for (const kind of new Set(item.reasons.map((r) => r.kind))) {
        if (kind in c && kind !== "topic" && kind !== "language") c[kind as Filter]++
      }
    }
    return c
  }, [data?.items, hidden])

  const neverScanned = !isLoading && !error && data && data.total === 0 && !data.scannedAt
  const fewStars = Boolean(data && data.starCount < 10)
  const hasInbox = Boolean(data && data.total > 0)

  const scanButton = (size: "sm" | "default" = "sm") => (
    <Button
      variant="outline"
      size={size}
      onClick={scanNow}
      disabled={scanning}
      className="gap-1.5"
      title={t("Scan for repositories", "扫描仓库")}
    >
      {scanning ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      {scanning ? t("Scanning…", "扫描中…") : t("Scan now", "立即扫描")}
    </Button>
  )

  return (
    <SidebarProvider>
      <AppSidebar
        collections={collections}
        tags={tags}
        selectedCollection={null}
        selectedTag={null}
        showUncategorized={false}
        onSelectCollection={() => {}}
        onSelectTag={() => {}}
        onShowUncategorized={() => {}}
        totalStars={totalStars}
        uncategorizedCount={uncategorizedCount}
        userId={user?.id}
      />
      <SidebarInset className="overflow-x-clip">
        <AppPageHeader lastSynced={null} hideNavActions />

        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-8">
          <section className="mb-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">{t("Radar", "雷达")}</h1>
              </div>
              {tab === "inbox" && scanButton()}
            </div>

            <div
              className="flex gap-1 border-b border-border/60"
              role="tablist"
              aria-label={t("Radar views", "雷达视图")}
            >
              {(
                [
                  ["inbox", t("Inbox", "收件箱")],
                  ["releases", t("Releases", "版本发布")],
                  ["stars", t("From your stars", "来自星标")],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm",
                    tab === id
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {tab === "stars" && <TrendingSections />}

          {tab === "releases" && <ReleasesInbox />}

          {tab === "inbox" && (
            <>
              {hasInbox && (
                <div
                  className="mb-5 flex flex-wrap items-center gap-1"
                  role="tablist"
                  aria-label={t("Filter signals", "筛选动态")}
                >
                  {FILTERS.map((f) => {
                    const active = filter === f.id
                    const Icon = f.icon
                    return (
                      <button
                        key={f.id}
                        role="tab"
                        aria-selected={active}
                        onClick={() => setFilter(f.id)}
                        className={cn(
                          "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[13px]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                        )}
                      >
                        <Icon className="size-3.5 text-muted-foreground" />
                        <span className="tabular-nums">{counts[f.id]}</span>
                        <span>
                          {t(
                            f.label,
                            {
                              all: "全部",
                              following: "关注的人",
                              hn: "Hacker News",
                              velocity: "上升中",
                              new: "本周新增",
                            }[f.id],
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="grid gap-6">
                <div className="min-w-0">
                  {isLoading && (
                    <div className="flex flex-col gap-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-36 rounded-lg" />
                      ))}
                    </div>
                  )}

                  {error && (
                    <RadarEmpty
                      title={t("Could not load Radar", "无法加载雷达")}
                      body={t("Reload the page to try again.", "重新加载页面以重试。")}
                    />
                  )}

                  {neverScanned && (
                    <RadarEmpty
                      title={t("No repositories yet", "暂无仓库")}
                      body={
                        fewStars
                          ? t("Star some repositories, then scan.", "先收藏一些仓库，然后扫描。")
                          : t("Scan for new repositories.", "扫描新仓库。")
                      }
                      action={scanButton("default")}
                    />
                  )}

                  {hasInbox && items.length === 0 && (
                    <RadarEmpty
                      title={
                        filter === "all"
                          ? t("All caught up", "已处理全部动态")
                          : t("Nothing here", "暂无动态")
                      }
                      body={
                        filter === "all"
                          ? t("New signals arrive after the next scan.", "下次扫描后会出现新动态。")
                          : t("Try another filter or scan again.", "试试其他筛选条件，或重新扫描。")
                      }
                    />
                  )}

                  {items.length > 0 && (
                    <ol className="flex flex-col gap-3">
                      {items.map((item, index) => (
                        <RadarRow
                          key={item.id}
                          item={item}
                          active={index === activeIndex}
                          tags={tags}
                          collections={collections}
                          onFocus={() => {
                            pointerMoved.current = true
                            setCursor(index)
                          }}
                          onStarred={() => onStarred(item)}
                          onDismiss={() => triage(item, "dismissed")}
                          onSnooze={() => triage(item, "snoozed")}
                        />
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

// Hacker News reasons keep their discussion link wherever they render.
function ReasonText({ reason, hn }: { reason: RadarItem["reasons"][number]; hn: RadarItem["hn"] }) {
  if (reason.kind === "hn" && hn) {
    return (
      <a href={hn.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
        {reason.text}
      </a>
    )
  }
  return <>{reason.text}</>
}

function RadarEmpty({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <Empty className="min-h-64 bg-transparent">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Telescope />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{body}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}

function RadarRow({
  item,
  active,
  tags,
  collections,
  onFocus,
  onStarred,
  onDismiss,
  onSnooze,
}: {
  item: RadarItem
  active: boolean
  tags: UserMetadata["tags"]
  collections: UserMetadata["collections"]
  onFocus: () => void
  onStarred: () => void
  onDismiss: () => void
  onSnooze: () => void
}) {
  const { t } = useI18n()
  const langColor = item.language ? (LANGUAGE_COLORS[item.language] ?? "#64748b") : null
  const age = item.ghCreatedAt
    ? formatDistanceToNow(new Date(item.ghCreatedAt), { addSuffix: false })
    : null
  // The strongest signal gets the badge; topic and language matches read as the evidence line.
  const signal = item.reasons.find((r) => KIND_LABEL[r.kind])
  const evidence = item.reasons.filter((r) => r !== signal)

  return (
    <li
      id={`radar-row-${item.id}`}
      data-active={active || undefined}
      onMouseEnter={onFocus}
      className={cn(
        "group rounded-lg border border-border bg-card",
        active ? "bg-muted" : "hover:bg-muted",
      )}
    >
      <div className="p-4">
        <div className="flex gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={item.avatarUrl} alt="" />
            <AvatarFallback className="text-xs">{item.owner[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <a
                  href={item.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/link inline-flex min-h-6 max-w-full items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span className="min-w-0 truncate font-mono text-sm font-medium text-foreground transition-colors group-hover/link:text-primary">
                    <span className="text-muted-foreground">{item.owner}/</span>
                    {item.name}
                  </span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/0 transition-colors group-hover/link:text-muted-foreground" />
                </a>
                {evidence.length > 0 && (
                  <ul className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/80">
                    {evidence.map((r) => (
                      <li key={r.kind + r.text} className="flex items-center gap-1.5">
                        <span
                          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", KIND_DOT[r.kind])}
                        />
                        <ReasonText reason={r} hn={item.hn} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {signal && (
                <span className="inline-flex max-w-full min-h-6 items-start gap-1.5 self-start rounded-full bg-background/60 px-2.5 py-1 text-[11px] leading-4 font-medium text-foreground/90 [overflow-wrap:anywhere] sm:max-w-[40%]">
                  <span
                    className={cn(
                      "mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full",
                      KIND_DOT[signal.kind],
                    )}
                  />
                  <ReasonText reason={signal} hn={item.hn} />
                </span>
              )}
            </div>

            {item.description && (
              <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            {item.language && (
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: langColor ?? undefined }}
                />
                {item.language}
              </span>
            )}
            <span className="flex items-center gap-1 tabular-nums">
              <Star className="h-3 w-3" />
              {formatNumber(item.stargazersCount)}
              {item.starsDelta7d !== null && item.starsDelta7d >= 100 && (
                <span className="text-violet-400">+{formatNumber(item.starsDelta7d)}</span>
              )}
            </span>
            <span className="flex items-center gap-1 tabular-nums">
              <GitFork className="h-3 w-3" />
              {formatNumber(item.forksCount)}
            </span>
            {age && <span className="text-muted-foreground/70">{age} old</span>}
            {item.topics.slice(0, 3).map((t) => (
              <Badge
                key={t}
                variant="secondary"
                data-hue={chipHue(t)}
                className="hidden h-5 px-1.5 py-0 text-xs font-normal sm:inline-flex"
              >
                {t}
              </Badge>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onSnooze}
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                aria-label={t(`Snooze ${item.fullName} for a week`, `将 ${item.fullName} 暂缓一周`)}
              >
                <MoonStar className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("Snooze", "暂缓")}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                aria-label={t(`Dismiss ${item.fullName}`, `忽略 ${item.fullName}`)}
              >
                <X className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("Dismiss", "忽略")}</span>
              </Button>
            </div>
            <SearchStarPopover
              repo={item}
              tags={tags}
              collections={collections}
              onStarred={onStarred}
            />
          </div>
        </div>
      </div>
    </li>
  )
}
