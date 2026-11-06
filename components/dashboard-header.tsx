"use client"

import { useI18n } from "@/components/i18n-provider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AppPageHeader } from "@/components/app-page-header"
import type { RepoHealthFilter } from "@/lib/repo-health"

interface DashboardHeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  sortBy: string
  onSortChange: (value: string) => void
  languageFilter: string | null
  onLanguageFilterChange: (language: string | null) => void
  healthFilter: RepoHealthFilter | null
  onHealthFilterChange: (filter: RepoHealthFilter | null) => void
  languages: string[]
  lastSynced: string | null
  onRefresh?: () => void | Promise<unknown>
  isRefreshing?: boolean
  onCategorize?: () => void
  isCategorizing?: boolean
  categorizeLimit?: { remaining: number | null; nextAllowedAt: string | null }
}

export function DashboardHeader({
  searchQuery,
  sortBy,
  onSortChange,
  languageFilter,
  onLanguageFilterChange,
  healthFilter,
  onHealthFilterChange,
  languages,
  lastSynced,
  onRefresh,
  isRefreshing = false,
  onCategorize,
  isCategorizing = false,
  categorizeLimit,
}: DashboardHeaderProps) {
  const { t } = useI18n()
  const searchLabel = searchQuery
    ? t(`Search: ${searchQuery}`, `搜索：${searchQuery}`)
    : t("Search", "搜索")
  const desktopControlClassName =
    "h-7 w-auto justify-start gap-1 border-0 bg-transparent px-2 text-[13px] text-foreground/80 shadow-none hover:bg-background/80 hover:text-foreground [&_svg]:size-3.5 [&_svg]:text-muted-foreground"
  const mobileControlClassName =
    "h-8 w-full gap-1 border-0 bg-transparent px-2 text-[13px] text-foreground/80 shadow-none [&_svg]:text-muted-foreground"

  const filterControls = (
    <>
      <Select
        value={languageFilter ?? "all"}
        onValueChange={(value) => onLanguageFilterChange(value === "all" ? null : value)}
      >
        <SelectTrigger className={desktopControlClassName}>
          <SelectValue placeholder={t("Language", "语言")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("All Languages", "全部语言")}</SelectItem>
          {languages.map((lang) => (
            <SelectItem key={lang} value={lang}>
              {lang}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={healthFilter ?? "all"}
        onValueChange={(value) =>
          onHealthFilterChange(value === "all" ? null : (value as RepoHealthFilter))
        }
      >
        <SelectTrigger className={desktopControlClassName}>
          <SelectValue placeholder={t("Health", "状态")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("All Health", "全部状态")}</SelectItem>
          <SelectItem value="archived">{t("Archived", "已归档")}</SelectItem>
          <SelectItem value="dormant">{t("Dormant", "长期未更新")}</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortBy} onValueChange={onSortChange}>
        <SelectTrigger className={desktopControlClassName}>
          <SelectValue placeholder={t("Sort by", "排序")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="starred-desc">
            {t("Date Starred (Newest)", "收藏时间（最新）")}
          </SelectItem>
          <SelectItem value="starred-asc">
            {t("Date Starred (Oldest)", "收藏时间（最早）")}
          </SelectItem>
          <SelectItem value="stars-desc">
            {t("GitHub Stars (High)", "GitHub 星标（从高到低）")}
          </SelectItem>
          <SelectItem value="stars-asc">
            {t("GitHub Stars (Low)", "GitHub 星标（从低到高）")}
          </SelectItem>
          <SelectItem value="updated-desc">{t("Last Updated (Recent)", "最近更新")}</SelectItem>
          <SelectItem value="name-asc">{t("Name (A-Z)", "名称（A-Z）")}</SelectItem>
        </SelectContent>
      </Select>
    </>
  )

  const mobileFilterControls = (
    <>
      <Select
        value={languageFilter ?? "all"}
        onValueChange={(value) => onLanguageFilterChange(value === "all" ? null : value)}
      >
        <SelectTrigger className={`w-full ${mobileControlClassName}`}>
          <SelectValue placeholder={t("Language", "语言")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("All Languages", "全部语言")}</SelectItem>
          {languages.map((lang) => (
            <SelectItem key={lang} value={lang}>
              {lang}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={healthFilter ?? "all"}
        onValueChange={(value) =>
          onHealthFilterChange(value === "all" ? null : (value as RepoHealthFilter))
        }
      >
        <SelectTrigger className={`w-full ${mobileControlClassName}`}>
          <SelectValue placeholder={t("Health", "状态")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("All Health", "全部状态")}</SelectItem>
          <SelectItem value="archived">{t("Archived", "已归档")}</SelectItem>
          <SelectItem value="dormant">{t("Dormant", "长期未更新")}</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortBy} onValueChange={onSortChange}>
        <SelectTrigger className={`w-full ${mobileControlClassName}`}>
          <SelectValue placeholder={t("Sort by", "排序")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="starred-desc">
            {t("Date Starred (Newest)", "收藏时间（最新）")}
          </SelectItem>
          <SelectItem value="starred-asc">
            {t("Date Starred (Oldest)", "收藏时间（最早）")}
          </SelectItem>
          <SelectItem value="stars-desc">
            {t("GitHub Stars (High)", "GitHub 星标（从高到低）")}
          </SelectItem>
          <SelectItem value="stars-asc">
            {t("GitHub Stars (Low)", "GitHub 星标（从低到高）")}
          </SelectItem>
          <SelectItem value="updated-desc">{t("Last Updated (Recent)", "最近更新")}</SelectItem>
          <SelectItem value="name-asc">{t("Name (A-Z)", "名称（A-Z）")}</SelectItem>
        </SelectContent>
      </Select>
    </>
  )

  return (
    <AppPageHeader
      searchLabel={searchLabel}
      desktopControls={filterControls}
      mobileControls={mobileFilterControls}
      lastSynced={lastSynced}
      onCategorize={onCategorize}
      isCategorizing={isCategorizing}
      categorizeLimit={categorizeLimit}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
    />
  )
}
