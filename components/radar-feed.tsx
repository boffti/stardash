"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Kbd } from "@/components/ui/kbd"
import { Skeleton } from "@/components/ui/skeleton"
import { SearchStarPopover } from "@/components/search-star-popover"
import { TrendingSections } from "@/components/trending-sections"
import { useUser } from "@/components/providers/user-provider"
import { useStarredRepos } from "@/lib/use-starred-repos"
import { LANGUAGE_COLORS, type UserMetadata } from "@/lib/types"
import type { RadarReasonKind } from "@/lib/radar"
import type { RadarItem, RadarResponse } from "@/app/api/radar/route"
import { cn } from "@/lib/utils"

const RADAR_KEY = "/api/radar"
const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Filter = "all" | "following" | "hn" | "velocity" | "new"

// Same tile vocabulary as Intel's stats row: icon chip, big number, small label.
const FILTERS: { id: Filter; label: string; icon: React.ElementType; chip: string }[] = [
  { id: "all", label: "On the radar", icon: Telescope, chip: "bg-muted text-foreground" },
  {
    id: "following",
    label: "People you follow",
    icon: Users,
    chip: "bg-accent/15 text-accent",
  },
  { id: "hn", label: "Hacker News", icon: Flame, chip: "bg-orange-500/10 text-orange-400" },
  { id: "velocity", label: "Rising", icon: TrendingUp, chip: "bg-violet-500/10 text-violet-400" },
  { id: "new", label: "New this week", icon: Sparkles, chip: "bg-sky-500/10 text-sky-400" },
]

// One hue per signal kind, used for the reason dots and the signal badge.
const KIND_DOT: Record<RadarReasonKind, string> = {
  following: "bg-accent",
  hn: "bg-orange-400",
  velocity: "bg-violet-400",
  new: "bg-sky-400",
  topic: "bg-muted-foreground/60",
  language: "bg-muted-foreground/60",
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab: "inbox" | "stars" = searchParams.get("tab") === "stars" ? "stars" : "inbox"
  const setTab = (next: "inbox" | "stars") =>
    router.replace(next === "stars" ? "/radar?tab=stars" : "/radar", { scroll: false })
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
            ? `Dismissed ${item.fullName}`
            : `Snoozed ${item.fullName} for a week`,
          {
            action: {
              label: "Undo",
              onClick: async () => {
                unhide(item.id)
                await sendAction(item.id, "undo").catch(() => hide(item.id))
              },
            },
          },
        )
      } catch {
        unhide(item.id)
        toast.error("Couldn't save that. Try again.")
      }
    },
    [hide, unhide],
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
        toast.error(body.error ?? "Scan failed")
        return
      }
      await mutate()
      toast.success(
        `Scanned ${body.candidates ?? 0} repos across GitHub, Hacker News and people you follow`,
      )
    } finally {
      setScanning(false)
    }
  }, [mutate])

  // Keyboard triage: j/k move, x dismiss, z snooze, o open.
  useEffect(() => {
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
  }, [items, activeIndex, triage])

  useEffect(() => {
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

  const scannedAgo = data?.scannedAt
    ? formatDistanceToNow(new Date(data.scannedAt), { addSuffix: true })
    : null
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
      title="Pull fresh signals from GitHub, Hacker News and people you follow"
    >
      {scanning ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      {scanning ? "Scanning…" : "Scan now"}
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
      <SidebarInset className="overflow-x-hidden">
        <AppPageHeader lastSynced={null} hideNavActions />

        <main className="flex-1 p-6">
          <section className="mb-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">Radar</h1>
                <p className="text-sm text-muted-foreground">
                  New and rising repos, ranked by how well they fit your stars.
                  {scannedAgo && (
                    <span className="text-muted-foreground/60"> Scanned {scannedAgo}.</span>
                  )}
                </p>
              </div>
              {scanButton()}
            </div>

            <div
              className="flex gap-1 border-b border-border/60"
              role="tablist"
              aria-label="Radar views"
            >
              {(
                [
                  ["inbox", "Inbox"],
                  ["stars", "From your stars"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm transition-colors duration-200",
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

          {tab === "inbox" && (
            <>
              {hasInbox && (
                <div
                  className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
                  role="tablist"
                  aria-label="Filter signals"
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
                          "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors duration-200",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "border-foreground/40 bg-muted/30"
                            : "border-border/60 bg-card hover:border-muted-foreground/30",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                            f.chip,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-lg font-semibold leading-none tabular-nums">
                            {counts[f.id]}
                          </span>
                          <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                            {f.label}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_16rem]">
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
                      title="Radar couldn't load."
                      body="Reload the page. If it keeps failing, the nightly scan may not have run yet."
                    />
                  )}

                  {neverScanned && (
                    <RadarEmpty
                      title="Nothing on the radar yet."
                      body={
                        fewStars
                          ? "Star a handful of repos first so Radar knows your taste, then scan."
                          : "The first scan pulls new repos from GitHub, Hacker News and the people you follow."
                      }
                      action={scanButton("default")}
                    />
                  )}

                  {hasInbox && items.length === 0 && (
                    <RadarEmpty
                      title={filter === "all" ? "You're caught up." : "Nothing here right now."}
                      body={
                        filter === "all"
                          ? "Everything has been starred, snoozed or dismissed. New signals land overnight."
                          : "Try another filter, or scan now to pull fresh signals."
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
                          onFocus={() => setCursor(index)}
                          onStarred={() => onStarred(item)}
                          onDismiss={() => triage(item, "dismissed")}
                          onSnooze={() => triage(item, "snoozed")}
                        />
                      ))}
                    </ol>
                  )}
                </div>

                {hasInbox && (
                  <aside className="hidden xl:block">
                    <div className="sticky top-20 flex flex-col gap-4">
                      <div className="rounded-lg border border-border/60 bg-card">
                        <div className="border-b border-border/40 px-4 py-3 text-sm font-medium">
                          Keyboard
                        </div>
                        <dl className="flex flex-col gap-2 px-4 py-3 text-xs text-muted-foreground">
                          <ShortcutRow keys={["j", "k"]} label="Move" />
                          <ShortcutRow keys={["x"]} label="Dismiss" />
                          <ShortcutRow keys={["z"]} label="Snooze a week" />
                          <ShortcutRow keys={["o"]} label="Open on GitHub" />
                        </dl>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-card">
                        <div className="border-b border-border/40 px-4 py-3 text-sm font-medium">
                          How it ranks
                        </div>
                        <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                          A taste profile built from your stars scores every candidate. A star from
                          someone you follow outranks a topic match. Dismissed repos stay gone;
                          snoozed ones return in a week.
                        </p>
                      </div>
                    </div>
                  </aside>
                )}
              </div>
            </>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt>{label}</dt>
      <dd className="flex items-center gap-1">
        {keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </dd>
    </div>
  )
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
    <Empty className="min-h-64 border border-border/60 bg-card">
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
        "group rounded-lg border bg-card transition-colors duration-150",
        active
          ? "border-foreground/40 bg-muted/20"
          : "border-border/60 hover:border-muted-foreground/30",
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
                        {r.text}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {signal && (
                <span
                  className={cn(
                    "inline-flex h-6 shrink-0 items-center gap-1.5 self-start rounded-full border border-border/60 bg-background/60 px-2.5 text-[11px] font-medium text-foreground/90",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", KIND_DOT[signal.kind])} />
                  {signal.kind === "hn" && item.hn ? (
                    <a
                      href={item.hn.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {signal.text}
                    </a>
                  ) : (
                    signal.text
                  )}
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

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
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
                className="hidden h-5 px-1.5 py-0 text-xs font-normal sm:inline-flex"
              >
                {t}
              </Badge>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 group-data-[active]:opacity-100 max-sm:opacity-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={onSnooze}
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                aria-label={`Snooze ${item.fullName} for a week`}
              >
                <MoonStar className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Snooze</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                aria-label={`Dismiss ${item.fullName}`}
              >
                <X className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Dismiss</span>
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
