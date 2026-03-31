"use client"

import { useEffect, useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { RefreshCw } from "lucide-react"
import type { StarredRepo } from "@/lib/types"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
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

interface RepoCommandPaletteAction {
  value: string
  label: string
  shortcut?: string
  icon?: LucideIcon
  onSelect: () => void
}

interface RepoCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  headerLabel: string
  placeholder: string
  emptyHint: string
  repos: StarredRepo[]
  actions?: RepoCommandPaletteAction[]
  onRepoOpen: (repo: StarredRepo) => void
}

const RESULT_LIMIT = 24

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"]'
    )
  )
}

function includesQuery(value: string | undefined | null, query: string) {
  return Boolean(value?.toLowerCase().includes(query))
}

export function RepoCommandPalette({
  open,
  onOpenChange,
  title,
  description,
  headerLabel,
  placeholder,
  emptyHint,
  repos,
  actions = [],
  onRepoOpen,
}: RepoCommandPaletteProps) {
  const [query, setQuery] = useState("")
  const [selectedValue, setSelectedValue] = useState("")

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (!open && isEditableTarget(event.target)) return
        event.preventDefault()
        onOpenChange(!open)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setSelectedValue("")
    }
  }, [open])

  const normalizedQuery = query.trim().toLowerCase()
  const visibleRepos = useMemo(() => {
    const matched = normalizedQuery
      ? repos.filter((repo) => {
          return (
            includesQuery(repo.name, normalizedQuery) ||
            includesQuery(repo.owner, normalizedQuery) ||
            includesQuery(repo.description, normalizedQuery) ||
            includesQuery(repo.notes, normalizedQuery) ||
            includesQuery(repo.language, normalizedQuery) ||
            repo.tags.some((tag) => includesQuery(tag.label, normalizedQuery))
          )
        })
      : repos

    return matched.slice(0, RESULT_LIMIT)
  }, [normalizedQuery, repos])

  const orderedItemMatches = useMemo(() => {
    const matches: Array<{ value: string; matchesQuery: boolean }> = []

    actions.forEach((action) => {
      matches.push({
        value: action.value,
        matchesQuery: `${action.label} ${action.shortcut ?? ""}`.toLowerCase().includes(normalizedQuery),
      })
    })

    visibleRepos.forEach((repo) => {
      matches.push({
        value: `repo-${repo.owner}-${repo.name}`,
        matchesQuery: [
          repo.owner,
          repo.name,
          repo.description,
          repo.notes,
          repo.language,
          ...repo.tags.map((tag) => tag.label),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      })
    })

    return matches
  }, [actions, normalizedQuery, visibleRepos])

  useEffect(() => {
    if (!open) return

    const nextSelection =
      orderedItemMatches.find((item) => item.matchesQuery)?.value ?? orderedItemMatches[0]?.value ?? ""

    setSelectedValue(nextSelection)
  }, [open, orderedItemMatches])

  const runAndClose = (action: () => void) => {
    action()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl overflow-hidden p-0" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Command
          shouldFilter={false}
          value={selectedValue}
          onValueChange={setSelectedValue}
          className="rounded-none bg-popover text-popover-foreground [&_[data-slot=command-input-wrapper]]:h-14 [&_[data-slot=command-input-wrapper]]:border-b [&_[data-slot=command-input-wrapper]]:border-border/70 [&_[data-slot=command-input-wrapper]]:px-4 [&_[data-slot=command-input-wrapper]_svg]:h-4 [&_[data-slot=command-input-wrapper]_svg]:w-4 [&_[data-slot=command-input]]:h-14 [&_[data-slot=command-input]]:text-sm"
        >
          <div className="border-b border-border/70 bg-secondary/20">
            <div className="flex items-center justify-between gap-3 px-4 py-2 text-xs text-muted-foreground">
              <span className="truncate">{headerLabel}</span>
              <KbdGroup className="hidden shrink-0 sm:flex">
                <Kbd>Esc</Kbd>
                <Kbd>Enter</Kbd>
              </KbdGroup>
            </div>
          </div>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={placeholder}
          />

          <CommandList className="max-h-[min(72vh,680px)] px-2 py-2">
            {actions.length > 0 && (
              <>
                <CommandGroup heading="Quick Actions">
                  {actions.map((action) => {
                    const Icon = action.icon ?? RefreshCw
                    return (
                      <CommandItem
                        key={action.value}
                        value={action.value}
                        onSelect={() => runAndClose(action.onSelect)}
                        className="rounded-md"
                      >
                        <Icon className="h-4 w-4" />
                        <span className="flex-1">{action.label}</span>
                        {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            <CommandGroup heading={normalizedQuery ? "Matching Repositories" : "Repositories"}>
              {visibleRepos.map((repo) => (
                <CommandItem
                  key={repo.id}
                  value={`repo-${repo.owner}-${repo.name}`}
                  onSelect={() => runAndClose(() => onRepoOpen(repo))}
                  className="items-start rounded-md py-3"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {repo.owner}/{repo.name}
                      </span>
                    </div>
                    {repo.description && (
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {repo.description}
                      </span>
                    )}
                  </div>
                  <CommandShortcut>{repo.language ?? "Repo"}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandEmpty className="py-10">
              <div className="space-y-2 text-center">
                <p className="font-medium">No results for "{query.trim()}"</p>
                <p className="text-xs text-muted-foreground">
                  {emptyHint}
                </p>
              </div>
            </CommandEmpty>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
