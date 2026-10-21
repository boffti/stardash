"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  ExternalLink,
  GitFork,
  Loader2,
  MoonStar,
  RefreshCw,
  Star,
  Telescope,
  X,
} from "lucide-react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppPageHeader } from "@/components/app-page-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Skeleton } from "@/components/ui/skeleton"
import { SearchStarPopover } from "@/components/search-star-popover"
import { useUser } from "@/components/providers/user-provider"
import { useStarredRepos } from "@/lib/use-starred-repos"
import { LANGUAGE_COLORS, type UserMetadata } from "@/lib/types"
import type { RadarReasonKind } from "@/lib/radar"
import type { RadarItem, RadarResponse } from "@/app/api/radar/route"
import { cn } from "@/lib/utils"

const RADAR_KEY = "/api/radar"
const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Filter = "all" | "following" | "hn" | "velocity" | "new"

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "following", label: "People you follow" },
  { id: "hn", label: "Hacker News" },
  { id: "velocity", label: "Rising" },
  { id: "new", label: "New this week" },
]

// One hue per signal kind; used on the row rail, the reason dot, and the filter pill.
const KIND_COLOR: Record<RadarReasonKind, string> = {
  following: "bg-accent",
  hn: "bg-orange-400",
  velocity: "bg-violet-400",
  new: "bg-sky-400",
  topic: "bg-muted-foreground/60",
  language: "bg-muted-foreground/60",
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

  // Keyboard triage: j/k move, s star, x dismiss, z snooze, o open.
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
        <AppPageHeader
          lastSynced={null}
          hideNavActions
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={scanNow}
              disabled={scanning}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              title="Pull fresh signals from GitHub, Hacker News and people you follow"
            >
              {scanning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{scanning ? "Scanning…" : "Scan now"}</span>
            </Button>
          }
        />

        <main className="flex-1 px-6 py-6">
          <div className="mx-auto w-full max-w-3xl">
            <header className="mb-6 space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Radar</h1>
              <p className="text-sm text-muted-foreground">
                {data && data.total > 0
                  ? `${data.total} repos worth a look, ranked by how well they fit your stars.`
                  : "New and rising repos, ranked by how well they fit your stars."}
                {scannedAgo && (
                  <span className="text-muted-foreground/60"> Scanned {scannedAgo}.</span>
                )}
              </p>
            </header>

            <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter signals">
              {FILTERS.map((f) => {
                const active = filter === f.id
                const dot = f.id === "all" ? null : KIND_COLOR[f.id]
                return (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs transition-colors duration-200",
                      active
                        ? "border-foreground/20 bg-foreground text-background"
                        : "border-border/70 bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
                    )}
                  >
                    {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />}
                    {f.label}
                    <span
                      className={cn(
                        "tabular-nums",
                        active ? "text-background/70" : "text-muted-foreground/60",
                      )}
                    >
                      {counts[f.id]}
                    </span>
                  </button>
                )
              })}
            </div>

            {isLoading && (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[104px] rounded-lg" />
                ))}
              </div>
            )}

            {error && (
              <EmptyState
                title="Radar couldn't load."
                body="Reload the page. If it keeps failing, the nightly scan may not have run yet."
              />
            )}

            {neverScanned && (
              <EmptyState
                title="Nothing on the radar yet."
                body={
                  fewStars
                    ? "Star a handful of repos first so Radar knows your taste, then scan."
                    : "The first scan pulls new repos from GitHub, Hacker News and the people you follow."
                }
                action={
                  <Button onClick={scanNow} disabled={scanning} className="gap-2">
                    {scanning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Telescope className="h-4 w-4" />
                    )}
                    {scanning ? "Scanning…" : "Scan now"}
                  </Button>
                }
              />
            )}

            {data && data.total > 0 && items.length === 0 && (
              <EmptyState
                title={filter === "all" ? "You're caught up." : "Nothing here right now."}
                body={
                  filter === "all"
                    ? "Everything has been starred, snoozed or dismissed. New signals land overnight."
                    : "Try another filter, or scan now to pull fresh signals."
                }
              />
            )}

            {items.length > 0 && (
              <ol className="space-y-2">
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

            {items.length > 0 && (
              <p className="mt-6 hidden items-center gap-3 text-[11px] text-muted-foreground/70 md:flex">
                <span className="flex items-center gap-1">
                  <Kbd>j</Kbd>
                  <Kbd>k</Kbd> move
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>x</Kbd> dismiss
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>z</Kbd> snooze a week
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>o</Kbd> open on GitHub
                </span>
              </p>
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/70 px-6 py-16 text-center">
      <Telescope className="h-6 w-6 text-muted-foreground/50" />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      {action}
    </div>
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
  const rail = KIND_COLOR[item.reasons[0]?.kind ?? "topic"]
  const age = item.ghCreatedAt
    ? formatDistanceToNow(new Date(item.ghCreatedAt), { addSuffix: false })
    : null

  return (
    <li
      id={`radar-row-${item.id}`}
      onMouseEnter={onFocus}
      className={cn(
        "relative flex gap-3 rounded-lg border bg-card py-3 pl-4 pr-3 transition-colors duration-150",
        active ? "border-muted-foreground/40" : "border-border hover:border-muted-foreground/25",
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-3 left-0 w-0.5 rounded-r", rail)} />

      <Avatar className="mt-0.5 h-8 w-8 shrink-0">
        <AvatarImage src={item.avatarUrl} alt="" />
        <AvatarFallback className="text-xs">{item.owner[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <a
            href={item.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group/link min-w-0 truncate font-mono text-sm"
          >
            <span className="text-muted-foreground">{item.owner}/</span>
            <span className="font-medium group-hover/link:underline">{item.name}</span>
            <ExternalLink className="ml-1 inline h-3 w-3 align-[-1px] text-muted-foreground/50" />
          </a>
          <div className="flex shrink-0 items-center gap-3 text-xs tabular-nums text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              {formatNumber(item.stargazersCount)}
              {item.starsDelta7d !== null && item.starsDelta7d >= 100 && (
                <span className="text-violet-400">+{formatNumber(item.starsDelta7d)}</span>
              )}
            </span>
            <span className="hidden items-center gap-1 sm:flex">
              <GitFork className="h-3 w-3" />
              {formatNumber(item.forksCount)}
            </span>
          </div>
        </div>

        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {item.description}
          </p>
        )}

        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {item.reasons.map((r) => (
            <li
              key={r.kind + r.text}
              className="flex items-center gap-1.5 text-xs text-foreground/80"
            >
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", KIND_COLOR[r.kind])} />
              {r.kind === "hn" && item.hn ? (
                <a
                  href={item.hn.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {r.text}
                </a>
              ) : (
                r.text
              )}
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 text-[11px] text-muted-foreground">
            {item.language && (
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: langColor ?? undefined }}
                />
                {item.language}
              </span>
            )}
            {age && <span>{age} old</span>}
            {item.topics.slice(0, 3).map((t) => (
              <span key={t} className="hidden truncate sm:inline">
                #{t}
              </span>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1">
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
