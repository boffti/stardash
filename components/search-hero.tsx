"use client"

import { Search, Loader2, X } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"

export type SearchScope = "stars" | "github" | "ai"

interface SearchHeroProps {
  query: string
  scope: SearchScope
  onQueryChange: (query: string) => void
  onScopeChange: (scope: SearchScope) => void
  onSearch: (query: string) => void
  isLoading: boolean
  hasResults: boolean
  onClear: () => void
}

export function SearchHero({
  query,
  scope,
  onQueryChange,
  onScopeChange,
  onSearch,
  isLoading,
  hasResults,
  onClear,
}: SearchHeroProps) {
  const { t } = useI18n()
  return (
    <div className={`border-b border-border/50 px-6 ${hasResults ? "py-5" : "py-12"}`}>
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("Search repositories", "搜索仓库")}
          </h2>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (query.trim()) onSearch(query.trim())
          }}
          className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm"
        >
          <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            aria-label={t("Search repositories", "搜索仓库")}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t(
              "Search by name, description, topic, or language",
              "按名称、描述、主题或语言搜索",
            )}
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          {query && (
            <button
              type="button"
              aria-label={t("Clear search", "清除搜索")}
              onClick={onClear}
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <Button type="submit" size="sm" disabled={isLoading || !query.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Search", "搜索")}
          </Button>
        </form>
        <div
          className="flex flex-wrap items-center gap-2"
          aria-label={t("Search scope", "搜索范围")}
        >
          {(
            [
              ["stars", t("My stars", "我的收藏")],
              ["github", "GitHub"],
              ["ai", t("AI discovery", "AI 发现")],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              onClick={() => onScopeChange(value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${scope === value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
