"use client"

import {
  Bug,
  Check,
  Code2,
  FileText,
  GitPullRequestArrow,
  Circle,
  Loader2,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from "lucide-react"
import type {
  ContributionDifficulty,
  ContributionOpportunity,
  ContributionType,
} from "@/lib/contribution-opportunities"
import { usePaletteGroups } from "@/components/command-palette"

type SelectableType = ContributionType | "all"
type SelectableDifficulty = ContributionDifficulty | "all"

const typeIcons: Record<ContributionType, React.ElementType> = {
  bugfix: Bug,
  docs: FileText,
  tests: Check,
  frontend: Sparkles,
  backend: Code2,
  infra: ShieldAlert,
  feature: GitPullRequestArrow,
  maintenance: Wrench,
}

const typeLabels: Record<ContributionType, string> = {
  bugfix: "Bugfix",
  docs: "Docs",
  tests: "Tests",
  frontend: "Frontend",
  backend: "Backend",
  infra: "Infra",
  feature: "Feature",
  maintenance: "Maintenance",
}

const difficultyColor: Record<SelectableDifficulty, string | undefined> = {
  all: undefined,
  beginner: "#10b981",
  intermediate: "#f59e0b",
  advanced: "#f43f5e",
}

const difficultyLabels: Record<SelectableDifficulty, string> = {
  all: "All difficulties",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
}

export interface ContributionCommandPaletteProps {
  opportunities: ContributionOpportunity[]
  filteredOpportunities: ContributionOpportunity[]
  language: string
  difficulty: SelectableDifficulty
  contributionType: SelectableType
  languageOptions: [string, number][]
  search: string
  isLoadingOpportunities: boolean
  isRefreshing: boolean
  onLanguageChange: (lang: string) => void
  onDifficultyChange: (diff: SelectableDifficulty) => void
  onContributionTypeChange: (type: SelectableType) => void
  onSearchChange: (text: string) => void
  onScanIssues: () => void
  onRefresh: () => void
  onClearFilters: () => void
}

const DIFFICULTIES: SelectableDifficulty[] = ["all", "beginner", "intermediate", "advanced"]
const CONTRIBUTION_TYPES: ContributionType[] = [
  "bugfix",
  "docs",
  "tests",
  "frontend",
  "backend",
  "infra",
  "feature",
  "maintenance",
]

/** Contribute's commands in the app-wide palette. Renders nothing. */
export function ContributionCommandPalette(p: ContributionCommandPaletteProps) {
  const hasActiveFilters = Boolean(
    p.search || p.language !== "all" || p.difficulty !== "all" || p.contributionType !== "all",
  )
  usePaletteGroups({
    placeholder: "Search issues, jump to a repo, or change filters...",
    search: { label: "Filter opportunities", run: p.onSearchChange },
    groups: [
      {
        heading: "Opportunities",
        limit: 20,
        items: p.opportunities.map((opp) => ({
          id: `opp-${opp.id}`,
          label: opp.title,
          hint: opp.repoFullName,
          keywords: [opp.repoLanguage, opp.difficulty, ...opp.contributionTypes].join(" "),
          icon: GitPullRequestArrow,
          onSelect: () => window.open(opp.htmlUrl, "_blank", "noreferrer"),
        })),
      },
      {
        heading: "Contribute actions",
        items: [
          {
            id: "contrib-scan",
            label: "Scan for contribution opportunities",
            keywords: "issues good first",
            icon: p.isLoadingOpportunities ? Loader2 : Sparkles,
            iconClassName: p.isLoadingOpportunities ? "animate-spin" : undefined,
            disabled: p.isLoadingOpportunities,
            onSelect: p.onScanIssues,
          },
          {
            id: "contrib-clear",
            label: "Clear all filters",
            keywords: "reset",
            icon: SlidersHorizontal,
            disabled: !hasActiveFilters,
            onSelect: p.onClearFilters,
          },
        ],
      },
      {
        heading: "Language",
        limit: 12,
        items: [
          {
            id: "lang-all",
            label: "All languages",
            checked: p.language === "all",
            onSelect: () => p.onLanguageChange("all"),
          },
          ...p.languageOptions.map(([name, count]) => ({
            id: `lang-${name}`,
            label: name,
            shortcut: String(count),
            checked: p.language === name,
            onSelect: () => p.onLanguageChange(name),
          })),
        ],
      },
      {
        heading: "Difficulty",
        items: DIFFICULTIES.map((d) => ({
          id: `diff-${d}`,
          label: difficultyLabels[d],
          icon: Circle,
          iconColor: difficultyColor[d],
          iconClassName: p.difficulty === d ? "fill-current" : undefined,
          onSelect: () => p.onDifficultyChange(d),
        })),
      },
      {
        heading: "Contribution type",
        items: [
          {
            id: "type-all",
            label: "Any type",
            checked: p.contributionType === "all",
            onSelect: () => p.onContributionTypeChange("all"),
          },
          ...CONTRIBUTION_TYPES.map((t) => ({
            id: `type-${t}`,
            label: typeLabels[t],
            icon: typeIcons[t] as never,
            onSelect: () => p.onContributionTypeChange(t),
          })),
        ],
      },
    ],
  })
  return null
}
