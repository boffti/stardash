"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { format, formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { Check, ExternalLink, Loader2, Package, RefreshCw, TriangleAlert } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { useAIKey } from "@/lib/use-ai-key"
import type { ReleaseFeed, ReleaseItem } from "@/app/api/releases/route"
import { cn } from "@/lib/utils"

const KEY = "/api/releases"
const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface RepoGroup {
  repoId: string
  fullName: string
  owner: string
  avatarUrl: string | null
  releases: ReleaseItem[]
  breaking: boolean
}

async function postSeen(repoId: string, restore?: { value: string | null }) {
  const res = await fetch("/api/releases/seen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoId, restore }),
  })
  if (!res.ok) throw new Error("Action failed")
  return (await res.json()) as { previous: string | null }
}

export function ReleasesInbox() {
  const { data, error, isLoading, mutate } = useSWR<ReleaseFeed & { error?: string }>(
    KEY,
    fetcher,
    { revalidateOnFocus: false },
  )
  const { getHeaders } = useAIKey()
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [cursor, setCursor] = useState(0)
  const [checking, setChecking] = useState(false)

  // One row per repo: x marks everything it shipped as read.
  const groups = useMemo(() => {
    const byRepo = new Map<string, RepoGroup>()
    for (const r of data?.items ?? []) {
      if (hidden.has(r.repoId)) continue
      const g = byRepo.get(r.repoId) ?? {
        repoId: r.repoId,
        fullName: r.fullName,
        owner: r.owner,
        avatarUrl: r.avatarUrl,
        releases: [],
        breaking: false,
      }
      g.releases.push(r)
      g.breaking ||= r.breaking
      byRepo.set(r.repoId, g)
    }
    return [...byRepo.values()]
  }, [data?.items, hidden])

  const activeIndex = Math.min(cursor, Math.max(0, groups.length - 1))

  const setHiddenFor = useCallback((id: string, on: boolean) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const markRead = useCallback(
    async (g: RepoGroup) => {
      setHiddenFor(g.repoId, true)
      try {
        const { previous } = await postSeen(g.repoId)
        toast(`Marked ${g.fullName} read`, {
          action: {
            label: "Undo",
            onClick: async () => {
              setHiddenFor(g.repoId, false)
              await postSeen(g.repoId, { value: previous }).catch(() =>
                setHiddenFor(g.repoId, true),
              )
            },
          },
        })
      } catch {
        setHiddenFor(g.repoId, false)
        toast.error("Couldn't save that. Try again.")
      }
    },
    [setHiddenFor],
  )

  const checkNow = useCallback(async () => {
    setChecking(true)
    try {
      const res = await fetch("/api/releases/scan", { method: "POST", headers: getHeaders() })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error ?? "Check failed")
        return
      }
      await mutate()
      toast.success(
        body.added
          ? `${body.added} new ${body.added === 1 ? "release" : "releases"} across ${body.repos} repos`
          : `No new releases across ${body.repos} repos`,
      )
    } finally {
      setChecking(false)
    }
  }, [getHeaders, mutate])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return
      if (target?.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return
      const current = groups[activeIndex]
      switch (e.key) {
        case "j":
          setCursor((c) => Math.min(groups.length - 1, c + 1))
          break
        case "k":
          setCursor((c) => Math.max(0, c - 1))
          break
        case "x":
          if (current) void markRead(current)
          break
        case "o":
          if (current) window.open(current.releases[0].url, "_blank", "noopener")
          break
        default:
          return
      }
      e.preventDefault()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [groups, activeIndex, markRead])

  useEffect(() => {
    document
      .getElementById(`release-row-${groups[activeIndex]?.repoId}`)
      ?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, groups])

  const checkButton = (size: "sm" | "default" = "sm") => (
    <Button
      variant="outline"
      size={size}
      onClick={checkNow}
      disabled={checking}
      className="gap-1.5"
    >
      {checking ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      {checking ? "Checking…" : "Check now"}
    </Button>
  )

  const checkedAgo = data?.checkedAt
    ? formatDistanceToNow(new Date(data.checkedAt), { addSuffix: true })
    : null
  const breakingCount = groups.filter((g) => g.breaking).length

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="min-w-0">
        {data && data.tracked > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {groups.length > 0
                ? `${groups.length} ${groups.length === 1 ? "repo" : "repos"} shipped since you last looked`
                : "No unread releases"}
              {breakingCount > 0 && (
                <span className="text-amber-500">, {breakingCount} with breaking changes</span>
              )}
              .
              <span className="text-muted-foreground/60">
                {" "}
                Watching {data.tracked} currently-using {data.tracked === 1 ? "repo" : "repos"}
                {checkedAgo ? `, checked ${checkedAgo}.` : "."}
              </span>
            </p>
            {checkButton()}
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        )}

        {(error || data?.error) && (
          <ReleasesEmpty title="Releases couldn't load." body="Reload the page to try again." />
        )}

        {data && !data.error && data.tracked === 0 && (
          <ReleasesEmpty
            title="No repos to watch yet."
            body="Set a star's status to Currently Using and its new GitHub releases land here, with breaking changes flagged."
          />
        )}

        {data && data.tracked > 0 && groups.length === 0 && (
          <ReleasesEmpty
            title="You're caught up."
            body="New releases from your currently-using repos show up here after the nightly check."
          />
        )}

        {groups.length > 0 && (
          <ol className="flex flex-col gap-3">
            {groups.map((g, index) => (
              <ReleaseRow
                key={g.repoId}
                group={g}
                active={index === activeIndex}
                onFocus={() => setCursor(index)}
                onRead={() => markRead(g)}
              />
            ))}
          </ol>
        )}
      </div>

      {groups.length > 0 && (
        <aside className="hidden xl:block">
          <div className="sticky top-20 flex flex-col gap-4">
            <div className="rounded-lg border border-border/60 bg-card">
              <div className="border-b border-border/40 px-4 py-3 text-sm font-medium">
                Keyboard
              </div>
              <dl className="flex flex-col gap-2 px-4 py-3 text-xs text-muted-foreground">
                {(
                  [
                    [["j", "k"], "Move"],
                    [["x"], "Mark read"],
                    [["o"], "Open release"],
                  ] as const
                ).map(([keys, label]) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <dt>{label}</dt>
                    <dd className="flex items-center gap-1">
                      {keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-lg border border-border/60 bg-card">
              <div className="border-b border-border/40 px-4 py-3 text-sm font-medium">
                How it works
              </div>
              <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                Repos you mark Currently Using are checked nightly. A major version bump or notes
                that mention breaking changes get flagged. With an AI key set, each release also
                gets a short summary.
              </p>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}

function ReleasesEmpty({
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
          <Package />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{body}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}

function ReleaseRow({
  group,
  active,
  onFocus,
  onRead,
}: {
  group: RepoGroup
  active: boolean
  onFocus: () => void
  onRead: () => void
}) {
  const [latest, ...earlier] = group.releases
  const text = latest.summary ?? latest.excerpt
  const [owner, name] = group.fullName.split("/")

  return (
    <li
      id={`release-row-${group.repoId}`}
      data-active={active || undefined}
      onMouseEnter={onFocus}
      className={cn(
        "group rounded-lg border bg-card transition-colors duration-150",
        active
          ? "border-foreground/40 bg-muted/20"
          : "border-border/60 hover:border-muted-foreground/30",
      )}
    >
      <div className="flex gap-3 p-4">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={group.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="text-xs">{owner?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 truncate font-mono text-sm font-medium">
                <span className="text-muted-foreground">{owner}/</span>
                {name}
              </span>
              <a
                href={latest.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-xs transition-colors hover:border-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {latest.tag}
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
              <span
                className="text-xs text-muted-foreground"
                title={format(new Date(latest.publishedAt), "PPpp")}
              >
                {formatDistanceToNow(new Date(latest.publishedAt), { addSuffix: true })}
              </span>
            </div>

            {group.breaking && (
              <span className="inline-flex min-h-6 items-center gap-1.5 self-start rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium leading-4 text-amber-600 dark:text-amber-400">
                <TriangleAlert className="h-3 w-3" />
                Breaking changes
              </span>
            )}
          </div>

          {text ? (
            <p
              className={cn(
                "mt-2 line-clamp-3 text-sm leading-relaxed",
                latest.summary ? "text-foreground/90" : "text-muted-foreground",
              )}
            >
              {text}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground/70">No release notes.</p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {earlier.length > 0 && (
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  Also unread:
                  {earlier.map((r) => (
                    <a
                      key={r.tag}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "font-mono hover:text-foreground hover:underline",
                        r.breaking && "text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {r.tag}
                    </a>
                  ))}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRead}
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              aria-label={`Mark ${group.fullName} releases read`}
            >
              <Check className="h-3.5 w-3.5" />
              Mark read
            </Button>
          </div>
        </div>
      </div>
    </li>
  )
}
