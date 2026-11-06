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
import { useI18n } from "@/components/i18n-provider"
import { zhCN } from "date-fns/locale"
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
  const { t, locale } = useI18n()
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
        toast(t(`Marked ${g.fullName} read`, `已将 ${g.fullName} 标为已读`), {
          action: {
            label: t("Undo", "撤销"),
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
        toast.error(t("Could not save. Try again.", "保存失败，请重试。"))
      }
    },
    [setHiddenFor, t],
  )

  const checkNow = useCallback(async () => {
    setChecking(true)
    try {
      const res = await fetch("/api/releases/scan", { method: "POST", headers: getHeaders() })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error ?? t("Check failed", "检查失败"))
        return
      }
      await mutate()
      toast.success(
        body.added
          ? t(
              `${body.added} new releases across ${body.repos} repos`,
              `${body.repos} 个仓库中有 ${body.added} 个新版本`,
            )
          : t(`No new releases across ${body.repos} repos`, `${body.repos} 个仓库中没有新版本`),
      )
    } finally {
      setChecking(false)
    }
  }, [getHeaders, mutate, t])

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
      {checking ? t("Checking…", "检查中…") : t("Check now", "立即检查")}
    </Button>
  )

  const checkedAgo = data?.checkedAt
    ? formatDistanceToNow(new Date(data.checkedAt), {
        addSuffix: true,
        locale: locale === "zh-CN" ? zhCN : undefined,
      })
    : null
  const breakingCount = groups.filter((g) => g.breaking).length

  return (
    <div className="grid gap-6">
      <div className="min-w-0">
        {data && data.tracked > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {groups.length > 0
                ? t(
                    `${groups.length} repos have unread releases`,
                    `${groups.length} 个仓库有未读版本`,
                  )
                : t("No unread releases", "没有未读版本")}
              {breakingCount > 0 && (
                <span className="text-amber-500">
                  {t(
                    `, ${breakingCount} with breaking changes`,
                    `，其中 ${breakingCount} 个含破坏性变更`,
                  )}
                </span>
              )}
              {checkedAgo && (
                <span className="text-muted-foreground/60">
                  {t(` · Checked ${checkedAgo}`, ` · 检查于${checkedAgo}`)}
                </span>
              )}
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
          <ReleasesEmpty
            title={t("Could not load releases", "无法加载版本发布")}
            body={t("Reload the page to try again.", "重新加载页面以重试。")}
          />
        )}

        {data && !data.error && data.tracked === 0 && (
          <ReleasesEmpty
            title={t("No repos to watch", "暂无关注的仓库")}
            body={t(
              "Set a repository status to Currently using to track its releases.",
              "将仓库状态设为正在使用，以跟踪其版本发布。",
            )}
          />
        )}

        {data && data.tracked > 0 && groups.length === 0 && (
          <ReleasesEmpty
            title={t("All caught up", "已查看全部版本")}
            body={t("New releases appear after the next check.", "下次检查后会显示新版本。")}
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
  const { t, locale } = useI18n()
  const [latest, ...earlier] = group.releases
  const text = latest.summary ?? latest.excerpt
  const [owner, name] = group.fullName.split("/")

  return (
    <li
      id={`release-row-${group.repoId}`}
      data-active={active || undefined}
      onMouseEnter={onFocus}
      className={cn(
        "group rounded-lg bg-card shadow-sm transition-colors duration-150",
        active ? "bg-muted/50" : "hover:bg-muted/30",
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
                {formatDistanceToNow(new Date(latest.publishedAt), {
                  addSuffix: true,
                  locale: locale === "zh-CN" ? zhCN : undefined,
                })}
              </span>
            </div>

            {group.breaking && (
              <span className="inline-flex min-h-6 items-center gap-1.5 self-start rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium leading-4 text-amber-600 dark:text-amber-400">
                <TriangleAlert className="h-3 w-3" />
                {t("Breaking changes", "破坏性变更")}
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
            <p className="mt-2 text-sm text-muted-foreground/70">
              {t("No release notes", "暂无版本说明")}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {earlier.length > 0 && (
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {t("Also unread:", "其他未读版本：")}
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
              aria-label={t(
                `Mark ${group.fullName} releases read`,
                `将 ${group.fullName} 的版本标为已读`,
              )}
            >
              <Check className="h-3.5 w-3.5" />
              {t("Mark read", "标为已读")}
            </Button>
          </div>
        </div>
      </div>
    </li>
  )
}
