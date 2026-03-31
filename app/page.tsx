import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowRight,
  BookOpen,
  FolderTree,
  Github,
  Search,
  Sparkles,
  Star,
  Tags,
  TrendingUp,
  Zap,
  FileText,
  ArrowUpRight,
} from "lucide-react"

import { LandingHeroMedia } from "@/components/landing-hero-media"
import { LandingThemeToggle } from "@/components/landing-theme-toggle"
import { BorderBeam } from "@/components/ui/border-beam"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

const workflow = [
  {
    step: "01",
    title: "Connect and sync in one OAuth step",
    copy: "StarDash paginates through up to 5,000 starred repos in a single background pass. One auth handshake — no manual imports, no CSV uploads.",
    detail: "Up to 5,000 repos · background sync · zero config",
  },
  {
    step: "02",
    title: "Apply taxonomy in bulk or incrementally",
    copy: "Run an AI classification pass to draft your structure in minutes, or tag repos one-by-one. Both paths leave you in full control of the final shape.",
    detail: "AI pass · manual override · no lock-in",
  },
  {
    step: "03",
    title: "Resurface with full context attached",
    copy: "Open any repo and find your notes, status, tags, and the rendered README — not just a redirect back to GitHub.",
    detail: "Inline README · private notes · status labels",
  },
  {
    step: "04",
    title: "Stay current with trending signals",
    copy: "StarDash surfaces repos gaining momentum across your tags and languages. Catch the tools your peers are adopting before your feed buries them.",
    detail: "Rising star signals · language trends · weekly digest",
  },
]

const personas = [
  {
    type: "The Researcher",
    description:
      "Stars papers, spec repos, and reference implementations. Needs to find that one Rust async runtime from six months ago without scrolling forever.",
    tags: ["reference", "ml-research", "systems"],
  },
  {
    type: "The Builder",
    description:
      "Stars libraries before evaluating them. Needs to track what they tried, what they dropped, and what's sitting in the backlog waiting for the right project.",
    tags: ["want-to-try", "currently-using", "tried-dropped"],
  },
  {
    type: "The Collector",
    description:
      "Stars everything interesting — tooling, OSS projects, ideas. Needs a way to turn a 2,000-star pile into something they can actually navigate.",
    tags: ["devtools", "just-interesting", "taxonomy"],
  },
]

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background — visible in both modes */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.04),transparent_34%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_34%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(to_bottom,white,transparent_85%)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)]" />

      <header className="border-b border-black/8 dark:border-white/10">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
              <Star className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">StarDash</div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Github Curation
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <LandingThemeToggle />
            <Button asChild variant="ghost" className="text-muted-foreground hover:text-foreground">
              <Link href="/auth/login">Log in</Link>
            </Button>
            <Button
              asChild
              className="border border-black/10 bg-zinc-900 text-white hover:bg-zinc-700 dark:border-white/10 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              <Link href="/auth/login">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="mx-auto flex w-full max-w-7xl flex-col items-center gap-12 px-6 py-16 text-center lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-muted-foreground dark:border-white/10 dark:bg-white/5">
              <Github className="h-3.5 w-3.5" />
              Star it. Find it. Actually use it.
            </div>

            <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-balance sm:text-6xl lg:text-7xl">
              The GitHub stars dashboard you&apos;ve been missing.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Connect your GitHub account and every repo you&apos;ve ever starred becomes searchable, filterable, and annotatable. Tag by language, mark your intent, attach private notes, let AI draft the structure — and actually find the thing you saved eight months ago.
            </p>

            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <div className="relative inline-flex rounded-lg">
                <Button
                  asChild
                  size="lg"
                  className="h-11 border border-black/10 bg-zinc-900 text-white hover:bg-zinc-700 dark:border-white/10 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  <Link href="/auth/login">
                    Sign in with GitHub
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <BorderBeam
                  size={60}
                  duration={8}
                  colorFrom="#71717a"
                  colorTo="rgba(113,113,122,0.2)"
                  borderWidth={1.5}
                />
              </div>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 border-black/10 bg-transparent hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
              >
                <Link href="#workflow">See how it works</Link>
              </Button>
            </div>

            <div className="mt-12 grid gap-6 border-t border-black/8 pt-8 text-left dark:border-white/10 sm:grid-cols-3">
              <div>
                <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground/60">Search</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight">Any field, instant</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Filter by language, topic, tag, owner, or your own private notes. No pagination, no scroll hunting.
                </p>
              </div>
              <div>
                <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground/60">Intent</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight">6 status labels</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  want-to-try · currently-using · tried-liked · tried-dropped · just-interesting · reference
                </p>
              </div>
              <div>
                <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground/60">AI</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight">Taxonomy in one pass</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  AI drafts tags and collections across your full star history. You review, edit, and own the result.
                </p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-6xl space-y-5">
            <LandingHeroMedia />

            <div className="grid gap-3 rounded-2xl border border-black/8 bg-black/[0.02] p-4 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.03] sm:grid-cols-3">
              <div className="rounded-lg border border-black/8 bg-black/[0.03] px-3 py-3 dark:border-white/8 dark:bg-white/[0.03]">
                <div className="mb-1 font-mono text-zinc-900 dark:text-zinc-100">search</div>
                owner · repo · note · tag · language · topic
              </div>
              <div className="rounded-lg border border-black/8 bg-black/[0.03] px-3 py-3 dark:border-white/8 dark:bg-white/[0.03]">
                <div className="mb-1 font-mono text-zinc-900 dark:text-zinc-100">organize</div>
                collections · statuses · personal taxonomy
              </div>
              <div className="rounded-lg border border-black/8 bg-black/[0.03] px-3 py-3 dark:border-white/8 dark:bg-white/[0.03]">
                <div className="mb-1 font-mono text-zinc-900 dark:text-zinc-100">revisit</div>
                inline README · private notes · trending signals
              </div>
            </div>
          </div>
        </section>

        {/* ── Tagline bar ── */}
        <section className="border-y border-black/8 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]">
          <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8">
            <p className="mb-6 text-xs uppercase tracking-[0.2em] text-muted-foreground/60">
              For developers who star repos as research, backlog, and long-term reference
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              {[
                "Find any starred repo in under 10 seconds",
                "Remember why you saved it with private notes",
                "AI-organized taxonomy, your edits, zero lock-in",
              ].map((text) => (
                <div
                  key={text}
                  className="flex items-center gap-2.5 rounded-full border border-black/10 bg-black/[0.03] px-4 py-2 text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="h-1 w-1 rounded-full bg-black/30 dark:bg-white/30" />
                  {text}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Problem / Stat Banner ── */}
        <section className="border-b border-black/8 dark:border-white/10">
          <div className="mx-auto w-full max-w-7xl px-6 py-16 lg:px-8">
            <div className="grid gap-px overflow-hidden rounded-2xl border border-black/8 bg-black/8 dark:border-white/10 dark:bg-white/10 sm:grid-cols-3">
              {[
                {
                  stat: "400+",
                  label: "Stars the average developer never revisits",
                  sub: "Starred once. Never opened again.",
                },
                {
                  stat: "<10s",
                  label: "To find any repo with StarDash",
                  sub: "Search notes, tags, language, topic — instantly.",
                },
                {
                  stat: "1 pass",
                  label: "For AI to draft your entire taxonomy",
                  sub: "Review and edit. You own the result.",
                },
              ].map(({ stat, label, sub }) => (
                <div
                  key={stat}
                  className="flex flex-col gap-3 bg-background px-8 py-10"
                >
                  <div className="font-mono text-5xl font-semibold tracking-tight text-foreground">
                    {stat}
                  </div>
                  <div className="text-base font-medium leading-snug text-foreground/80 text-balance">
                    {label}
                  </div>
                  <div className="text-sm text-muted-foreground">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Capabilities / Bento Grid ── */}
        <section className="mx-auto w-full max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Capabilities
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Built around the workflows you already have.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              From full-text search to AI-drafted taxonomies — every feature closes the gap between starring something and actually using it later.
            </p>
          </div>

          {/* Bento Grid */}
          <div className="mt-12 grid gap-4 lg:grid-cols-3">

            {/* Card 1 — Search (large, 2-col) */}
            <div className="group relative overflow-hidden rounded-2xl border border-black/8 bg-black/[0.02] p-6 transition-colors hover:border-black/15 hover:bg-black/[0.035] dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20 dark:hover:bg-white/[0.035] lg:col-span-2">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,0,0,0.03),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.04),transparent_65%)]" />
              {/* Decorative search preview */}
              <div className="absolute right-5 top-5 hidden w-60 overflow-hidden rounded-xl border border-black/10 bg-background/90 p-3 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-background/80 lg:block">
                <div className="mb-2.5 flex items-center gap-2 rounded-md bg-black/[0.04] px-2 py-1.5 dark:bg-white/[0.04]">
                  <Search className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-[10px] text-foreground/50">language:rust tags:async</span>
                </div>
                <div className="space-y-1.5">
                  {[
                    { repo: "tokio/tokio", lang: "Rust" },
                    { repo: "rayon-rs/rayon", lang: "Rust" },
                    { repo: "dtolnay/async-trait", lang: "Rust" },
                  ].map(({ repo, lang }) => (
                    <div
                      key={repo}
                      className="flex items-center justify-between rounded-md bg-black/[0.03] px-2 py-1.5 dark:bg-white/[0.03]"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orange-400/60" />
                        <span className="font-mono text-[10px] text-foreground/40">{repo}</span>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground/50">{lang}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 border-t border-black/8 pt-2 dark:border-white/8">
                  <span className="font-mono text-[10px] text-muted-foreground/40">3 results · 0ms</span>
                </div>
              </div>

              <div className="relative flex h-full flex-col justify-end pt-28 lg:pt-24">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                  <Search className="h-4 w-4" />
                </div>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">
                  Multi-field search across your star history
                </h3>
                <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                  Query by repo name, owner, language, topic, private notes, or custom tags — simultaneously. Instant results across thousands of repos without pagination or scroll fatigue.
                </p>
              </div>
            </div>

            {/* Card 2 — AI Categorization (small, 1-col) */}
            <div className="group relative overflow-hidden rounded-2xl border border-black/8 bg-black/[0.02] p-6 transition-colors hover:border-black/15 hover:bg-black/[0.035] dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20 dark:hover:bg-white/[0.035] lg:col-span-1">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(34,197,94,0.05),transparent_70%)]" />
              {/* Decorative classification preview */}
              <div className="mb-6 space-y-1.5">
                {[
                  { label: "cli-tools", tag: "devtools" },
                  { label: "nn-paper", tag: "ml-research" },
                  { label: "deno/deno", tag: "runtime" },
                ].map(({ label, tag }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-md bg-black/[0.04] px-2.5 py-1.5 font-mono text-[10px] dark:bg-white/[0.04]"
                  >
                    <span className="text-foreground/40">{label}</span>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
                      {tag}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight">AI does the first taxonomy pass</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                One LLM sweep drafts a classification across your entire star list. Review, edit, or override — the model handles the first mile, you handle the last 10%.
              </p>
            </div>

            {/* Card 3 — Tags & Collections (small, 1-col) */}
            <div className="group relative overflow-hidden rounded-2xl border border-black/8 bg-black/[0.02] p-6 transition-colors hover:border-black/15 hover:bg-black/[0.035] dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20 dark:hover:bg-white/[0.035] lg:col-span-1">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(0,0,0,0.02),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.04),transparent_60%)]" />
              {/* Tag cloud decoration */}
              <div className="mb-6 flex flex-wrap gap-1.5">
                {[
                  "async-runtime",
                  "systems-tools",
                  "devops",
                  "ml-infra",
                  "wasm",
                  "observability",
                  "databases",
                ].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-black/10 bg-black/[0.04] px-2 py-0.5 font-mono text-[10px] text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                <Tags className="h-4 w-4" />
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight">Collections and tags that stay yours</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Stack tags, nest collections, build a system that evolves with your stack. No schema drift, no migration scripts.
              </p>
            </div>

            {/* Card 4 — Status Tracking (large, 2-col) */}
            <div className="group relative overflow-hidden rounded-2xl border border-black/8 bg-black/[0.02] p-6 transition-colors hover:border-black/15 hover:bg-black/[0.035] dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20 dark:hover:bg-white/[0.035] lg:col-span-2">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(0,0,0,0.02),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,255,255,0.03),transparent_60%)]" />
              {/* Status pill decoration */}
              <div className="absolute right-5 top-5 hidden space-y-2 lg:block">
                {[
                  { color: "bg-emerald-500", status: "currently-using", repo: "vercel/next.js" },
                  { color: "bg-amber-500", status: "want-to-try", repo: "gleam-lang/gleam" },
                  { color: "bg-zinc-400", status: "just-interesting", repo: "socketio/socket.io" },
                  { color: "bg-blue-400", status: "reference", repo: "microsoft/TypeScript" },
                ].map(({ color, status, repo }) => (
                  <div
                    key={repo}
                    className="flex items-center gap-2 rounded-xl border border-black/10 bg-background/90 px-3 py-2 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-background/80"
                  >
                    <div className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${color}`} />
                    <span className="font-mono text-[10px] text-foreground/60">{status}</span>
                    <span className="font-mono text-[10px] text-foreground/30">· {repo}</span>
                  </div>
                ))}
              </div>

              <div className="relative flex h-full flex-col justify-end pt-28 lg:pt-24">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                  <BookOpen className="h-4 w-4" />
                </div>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">Track intent, not just interest</h3>
                <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                  Six statuses model exactly where a repo sits in your workflow: <span className="text-foreground/70">want-to-try · currently-using · tried-liked · tried-dropped · just-interesting · reference</span>. Attach private notes so you stop reconstructing why something mattered when you finally need it.
                </p>
              </div>
            </div>

            {/* Card 5 — Inline README + Notes (1-col, new) */}
            <div className="group relative overflow-hidden rounded-2xl border border-black/8 bg-black/[0.02] p-6 transition-colors hover:border-black/15 hover:bg-black/[0.035] dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20 dark:hover:bg-white/[0.035] lg:col-span-1">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,0,0,0.02),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.03),transparent_65%)]" />
              {/* README mock decoration */}
              <div className="mb-6 overflow-hidden rounded-lg border border-black/8 bg-black/[0.03] p-3 dark:border-white/8 dark:bg-white/[0.03]">
                <div className="mb-2 flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
                  <span className="font-mono text-[10px] text-muted-foreground/60">README.md</span>
                </div>
                <div className="space-y-1.5">
                  <div className="h-2 w-3/4 rounded-sm bg-foreground/10" />
                  <div className="h-1.5 w-full rounded-sm bg-foreground/[0.06]" />
                  <div className="h-1.5 w-5/6 rounded-sm bg-foreground/[0.06]" />
                  <div className="h-1.5 w-2/3 rounded-sm bg-foreground/[0.06]" />
                </div>
                <div className="mt-3 rounded-md bg-black/[0.04] p-2 dark:bg-white/[0.04]">
                  <span className="font-mono text-[9px] text-muted-foreground/50">
                    note: evaluate for background jobs in next project
                  </span>
                </div>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                <FileText className="h-4 w-4" />
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight">README inline, notes attached</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Every repo detail panel renders the README in place and surfaces your private note — so you never lose the context you wrote when you starred it.
              </p>
            </div>
          </div>
        </section>

        {/* ── Workflow ── */}
        <section
          id="workflow"
          className="border-t border-black/8 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.01))] dark:border-white/10 dark:bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.02))]"
        >
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div className="max-w-xl">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Workflow
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                From star pile to usable reference library.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                The loop is simple by design: sync, sort, annotate, revisit. No ceremony, no database migrations, no subscriptions to configure.
              </p>

              <div className="mt-8 rounded-xl border border-black/8 bg-black/[0.03] p-5 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Zap className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  Works with your existing GitHub stars
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  No import steps, no CSV uploads. StarDash reads your stars directly via the GitHub OAuth token — the same one you authenticated with. Your data stays under your control.
                </p>
              </div>

              {/* Sync progress mock */}
              <div className="mt-4 overflow-hidden rounded-xl border border-black/8 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.02]">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground/60">sync in progress</span>
                  <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">running</span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "vercel/next.js", done: true },
                    { label: "facebook/react", done: true },
                    { label: "tailwindlabs/tailwindcss", done: true },
                    { label: "prisma/prisma", done: false },
                  ].map(({ label, done }) => (
                    <div key={label} className="flex items-center gap-2.5">
                      <div
                        className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                          done ? "bg-emerald-500" : "bg-muted-foreground/30"
                        }`}
                      />
                      <span className={`font-mono text-[10px] ${done ? "text-foreground/50" : "text-muted-foreground/40"}`}>
                        {label}
                      </span>
                      {!done && (
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground/30">...</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.06]">
                  <div className="h-1 w-3/4 rounded-full bg-emerald-500/60" />
                </div>
                <div className="mt-1.5 font-mono text-[10px] text-muted-foreground/40">
                  1,247 / 1,643 repos synced
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {workflow.map((item, i) => (
                <div
                  key={item.step}
                  className="relative grid gap-4 rounded-2xl border border-black/8 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.03] sm:grid-cols-[72px_1fr]"
                >
                  {/* Connecting line between steps */}
                  {i < workflow.length - 1 && (
                    <div className="absolute bottom-0 left-[calc(72px/2+20px)] top-full z-10 hidden w-px translate-y-0 bg-black/8 dark:bg-white/10 sm:block" style={{ height: "12px" }} />
                  )}
                  <div className="flex flex-col items-start gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-background dark:border-white/10">
                      <span className="font-mono text-[10px] font-semibold text-muted-foreground">{item.step}</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.copy}</p>
                    <div className="mt-3 font-mono text-[10px] text-muted-foreground/50">{item.detail}</div>
                  </div>
                </div>
              ))}

              {/* Workflow CTA */}
              <div className="rounded-2xl border border-black/8 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-sm text-muted-foreground">
                  Ready to turn your star pile into a reference library?
                </p>
                <Button
                  asChild
                  className="mt-4 border border-black/10 bg-zinc-900 text-white hover:bg-zinc-700 dark:border-white/10 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  <Link href="/auth/login">
                    Get started free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Trending Feature Spotlight ── */}
        <section className="border-t border-black/8 dark:border-white/10">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center lg:px-8">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Trending
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl text-balance">
                Know what&apos;s rising before your feed buries it.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                StarDash tracks momentum across your tags and languages. Surface repos gaining stars fast, spot emerging patterns in the tools your peers are adopting, and stay ahead without the noise of generic trending lists.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Weekly digest of rising repos in your tag clusters",
                  "Language-level momentum signals — not just raw star counts",
                  "Cross-reference trending with your own starred backlog",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500/70" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Trending mock panel */}
            <div className="overflow-hidden rounded-2xl border border-black/8 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]">
              <div className="flex items-center justify-between border-b border-black/8 px-5 py-4 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-medium">Trending this week</span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground/50">in your tags</span>
              </div>
              <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {[
                  { repo: "gleam-lang/gleam", tag: "language", delta: "+2.4k", lang: "Gleam" },
                  { repo: "astral-sh/uv", tag: "devtools", delta: "+1.8k", lang: "Rust" },
                  { repo: "charmbracelet/bubbletea", tag: "cli-tools", delta: "+940", lang: "Go" },
                  { repo: "oven-sh/bun", tag: "runtime", delta: "+820", lang: "Zig" },
                  { repo: "tursodatabase/libsql", tag: "databases", delta: "+615", lang: "Rust" },
                ].map(({ repo, tag, delta, lang }, i) => (
                  <div
                    key={repo}
                    className="flex items-center justify-between px-5 py-3.5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-4 font-mono text-[10px] text-muted-foreground/40">{i + 1}</span>
                      <div>
                        <div className="font-mono text-xs text-foreground/70">{repo}</div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="rounded-full border border-black/8 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground/50 dark:border-white/8">
                            {tag}
                          </span>
                          <span className="font-mono text-[9px] text-muted-foreground/40">{lang}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <ArrowUpRight className="h-3 w-3" />
                      <span className="font-mono text-xs font-medium">{delta}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Personas ── */}
        <section className="border-t border-black/8 bg-black/[0.01] dark:border-white/10 dark:bg-white/[0.01]">
          <div className="mx-auto w-full max-w-7xl px-6 py-20 lg:px-8">
            <div className="max-w-xl">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Who it&apos;s for
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl text-balance">
                Sound familiar?
              </h2>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {personas.map(({ type, description, tags }) => (
                <div
                  key={type}
                  className="flex flex-col gap-5 rounded-2xl border border-black/8 bg-background p-6 dark:border-white/10"
                >
                  <div>
                    <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground/60">
                      {type}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 font-mono text-[10px] text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="border-t border-black/8 dark:border-white/10">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-8 px-6 py-24 text-center lg:px-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
              <Star className="h-5 w-5" />
            </div>
            <div className="max-w-xl">
              <h2 className="text-4xl font-semibold tracking-[-0.05em] text-balance sm:text-5xl">
                Stop losing the repos worth coming back to.
              </h2>
              <p className="mx-auto mt-5 max-w-md text-base leading-7 text-muted-foreground">
                Connect your GitHub account in one step. StarDash syncs your star history, lets AI draft the structure, and makes every repo findable in seconds.
              </p>
            </div>
            <div className="relative inline-flex rounded-lg">
              <Button
                asChild
                size="lg"
                className="h-12 border border-black/10 bg-zinc-900 px-8 text-white hover:bg-zinc-700 dark:border-white/10 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                <Link href="/auth/login">
                  Sign in with GitHub
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <BorderBeam
                size={80}
                duration={8}
                colorFrom="#71717a"
                colorTo="rgba(113,113,122,0.2)"
                borderWidth={1.5}
              />
            </div>
            <p className="font-mono text-xs text-muted-foreground/50">
              Free · No credit card · Your stars, your data
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/8 dark:border-white/10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <FolderTree className="h-4 w-4" />
            Stop losing the repos worth coming back to.
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <Link href="/auth/login" className="hover:text-foreground">
              Log in
            </Link>
            <Link href="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/settings" className="hover:text-foreground">
              Settings
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
