"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useState,
} from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Check,
  Clock,
  GitPullRequestArrow,
  Moon,
  Radar,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Star,
  Sun,
  Telescope,
  type LucideIcon,
} from "lucide-react"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { useUser } from "@/components/providers/user-provider"
import { useTheme } from "@/components/theme-provider"
import { useI18n } from "@/components/i18n-provider"
import { useCommandPaletteShortcut } from "@/components/use-command-palette-shortcut"
import { useStarredRepos } from "@/lib/use-starred-repos"
import { RADAR_ENABLED } from "@/lib/flags"
import type { StarredRepo } from "@/lib/types"

// One palette for the whole signed-in app. Every page gets Navigate, Your stars and
// Actions; a page adds its own groups (and optionally "search this page" and repo
// handling) with usePaletteGroups while it is mounted. Page groups render first.

export interface PaletteItem {
  id: string
  label: string
  /** Extra words that should match this item, e.g. "sync refresh". */
  keywords?: string
  hint?: string
  icon?: LucideIcon
  iconClassName?: string
  iconColor?: string
  /** Shows a check mark; null means "can be checked, isn't". */
  checked?: boolean | null
  shortcut?: string
  disabled?: boolean
  onSelect: () => void
}

export interface PaletteGroup {
  heading: string
  items: PaletteItem[]
  /** Cap on items shown, after filtering. */
  limit?: number
}

export interface PaletteRegistration {
  groups?: PaletteGroup[]
  /** Adds "Search this page for '…'" as the first item while typing. */
  search?: { label: string; run: (query: string) => void }
  /** Overrides what selecting a repo in Your stars does (default: open its page). */
  onRepo?: (repo: StarredRepo) => void
  placeholder?: string
}

interface PaletteContext {
  open: boolean
  setOpen: (open: boolean) => void
  /** Opens the palette in ask mode: question placeholder, only the Ask item. */
  openAsk: () => void
}

// ponytail: one module-level slot (one palette, one page at a time). Pages write it after
// every render; the provider snapshots it when the palette opens.
const slot: { current: PaletteRegistration | null } = { current: null }

const Ctx = createContext<PaletteContext | null>(null)

export function useCommandPalette() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useCommandPalette must be used inside CommandPaletteProvider")
  return { open: ctx.open, setOpen: ctx.setOpen }
}

/** Same as useCommandPalette, but null outside the signed-in app (e.g. landing pages). */
export function useOptionalCommandPalette() {
  const ctx = useContext(Ctx)
  return ctx ? { open: ctx.open, setOpen: ctx.setOpen, openAsk: ctx.openAsk } : null
}

/** All Stars in ask mode: /dashboard?ask=<question>. */
export const askHref = (question: string) => `/dashboard?ask=${encodeURIComponent(question)}`

// A question reads like one: ends in "?", or three or more words.
const looksLikeQuestion = (q: string) => q.endsWith("?") || q.split(/\s+/).length >= 3

/**
 * Registers this page's palette content. Call it every render with fresh values;
 * it is read when the palette renders, so no dependency list is needed.
 */
export function usePaletteGroups(registration: PaletteRegistration) {
  const mine = useRef<PaletteRegistration | null>(null)
  useLayoutEffect(() => {
    mine.current = registration
    slot.current = registration
  })
  // On navigation the old page's cleanup can run after the new page registered:
  // only clear the slot if it still holds this page's registration.
  useEffect(
    () => () => {
      if (slot.current === mine.current) slot.current = null
    },
    [],
  )
}

const NAV: { href: string; label: string; icon: LucideIcon; keywords?: string }[] = [
  ...(RADAR_ENABLED
    ? [{ href: "/radar", label: "Radar", icon: Telescope, keywords: "inbox new rising" }]
    : []),
  { href: "/dashboard", label: "All Stars", icon: Star, keywords: "dashboard library" },
  { href: "/search", label: "Discover", icon: Search, keywords: "search github" },
  { href: "/recently-viewed", label: "Recently Viewed", icon: Clock, keywords: "history" },
  { href: "/health", label: "Health", icon: Radar, keywords: "health reports intel" },
  {
    href: "/contribute",
    label: "Contribute",
    icon: GitPullRequestArrow,
    keywords: "issues good first",
  },
  { href: "/settings", label: "Settings", icon: Settings, keywords: "tags collections key" },
]

const matches = (q: string, ...parts: (string | null | undefined)[]) =>
  !q || parts.some((p) => p?.toLowerCase().includes(q))

const REPO_LIMIT = 24
// Neutral highlight like the Radar rows; the stock bg-accent is the brand green.
const ITEM = "rounded-md data-[selected=true]:bg-muted data-[selected=true]:text-foreground"

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n()
  const [page, setPage] = useState<PaletteRegistration | null | undefined>(undefined)
  const [askMode, setAskMode] = useState(false)
  const open = page !== undefined
  const setOpen = useCallback((next: boolean) => {
    setAskMode(false)
    setPage(next ? slot.current : undefined)
  }, [])
  const openAsk = useCallback(() => {
    setAskMode(true)
    setPage(slot.current)
  }, [])
  useCommandPaletteShortcut(open, setOpen)
  const value = useMemo(() => ({ open, setOpen, openAsk }), [open, setOpen, openAsk])

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Always mounted so Radix restores focus on close; the body remounts per open. */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="top-[12vh] translate-y-0 overflow-hidden p-0 sm:max-w-2xl"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{t("Search Stellan", "搜索 Stellan")}</DialogTitle>
            <DialogDescription>
              {t("Search pages and repositories.", "搜索页面和仓库。")}
            </DialogDescription>
          </DialogHeader>
          {open && (
            <PaletteBody onClose={() => setOpen(false)} page={page ?? null} askMode={askMode} />
          )}
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  )
}

function PaletteBody({
  onClose,
  page: registered,
  askMode,
}: {
  onClose: () => void
  page: PaletteRegistration | null
  askMode: boolean
}) {
  // Ask mode shows nothing but the question box and the Ask item.
  const page = askMode ? null : registered
  const router = useRouter()
  const { t } = useI18n()
  const { user } = useUser()
  const { data: starData, refresh, isRefreshing } = useStarredRepos(user?.id)
  const { resolvedTheme, setTheme } = useTheme()
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()

  const run = (fn: () => void) => {
    onClose()
    fn()
  }

  const universalDefs: PaletteGroup[] = [
    {
      heading: t("Navigate", "导航"),
      items: NAV.map((n) => ({
        id: `nav-${n.href}`,
        label: t(
          n.label,
          (
            {
              "/radar": "雷达",
              "/dashboard": "全部星标",
              "/search": "发现",
              "/recently-viewed": "最近浏览",
              "/health": "健康",
              "/contribute": "贡献",
              "/settings": "设置",
            } as Record<string, string>
          )[n.href] ?? n.label,
        ),
        keywords: `${n.label} ${n.keywords ?? ""}`,
        icon: n.icon,
        onSelect: () => router.push(n.href),
      })),
    },
    {
      heading: t("Actions", "操作"),
      items: [
        {
          id: "action-sync",
          label: t("Sync starred repositories", "同步星标仓库"),
          keywords: "refresh github",
          icon: RefreshCw,
          iconClassName: isRefreshing ? "animate-spin" : undefined,
          shortcut: t("Sync", "同步"),
          onSelect: () => void refresh({ manual: true }),
        },
        {
          id: "action-theme",
          label:
            resolvedTheme === "dark"
              ? t("Switch to light theme", "切换浅色模式")
              : t("Switch to dark theme", "切换深色模式"),
          keywords: "theme dark light mode appearance",
          icon: resolvedTheme === "dark" ? Sun : Moon,
          onSelect: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
        },
      ],
    },
  ]

  const repos = useMemo(() => {
    const all = starData?.repos ?? []
    const list = q
      ? all.filter((r) =>
          matches(q, r.fullName, r.description, r.notes, r.language, ...r.tags.map((t) => t.label)),
        )
      : [...all].sort((a, b) => Number(b.isPinned) - Number(a.isPinned)).slice(0, 6)
    return list.slice(0, REPO_LIMIT)
  }, [starData?.repos, q])

  const filterGroup = (g: PaletteGroup) => {
    const items = g.items.filter((i) => matches(q, i.label, i.keywords, i.hint))
    return { ...g, items: g.limit ? items.slice(0, g.limit) : items }
  }
  // Order: page search, page groups, Navigate and Actions (short, exact), then stars.
  // A page-name match moves Navigate and Actions to the top.
  const pageGroups = (page?.groups ?? []).map(filterGroup).filter((g) => g.items.length)
  const universalGroups = universalDefs.map(filterGroup).filter((g) => g.items.length)
  // A page-name prefix such as "health" opens Health ahead of in-page search.
  const navFirst = Boolean(q) && NAV.some((n) => n.label.toLowerCase().startsWith(q))
  const universal = universalGroups.map((g) => (
    <PaletteGroupView key={g.heading} group={g} run={run} />
  ))
  const openRepo = page?.onRepo ?? ((r: StarredRepo) => router.push(`/repo/${r.owner}/${r.name}`))
  const trimmed = query.trim()
  // Ask is always offered while typing: first when it reads like a question, else last.
  const askFirst = askMode || looksLikeQuestion(trimmed)
  const askItem = trimmed ? (
    <CommandGroup heading={t("Ask", "提问")}>
      <CommandItem
        value="__ask"
        onSelect={() => run(() => router.push(askHref(trimmed)))}
        className={ITEM}
      >
        <Sparkles className="h-4 w-4" />
        <span className="flex-1 truncate">
          {t(`Ask your stars: “${trimmed}”`, `询问收藏：“${trimmed}”`)}
        </span>
        <CommandShortcut>
          <ArrowRight className="h-3.5 w-3.5" />
        </CommandShortcut>
      </CommandItem>
    </CommandGroup>
  ) : null

  return (
    <Command
      shouldFilter={false}
      loop
      className="rounded-none bg-popover text-popover-foreground [&_[data-slot=command-input-wrapper]]:h-14 [&_[data-slot=command-input-wrapper]]:border-b [&_[data-slot=command-input-wrapper]]:border-border/70 [&_[data-slot=command-input-wrapper]]:px-4 [&_[data-slot=command-input]]:h-14 [&_[data-slot=command-input]]:text-sm"
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={
          askMode
            ? t("Ask your stars", "询问收藏")
            : (page?.placeholder ?? t("Search pages and repositories", "搜索页面和仓库"))
        }
      />
      <CommandList className="max-h-[min(64vh,560px)] px-2 py-2">
        {askMode && !trimmed && (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            {t("Ask your stars", "询问收藏")}
          </p>
        )}

        {askFirst && askItem}

        {!askMode && navFirst && universal}

        {!askMode && trimmed && (
          <CommandGroup heading={t("Repositories", "仓库")}>
            <CommandItem
              value="__unified_search"
              onSelect={() =>
                run(() => {
                  const href = `/search?q=${encodeURIComponent(trimmed)}&scope=stars`
                  if (window.location.pathname === "/search") {
                    window.history.pushState(null, "", href)
                    window.dispatchEvent(new PopStateEvent("popstate"))
                  } else {
                    router.push(href)
                  }
                })
              }
              className={ITEM}
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 truncate">
                {t(`Search repositories for “${trimmed}”`, `搜索仓库：“${trimmed}”`)}
              </span>
              <CommandShortcut>
                <ArrowRight className="h-3.5 w-3.5" />
              </CommandShortcut>
            </CommandItem>
          </CommandGroup>
        )}

        {page?.search && query.trim() && (
          <CommandGroup heading={t("Search", "搜索")}>
            <CommandItem
              value="__search"
              onSelect={() => run(() => page.search!.run(query.trim()))}
              className={ITEM}
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 truncate">
                {page.search.label} for &quot;{query.trim()}&quot;
              </span>
              <CommandShortcut>
                <ArrowRight className="h-3.5 w-3.5" />
              </CommandShortcut>
            </CommandItem>
          </CommandGroup>
        )}

        {pageGroups.map((g) => (
          <PaletteGroupView key={g.heading} group={g} run={run} />
        ))}

        {!askMode && !navFirst && universal}

        {!askMode && repos.length > 0 && (
          <CommandGroup
            heading={
              q ? t("Your stars", "我的收藏") : t("Pinned and recent stars", "置顶和最近收藏")
            }
          >
            {repos.map((repo) => (
              <CommandItem
                key={repo.id}
                value={`repo-${repo.fullName}`}
                onSelect={() => run(() => openRepo(repo))}
                className={`items-start py-2.5 ${ITEM}`}
              >
                <Star className="mt-0.5 h-4 w-4" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-mono text-[13px]">
                    <span className="text-muted-foreground">{repo.owner}/</span>
                    {repo.name}
                  </span>
                  {repo.description && (
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {repo.description}
                    </span>
                  )}
                </div>
                {repo.language && <CommandShortcut>{repo.language}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!askFirst && askItem}
      </CommandList>
      <div className="flex items-center justify-end gap-3 border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <KbdGroup>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
          </KbdGroup>
          {t("Move", "移动")}
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>Enter</Kbd>
          {t("Select", "选择")}
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>Esc</Kbd>
          {t("Close", "关闭")}
        </span>
      </div>
    </Command>
  )
}

function PaletteGroupView({ group, run }: { group: PaletteGroup; run: (fn: () => void) => void }) {
  return (
    <CommandGroup heading={group.heading}>
      {group.items.map((item) => {
        const Icon = item.icon
        return (
          <CommandItem
            key={item.id}
            value={item.id}
            disabled={item.disabled}
            onSelect={() => run(item.onSelect)}
            className={ITEM}
          >
            {item.checked !== undefined ? (
              <Check className={item.checked ? "h-4 w-4" : "h-4 w-4 opacity-0"} />
            ) : Icon ? (
              <Icon
                className={item.iconClassName ? `h-4 w-4 ${item.iconClassName}` : "h-4 w-4"}
                style={item.iconColor ? { color: item.iconColor } : undefined}
              />
            ) : null}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{item.label}</span>
              {item.hint && (
                <span className="truncate text-xs text-muted-foreground">{item.hint}</span>
              )}
            </span>
            {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
          </CommandItem>
        )
      })}
    </CommandGroup>
  )
}
