import type { ElementType } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  Activity,
  ArrowRight,
  Bot,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock,
  Code2,
  Compass,
  Copy,
  Database,
  FileText,
  FolderTree,
  GitPullRequestArrow,
  History,
  KeyRound,
  LayoutDashboard,
  ListFilter,
  Lock,
  Pin,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tags,
  TrendingUp,
  Zap,
} from "lucide-react"

import { LandingAuthButtons } from "@/components/landing-auth-buttons"
import { LandingHeroMedia } from "@/components/landing-hero-media"
import { LandingThemeToggle } from "@/components/landing-theme-toggle"
import { GitHubIcon } from "@/components/icons/github-icon"
import { BorderBeam } from "@/components/ui/border-beam"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

const painPoints = [
  {
    title: "Stars are a weak memory system",
    copy: "GitHub remembers that you clicked a star. It does not remember why, where it fits, whether you tried it, or what you wanted to compare it against.",
  },
  {
    title: "Search breaks when intent is fuzzy",
    copy: "The repo name is rarely the thing you remember. You remember the use case: async runtime, auth library, promising CLI, abandoned dependency.",
  },
  {
    title: "Evaluation context gets scattered",
    copy: "READMEs, issue health, notes, contribution candidates, and trend signals live in separate tabs. StarDash pulls them into one operating surface.",
  },
]

const featureCards = [
  {
    icon: LayoutDashboard,
    title: "Curation dashboard",
    copy: "Sync up to 5,000 starred repositories, then filter by language, status, tag, collection, archived state, or uncategorized state.",
    meta: "Grid/list views",
  },
  {
    icon: Search,
    title: "Search your own memory",
    copy: "Search repo names, owners, descriptions, private notes, and tags without rebuilding context from GitHub every time.",
    meta: "Notes included",
  },
  {
    icon: Sparkles,
    title: "AI taxonomy pass",
    copy: "Generate 5-12 collections and a shared tag vocabulary from your starred repos, then review and edit the result.",
    meta: "You stay in control",
  },
  {
    icon: Brain,
    title: "Repo Intel",
    copy: "Run AI-assisted repo analysis with health score, maintenance verdict, adoption readiness, pain points, and practical recommendations.",
    meta: "Cached per repo",
  },
  {
    icon: GitPullRequestArrow,
    title: "Contribution finder",
    copy: "Scan open issues across starred repos, rank them by fit and quality, then generate a concise brief before you start.",
    meta: "Issue triage",
  },
  {
    icon: Compass,
    title: "Discover search",
    copy: "Describe what you are building and StarDash runs an AI-guided GitHub repository search with saved searches and personalized themes.",
    meta: "Intent-first search",
  },
  {
    icon: TrendingUp,
    title: "Trending signals",
    copy: "Analyze your most recent starred repos to surface popular, active, and hidden-gem repositories already related to your interests.",
    meta: "Seeded from recent stars",
  },
  {
    icon: History,
    title: "Recently viewed",
    copy: "Jump back into repos you opened from dashboard, trending, or detail views without retracing your filters.",
    meta: "Local history",
  },
]

const workflowSteps = [
  {
    step: "01",
    title: "Connect GitHub",
    copy: "Supabase OAuth stores the provider token server-side so StarDash can sync your starred repositories and refresh metadata.",
    icon: GitHubIcon,
  },
  {
    step: "02",
    title: "Make the backlog navigable",
    copy: "Use search, sorting, pinned repos, status labels, tags, and collections to turn passive stars into an active reference library.",
    icon: SlidersHorizontal,
  },
  {
    step: "03",
    title: "Add judgment",
    copy: "Attach notes, read READMEs inline, inspect repo health, and generate contribution briefs when a repo deserves a closer look.",
    icon: BookOpen,
  },
  {
    step: "04",
    title: "Keep resurfacing value",
    copy: "Use recently viewed history, Discover searches, and trend buckets to find the right tool when the original star is long forgotten.",
    icon: TrendingUp,
  },
]

const statusLabels = [
  "Want to Try",
  "Currently Using",
  "Tried - Liked",
  "Tried - Dropped",
  "Just Interesting",
  "Reference",
]

const routes = [
  { href: "#tour", label: "Tour" },
  { href: "#contribute", label: "Contribute" },
  { href: "#agentic-search", label: "Search" },
  { href: "#security", label: "Security" },
  { href: "#features", label: "Features" },
]

function SectionHeader({
  eyebrow,
  title,
  copy,
  align = "left",
}: {
  eyebrow: string
  title: string
  copy?: string
  align?: "left" | "center"
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <div className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {eyebrow}
      </div>
      <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {copy && (
        <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
          {copy}
        </p>
      )}
    </div>
  )
}

function MiniBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "amber" | "blue" | "rose" }) {
  const tones = {
    neutral: "border-black/10 bg-black/[0.04] text-muted-foreground dark:border-white/10 dark:bg-white/[0.05]",
    green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    blue: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    rose: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

function SnapshotShell({
  title,
  eyebrow,
  icon: Icon,
  children,
  className = "",
}: {
  title: string
  eyebrow: string
  icon: ElementType
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`overflow-hidden rounded-lg border border-black/10 bg-background shadow-[0_18px_70px_-42px_rgba(15,23,42,0.55)] dark:border-white/10 dark:bg-zinc-950 ${className}`}>
      <div className="flex items-center justify-between border-b border-black/8 bg-black/[0.025] px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-black/10 bg-background dark:border-white/10">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{title}</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</div>
          </div>
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          <span className="h-2 w-2 rounded-full bg-rose-400/70" />
          <span className="h-2 w-2 rounded-full bg-amber-400/70" />
          <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function DashboardSnapshot() {
  const repos = [
    { name: "vercel/next.js", lang: "TypeScript", stars: "128k", status: "Currently Using", tone: "green" as const },
    { name: "astral-sh/uv", lang: "Rust", stars: "62k", status: "Want to Try", tone: "blue" as const },
    { name: "charmbracelet/bubbletea", lang: "Go", stars: "31k", status: "Reference", tone: "neutral" as const },
  ]

  return (
    <SnapshotShell title="Dashboard" eyebrow="Curated star library" icon={LayoutDashboard}>
      <div className="grid gap-4 lg:grid-cols-[160px_1fr]">
        <div className="space-y-2 rounded-lg border border-black/8 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035]">
          {["AI & ML", "Frontend", "CLI Tools", "Databases"].map((item, index) => (
            <div key={item} className="flex items-center justify-between rounded-md px-2 py-2 text-xs text-muted-foreground">
              <span>{item}</span>
              <span className="font-mono text-[10px]">{[42, 81, 33, 18][index]}</span>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-black/8 bg-black/[0.025] px-3 py-2 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.035]">
            <Search className="h-3.5 w-3.5" />
            notes: background jobs tag:rust status:want-to-try
          </div>
          <div className="grid gap-2">
            {repos.map((repo) => (
              <div key={repo.name} className="rounded-lg border border-black/8 bg-background p-3 dark:border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-xs">{repo.name}</span>
                      <Pin className="h-3 w-3 text-muted-foreground/60" />
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{repo.lang} · {repo.stars} stars · README cached</div>
                  </div>
                  <MiniBadge tone={repo.tone}>{repo.status}</MiniBadge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SnapshotShell>
  )
}

function SearchSnapshot() {
  return (
    <SnapshotShell title="Discover" eyebrow="Intent-first repository search" icon={Compass}>
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <Search className="h-4 w-4" />
            prod-ready CLI frameworks
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {["parse intent", "search GitHub", "rank evidence"].map((step) => (
              <div key={step} className="rounded-md border border-emerald-500/15 bg-background/80 px-2.5 py-2 text-[11px] text-muted-foreground">
                {step}
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["oclif/core", "Command framework for Node.js CLIs", "TypeScript"],
            ["urfave/cli", "Simple, fast package for Go CLIs", "Go"],
          ].map(([repo, copy, lang]) => (
            <div key={repo} className="rounded-lg border border-black/8 p-3 dark:border-white/10">
              <div className="font-mono text-xs">{repo}</div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{copy}</p>
              <div className="mt-3 flex items-center justify-between">
                <MiniBadge tone="blue">{lang}</MiniBadge>
                <span className="text-[11px] text-muted-foreground">saved search</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SnapshotShell>
  )
}

function IntelSnapshot() {
  return (
    <SnapshotShell title="Repo Intel" eyebrow="Maintenance and adoption read" icon={Brain}>
      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <div className="rounded-lg border border-black/8 bg-black/[0.025] p-4 text-center dark:border-white/10 dark:bg-white/[0.035]">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-emerald-500/70 text-2xl font-semibold text-emerald-600 dark:text-emerald-300">
            84
          </div>
          <div className="mt-3 text-xs font-medium">Healthy</div>
          <div className="mt-1 text-[11px] text-muted-foreground">production ready</div>
        </div>
        <div className="space-y-2">
          {[
            ["Maintenance", "Actively maintained", "green" as const],
            ["Community", "Mixed sentiment", "amber" as const],
            ["Release cadence", "Recent release found", "blue" as const],
          ].map(([label, value, tone]) => (
            <div key={label} className="flex items-center justify-between rounded-lg border border-black/8 px-3 py-2 dark:border-white/10">
              <span className="text-xs text-muted-foreground">{label}</span>
              <MiniBadge tone={tone}>{value}</MiniBadge>
            </div>
          ))}
          <div className="rounded-lg border border-black/8 p-3 text-xs leading-5 text-muted-foreground dark:border-white/10">
            Recommendation: good candidate for production usage after checking open migration issues.
          </div>
        </div>
      </div>
    </SnapshotShell>
  )
}

function ContributionSnapshot() {
  return (
    <SnapshotShell title="Contribute" eyebrow="Ranked issue opportunities" icon={GitPullRequestArrow}>
      <div className="space-y-3">
        {[
          ["Add test coverage for config parser", "beginner", "tests", "86"],
          ["Improve docs for custom providers", "beginner", "docs", "78"],
          ["Refactor release workflow retry logic", "intermediate", "infra", "64"],
        ].map(([title, level, type, score]) => (
          <div key={title} className="rounded-lg border border-black/8 p-3 dark:border-white/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{title}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <MiniBadge tone="green">{level}</MiniBadge>
                  <MiniBadge tone="neutral">{type}</MiniBadge>
                  <MiniBadge tone="amber">AI brief</MiniBadge>
                </div>
              </div>
              <div className="rounded-md border border-black/10 px-2 py-1 font-mono text-xs dark:border-white/10">
                {score}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SnapshotShell>
  )
}

function ContributeDeepDiveSection() {
  const opportunities = [
    {
      repo: "vercel/next.js",
      issue: "Improve docs for route cache invalidation",
      score: "88%",
      difficulty: "beginner",
      type: "docs",
      reason: "Maintainers classified the issue",
    },
    {
      repo: "charmbracelet/bubbletea",
      issue: "Add regression test for resize event handling",
      score: "81%",
      difficulty: "beginner",
      type: "tests",
      reason: "Small scoped contribution",
    },
    {
      repo: "tursodatabase/libsql",
      issue: "Clarify Docker workflow failure mode",
      score: "73%",
      difficulty: "intermediate",
      type: "infra",
      reason: "Recently active discussion",
    },
  ]

  return (
    <section className="border-t border-black/8 dark:border-white/10" id="contribute">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
        <div>
          <SectionHeader
            eyebrow="Contribute workspace"
            title="Turn favorite repos into open-source work you can actually start."
            copy="The Contribute page scans active starred repos with open issues, ranks opportunities by fit and quality, then gives you filters and an AI brief so you can decide what is worth opening."
          />

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              [ListFilter, "Filter the work", "Language, difficulty, contribution type, and text search over repo or issue title."],
              [GitPullRequestArrow, "Ranked issue feed", "Scores blend labels, body context, recency, comments, pinned repos, risks, and repo activity."],
              [Bot, "AI contribution brief", "Summary, why it fits, first steps, likely files, questions to ask, and a prompt."],
              [Copy, "Assistant-ready handoff", "Copy the generated coding assistant prompt and paste it into Codex, Claude Code, or another tool."],
            ].map(([Icon, title, copy]) => (
              <div key={String(title)} className="rounded-lg border border-black/8 bg-background/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="mt-3 text-sm font-semibold">{title as string}</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{copy as string}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-lg border border-black/8 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.025]">
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              AI brief schema
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["summary", "whyItFits", "firstSteps", "likelyFiles", "questionsToAsk", "codingAssistantPrompt"].map((field) => (
                <MiniBadge key={field} tone={field === "codingAssistantPrompt" ? "green" : "neutral"}>
                  {field}
                </MiniBadge>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SnapshotShell title="Contribute" eyebrow="Open issue workspace" icon={GitPullRequestArrow}>
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-4">
                {["TypeScript", "Beginner", "Docs", "cache"].map((filter, index) => (
                  <div key={filter} className="rounded-lg border border-black/8 bg-black/[0.025] px-3 py-2 dark:border-white/10 dark:bg-white/[0.035]">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60">
                      {["language", "difficulty", "type", "search"][index]}
                    </div>
                    <div className="mt-1 truncate text-xs font-medium">{filter}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="rounded-lg border border-black/8 bg-background px-3 py-2 dark:border-white/10">
                  <span className="text-sm font-semibold tabular-nums">24</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">Matches</span>
                </div>
                <div className="rounded-lg border border-black/8 bg-background px-3 py-2 dark:border-white/10">
                  <span className="text-sm font-semibold tabular-nums">11</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">Beginner</span>
                </div>
                <div className="rounded-lg border border-black/8 bg-background px-3 py-2 dark:border-white/10">
                  <span className="text-sm font-semibold tabular-nums">40</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">Repos scanned</span>
                </div>
              </div>

              <div className="grid gap-3">
                {opportunities.map((opportunity) => (
                  <div key={opportunity.issue} className="rounded-lg border border-black/8 bg-background p-3 dark:border-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-mono text-xs">{opportunity.repo}</span>
                          <MiniBadge tone={opportunity.difficulty === "beginner" ? "green" : "amber"}>
                            {opportunity.difficulty}
                          </MiniBadge>
                          <MiniBadge>{opportunity.type}</MiniBadge>
                        </div>
                        <div className="mt-2 text-sm font-medium leading-snug">{opportunity.issue}</div>
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          {opportunity.reason}
                        </div>
                      </div>
                      <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 font-mono text-xs text-emerald-700 dark:text-emerald-300">
                        {opportunity.score}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SnapshotShell>

          <SnapshotShell title="Contribution brief" eyebrow="Ready-to-copy issue plan" icon={Bot}>
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-3">
                <div className="rounded-lg border border-black/8 p-3 dark:border-white/10">
                  <div className="text-xs font-medium">Summary</div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Clarify when route cache invalidation runs and add a short example for nested layouts.
                  </p>
                </div>
                <div className="rounded-lg border border-black/8 p-3 dark:border-white/10">
                  <div className="text-xs font-medium">First steps</div>
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-5 text-muted-foreground">
                    <li>Read the issue and linked discussion.</li>
                    <li>Find docs covering cache invalidation.</li>
                    <li>Add the smallest example that answers the report.</li>
                  </ol>
                </div>
              </div>

              <div className="rounded-lg border border-black/8 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035]">
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-mono text-[11px] text-muted-foreground">codingAssistantPrompt</div>
                  <MiniBadge tone="green">
                    <Copy className="mr-1 h-3 w-3" />
                    copy
                  </MiniBadge>
                </div>
                <pre className="whitespace-pre-wrap break-words rounded-md bg-background p-3 font-mono text-[11px] leading-5 text-muted-foreground">
{`You are helping resolve GitHub issue #4821 in vercel/next.js.

Goal: improve docs for route cache invalidation.
Start by inspecting the docs routing cache section, then propose the smallest docs patch with a runnable example.`}
                </pre>
              </div>
            </div>
          </SnapshotShell>
        </div>
      </div>
    </section>
  )
}

function AgenticSearchDeepDiveSection() {
  const pipeline = [
    ["auth", "Session", "Choose authenticated or public GitHub search mode."],
    ["expand", "Intent expansion", "Generate 3-5 targeted GitHub search queries."],
    ["github", "GitHub retrieval", "Fetch public repository candidates in parallel."],
    ["dedupe", "Candidate merge", "Remove duplicates across expanded searches."],
    ["rerank", "AI rerank", "Score every candidate and attach evidence notes."],
    ["render", "Result shaping", "Sort and trim the final ranked grid."],
  ]

  return (
    <section className="border-t border-black/8 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.015]" id="agentic-search">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div className="space-y-4">
          <SnapshotShell title="Discover pipeline" eyebrow="Streaming AI search stages" icon={Compass}>
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  <Search className="h-4 w-4" />
                  libraries for local-first collaborative whiteboards
                </div>
                <p className="mt-2 text-xs leading-5 text-emerald-800/70 dark:text-emerald-200/70">
                  Search by intent, product need, stack constraint, or fuzzy description. The backend expands it into GitHub syntax before ranking.
                </p>
              </div>

              <div className="grid gap-2 lg:grid-cols-3">
                {pipeline.map(([id, title, detail], index) => (
                  <div key={id} className="rounded-lg border border-black/8 bg-background p-3 dark:border-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10 font-mono text-[11px] text-emerald-700 dark:text-emerald-300">
                        {index + 1}
                      </div>
                      <MiniBadge tone={index < 5 ? "green" : "blue"}>{index < 5 ? "complete" : "ready"}</MiniBadge>
                    </div>
                    <div className="mt-3 text-xs font-semibold">{title}</div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{detail}</p>
                    <div className="mt-2 font-mono text-[10px] text-muted-foreground/50">{id}</div>
                  </div>
                ))}
              </div>
            </div>
          </SnapshotShell>

          <SnapshotShell title="Ranked results" eyebrow="Evidence-backed repo grid" icon={Search}>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                ["yjs/yjs", "CRDT framework for shared data types", "9.4", ["local-first sync", "collaboration core", "active docs"]],
                ["tldraw/tldraw", "SDK for infinite canvas whiteboards", "8.9", ["whiteboard intent", "React examples", "high stars"]],
              ].map(([repo, copy, score, evidence]) => (
                <div key={repo as string} className="rounded-lg border border-black/8 bg-background p-3 dark:border-white/10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs">{repo as string}</div>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{copy as string}</p>
                    </div>
                    <MiniBadge tone="green">{score as string}/10</MiniBadge>
                  </div>
                  <div className="mt-3 space-y-1.5 border-t border-black/8 pt-3 dark:border-white/10">
                    {(evidence as string[]).map((item) => (
                      <div key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 text-emerald-500" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SnapshotShell>
        </div>

        <div>
          <SectionHeader
            eyebrow="Agentic search pipeline"
            title="Describe the repo you need. StarDash searches like a researcher, not a keyword box."
            copy="Discover accepts natural language intent, expands it into targeted GitHub queries, retrieves candidates, dedupes them, reranks every repo with AI, and returns up to 24 evidence-backed results."
          />

          <div className="mt-8 space-y-3">
            {[
              ["3-5 query expansions", "The model generates GitHub search syntax with operators like stars, language, topic, and public visibility."],
              ["Parallel candidate retrieval", "Each expanded query hits GitHub repository search, then duplicate full names are merged."],
              ["0-10 relevance score", "AI reranking attaches a score and exactly three short evidence notes for each repository."],
              ["Saved and cached searches", "Fresh cached results can be reused, saved searches are preserved, and cache hits do not spend AI quota."],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-lg border border-black/8 bg-background/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{copy}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-black/8 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.025]">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Code2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Streaming feedback
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              The UI consumes an NDJSON stream, so users see each backend stage complete instead of waiting on a blank loading state.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function SecurityPrivacySection() {
  const controls = [
    {
      icon: ShieldCheck,
      title: "Session checks on every request",
      copy: "Supabase middleware refreshes the session and protected routes validate users with `supabase.auth.getUser()` before loading app data.",
      signal: "Supabase Auth",
    },
    {
      icon: Lock,
      title: "GitHub tokens stay server-side",
      copy: "OAuth access uses an `httpOnly`, `sameSite=lax` cookie. If that cookie expires or is missing, route handlers repair it from a server-only token table.",
      signal: "8h cookie",
    },
    {
      icon: Database,
      title: "Your metadata is scoped to you",
      copy: "Tags, collections, notes, statuses, saved Discover searches, and repo assignments use RLS policies keyed to `auth.uid()`.",
      signal: "RLS",
    },
    {
      icon: KeyRound,
      title: "Bring your own AI key",
      copy: "Optional AI provider keys are saved in your browser localStorage, sent as request headers only for AI calls, and can be cleared from Settings.",
      signal: "Local key",
    },
  ]

  return (
    <section id="security" className="border-t border-black/8 dark:border-white/10">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {controls.map(({ icon: Icon, title, copy, signal }) => (
              <div key={title} className="rounded-lg border border-black/8 bg-background/75 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.04]">
                    <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <MiniBadge tone="green">{signal}</MiniBadge>
                </div>
                <h3 className="mt-5 text-sm font-semibold">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{copy}</p>
              </div>
            ))}
          </div>

          <SnapshotShell title="Trust boundaries" eyebrow="What runs where" icon={Server}>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  title: "Browser",
                  rows: ["Theme + view cache", "Optional AI key", "Recently viewed history"],
                },
                {
                  title: "Server routes",
                  rows: ["GitHub token lookup", "AI provider selection", "Sentry error capture"],
                },
                {
                  title: "Supabase",
                  rows: ["Auth sessions", "RLS user metadata", "Service-role admin jobs"],
                },
              ].map((column) => (
                <div key={column.title} className="rounded-lg border border-black/8 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="text-xs font-semibold">{column.title}</div>
                  <div className="mt-3 space-y-2">
                    {column.rows.map((row) => (
                      <div key={row} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                        {row}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-black/8 bg-background p-3 dark:border-white/10">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Guardrails
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  System-key AI calls are rate-limited, cron and observability test routes require `CRON_SECRET`, and cached Discover searches are capped per user.
                </p>
              </div>
              <div className="rounded-lg border border-black/8 bg-background p-3 dark:border-white/10">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  Observability
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Sentry records runtime errors and Langfuse receives AI SDK telemetry only when configured, with traces flushed from long-running AI routes.
                </p>
              </div>
            </div>
          </SnapshotShell>
        </div>

        <div>
          <SectionHeader
            eyebrow="Security & privacy"
            title="Built around private developer context, not public leaderboards."
            copy="StarDash stores personal repo context behind your authenticated account, keeps GitHub access out of client code, and makes AI usage explicit."
          />

          <div className="mt-8 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-900 dark:text-amber-100">
            <div className="flex items-center gap-2 font-medium">
              <ShieldCheck className="h-4 w-4" />
              Plain-language privacy boundary
            </div>
            <p className="mt-2 text-amber-900/75 dark:text-amber-100/75">
              Repo metadata, notes, tags, and search/AI outputs are used to power your workspace. AI features send the relevant prompt context to the configured model provider; using your own key routes those calls through the provider you choose.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  copy,
  meta,
}: {
  icon: ElementType
  title: string
  copy: string
  meta: string
}) {
  return (
    <div className="group rounded-lg border border-black/8 bg-black/[0.02] p-5 transition-colors hover:border-black/15 hover:bg-black/[0.035] dark:border-white/10 dark:bg-white/[0.025] dark:hover:border-white/20 dark:hover:bg-white/[0.045]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/10 bg-background dark:border-white/10">
          <Icon className="h-4 w-4" />
        </div>
        <span className="rounded-full border border-black/8 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground dark:border-white/10">
          {meta}
        </span>
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
    </div>
  )
}

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_80%_12%,rgba(14,165,233,0.10),transparent_26%)] dark:bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.14),transparent_28%),radial-gradient(circle_at_80%_12%,rgba(14,165,233,0.12),transparent_26%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(0,0,0,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.045)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(to_bottom,white,transparent_72%)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)]" />

      <header className="sticky top-0 z-40 border-b border-black/8 bg-background/82 backdrop-blur-xl dark:border-white/10">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
              <Star className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">StarDash</div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                GitHub curation
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            {routes.map((route) => (
              <Link key={route.href} href={route.href} className="transition-colors hover:text-foreground">
                {route.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LandingThemeToggle />
            <LandingAuthButtons />
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 pb-16 pt-14 sm:px-6 lg:px-8 lg:pb-24 lg:pt-20">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                <GitHubIcon className="h-3.5 w-3.5" />
                Star it. Understand it. Find it again.
              </div>

              <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.055em] text-balance sm:text-6xl lg:text-7xl">
                Turn GitHub stars into an actual developer workspace.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                StarDash syncs your starred repositories, adds tags, collections, notes, AI repo analysis, contribution triage, and intent-first discovery so saved projects become useful again.
              </p>

              <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <div className="relative flex w-full rounded-lg sm:inline-flex sm:w-auto">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 w-full justify-center border border-black/10 bg-zinc-950 text-white hover:bg-zinc-800 dark:border-white/10 dark:bg-white dark:text-black dark:hover:bg-zinc-200 sm:h-11 sm:w-auto"
                  >
                    <Link href="/auth/login">
                      Sign in with GitHub
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <BorderBeam
                    size={72}
                    duration={8}
                    colorFrom="#10b981"
                    colorTo="#0ea5e9"
                    borderWidth={1.5}
                  />
                </div>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 w-full justify-center border-black/10 bg-background/60 hover:bg-black/5 dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.06] sm:h-11 sm:w-auto"
                >
                  <Link href="#tour">View app surfaces</Link>
                </Button>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {[
                  ["5,000", "repos per sync pass"],
                  ["6", "workflow statuses"],
                  ["24h", "client cache window"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-lg border border-black/8 bg-background/65 p-4 dark:border-white/10 dark:bg-white/[0.035]">
                    <div className="font-mono text-2xl font-semibold tracking-tight">{value}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:pt-8">
              <LandingHeroMedia />
            </div>
          </div>
        </section>

        <section className="border-y border-black/8 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.025]">
          <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 md:grid-cols-3 lg:px-8">
            {["Search notes, tags, status, language, and owner", "Read README and repo intel without tab sprawl", "Find contribution issues before context goes cold"].map((item) => (
              <div key={item} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8" id="pain">
          <SectionHeader
            eyebrow="The pain"
            title="Starring a repo is easy. Recovering the reason later is the hard part."
            copy="StarDash is built for developers who use stars as research, backlog, evaluation queue, and long-term reference, then need more than GitHub's native starred page."
          />

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {painPoints.map((item, index) => (
              <div key={item.title} className="rounded-lg border border-black/8 bg-background/70 p-6 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="font-mono text-xs text-muted-foreground/60">0{index + 1}</div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="tour" className="border-t border-black/8 dark:border-white/10">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Product tour"
              title="A homepage that shows the app, not a vague promise."
              copy="The public page now mirrors the real product: curation dashboard, Discover search, repo intelligence, and contribution triage."
            />

            <div className="mt-12 grid gap-5">
              <DashboardSnapshot />
              <div className="grid gap-5 lg:grid-cols-2">
                <SearchSnapshot />
                <IntelSnapshot />
              </div>
              <ContributionSnapshot />
            </div>
          </div>
        </section>

        <ContributeDeepDiveSection />

        <AgenticSearchDeepDiveSection />

        <section id="features" className="border-t border-black/8 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.015]">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Feature set"
              title="Everything is centered on one job: make saved repos usable."
              copy="StarDash covers the full loop from sync and organization to evaluation, rediscovery, and contribution planning."
            />

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featureCards.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-black/8 dark:border-white/10">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
            <div>
              <SectionHeader
                eyebrow="Personal taxonomy"
                title="Tags, collections, statuses, notes, and pins explain why a repo matters."
                copy="The dashboard stores user-owned metadata separately from the global repo catalog, so your labels, notes, and workflow state remain personal."
              />
              <div className="mt-8 flex flex-wrap gap-2">
                {statusLabels.map((status, index) => (
                  <MiniBadge key={status} tone={index === 1 ? "green" : index === 0 ? "blue" : index === 3 ? "amber" : "neutral"}>
                    {status}
                  </MiniBadge>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-black/8 bg-background/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  [Tags, "Tag vocabulary", "Create, edit, color, and delete tags from Settings or while assigning repos."],
                  [FolderTree, "Collections", "Group related repositories and track repo counts across your personal taxonomy."],
                  [FileText, "Private notes", "Attach freeform notes and save them directly from the repo detail drawer."],
                  [Pin, "Pinned repos", "Keep the repos you actually use above the long tail."],
                ].map(([Icon, title, copy]) => (
                  <div key={String(title)} className="rounded-lg border border-black/8 p-4 dark:border-white/10">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.04]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold">{title as string}</h3>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{copy as string}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="border-t border-black/8 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Workflow"
              title="A practical loop for repo research."
              copy="No CSV import flow and no separate knowledge base to maintain. The app starts from your GitHub stars and keeps the workflow close to the repos."
              align="center"
            />

            <div className="mt-12 grid gap-4 lg:grid-cols-4">
              {workflowSteps.map((step) => {
                const Icon = step.icon
                return (
                  <div key={step.step} className="rounded-lg border border-black/8 bg-background p-5 dark:border-white/10 dark:bg-zinc-950">
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.04]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-mono text-xs text-muted-foreground/50">{step.step}</span>
                    </div>
                    <h3 className="mt-6 text-lg font-semibold tracking-tight">{step.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.copy}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="border-t border-black/8 dark:border-white/10">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div className="space-y-6">
              <SectionHeader
                eyebrow="AI where it helps"
                title="The AI features do first-pass organization and evaluation, then get out of your way."
                copy="StarDash uses model calls for taxonomy generation, personalized Discover themes, repo intel, and contribution briefs. The outputs are editable, cached where useful, and tied back to concrete repo data."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  [Sparkles, "Taxonomy", "Collections and 15-25 tags from repo summaries."],
                  [Compass, "Discover", "Adjacent search themes from your starred repo sample."],
                  [Brain, "Intel", "Health scores, sentiment, readiness, and recommendations."],
                  [Code2, "Briefs", "Issue summaries, first steps, likely files, and assistant prompts."],
                ].map(([Icon, title, copy]) => (
                  <div key={String(title)} className="rounded-lg border border-black/8 p-4 dark:border-white/10">
                    <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <div className="mt-3 text-sm font-semibold">{title as string}</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">{copy as string}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-black/8 bg-background/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">AI operations panel</div>
                  <div className="text-xs text-muted-foreground">Representative system events</div>
                </div>
                <MiniBadge tone="green">telemetry enabled</MiniBadge>
              </div>
              <div className="space-y-3">
                {[
                  ["categorize-taxonomy", "500 repo summaries", "complete"],
                  ["personalized-theme-search", "100 repo sample", "cached"],
                  ["contribution-brief", "issue metadata", "ready"],
                  ["repo-intel", "health metrics", "shared cache"],
                ].map(([name, detail, state]) => (
                  <div key={name} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-black/8 px-3 py-3 dark:border-white/10">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs">{name}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{detail}</div>
                    </div>
                    <MiniBadge tone={state === "complete" ? "green" : state === "cached" ? "blue" : "neutral"}>{state}</MiniBadge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <SecurityPrivacySection />

        <section className="border-t border-black/8 dark:border-white/10">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-8 px-4 py-24 text-center sm:px-6 lg:px-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
              <Zap className="h-5 w-5" />
            </div>
            <div className="max-w-2xl">
              <h2 className="text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">
                Stop treating GitHub stars like a junk drawer.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted-foreground">
                Connect GitHub once. Sync the backlog, organize it, inspect the repos that matter, and return to the right project when you need it.
              </p>
            </div>
            <div className="relative inline-flex rounded-lg">
              <Button
                asChild
                size="lg"
                className="h-12 border border-black/10 bg-zinc-950 px-8 text-white hover:bg-zinc-800 dark:border-white/10 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                <Link href="/auth/login">
                  Sign in with GitHub
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <BorderBeam
                size={84}
                duration={8}
                colorFrom="#10b981"
                colorTo="#0ea5e9"
                borderWidth={1.5}
              />
            </div>
            <p className="font-mono text-xs text-muted-foreground/55">
              Your stars, notes, tags, and collections stay tied to your account.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/8 dark:border-white/10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 text-sm text-muted-foreground sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <FolderTree className="h-4 w-4" />
            StarDash turns saved repos into a working library.
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <Link href="/auth/login" className="hover:text-foreground">
              Log in
            </Link>
            <Link href="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/search" className="hover:text-foreground">
              Discover
            </Link>
            <Link href="/intel" className="hover:text-foreground">
              Intel
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
