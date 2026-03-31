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
  Zap,
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
  },
  {
    step: "02",
    title: "Apply taxonomy in bulk or incrementally",
    copy: "Run an AI classification pass to draft your structure in minutes, or tag repos one-by-one. Both paths leave you in full control of the final shape.",
  },
  {
    step: "03",
    title: "Resurface with full context attached",
    copy: "Open any repo and find your notes, status, tags, and the rendered README — not just a redirect back to GitHub.",
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
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_34%),linear-gradient(to_bottom,transparent,rgba(255,255,255,0.02))]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(to_bottom,white,transparent_85%)]" />

      <header className="border-b border-white/10">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
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
              className="border border-white/10 bg-white text-black hover:bg-zinc-200"
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
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              <Github className="h-3.5 w-3.5" />
              Built for developers with too many stars
            </div>

            <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-balance sm:text-6xl lg:text-7xl">
              The workspace your starred repos never had.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              StarDash converts a flat list of GitHub stars into a searchable, AI-categorized knowledge base. Query by owner, language, tags, or private notes — and actually find what you starred.
            </p>

            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <div className="relative inline-flex rounded-lg">
                <Button
                  asChild
                  size="lg"
                  className="h-11 border border-white/10 bg-white text-black hover:bg-zinc-200"
                >
                  <Link href="/auth/login">
                    Sign in with GitHub
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <BorderBeam
                  size={60}
                  duration={8}
                  colorFrom="#ffffff"
                  colorTo="rgba(255,255,255,0.2)"
                  borderWidth={1.5}
                />
              </div>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 border-white/10 bg-transparent hover:bg-white/5"
              >
                <Link href="#workflow">See how it works</Link>
              </Button>
            </div>

            <div className="mt-12 grid gap-6 border-t border-white/10 pt-8 text-left sm:grid-cols-3">
              <div>
                <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground/60">Scale</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight">5,000 repos</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your full star history, indexed and searchable in a single sync. No partial imports, no rate-limit errors.
                </p>
              </div>
              <div>
                <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground/60">Storage</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight">No migrations</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tags, notes, and collections live in the browser. Nothing to provision or maintain server-side.
                </p>
              </div>
              <div>
                <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground/60">AI</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight">One LLM pass</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  The model drafts your taxonomy. You review, adjust, and own the result.
                </p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-6xl space-y-5">
            <LandingHeroMedia />

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-card/70 p-4 text-xs text-muted-foreground sm:grid-cols-3">
              <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3">
                <div className="mb-1 font-mono text-zinc-900 dark:text-zinc-100">search</div>
                owner · repo · note · tag · language · topic
              </div>
              <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3">
                <div className="mb-1 font-mono text-zinc-900 dark:text-zinc-100">organize</div>
                collections · statuses · personal taxonomy
              </div>
              <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3">
                <div className="mb-1 font-mono text-zinc-900 dark:text-zinc-100">revisit</div>
                inline README · private notes · trending signals
              </div>
            </div>
          </div>
        </section>

        {/* ── Tagline bar ── */}
        <section className="border-y border-white/10 bg-white/[0.02]">
          <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8">
            <p className="mb-6 text-xs uppercase tracking-[0.2em] text-muted-foreground/60">
              For developers who star repos as research, backlog, and long-term reference
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              {[
                "Full-text search instead of endless GitHub pagination",
                "Private metadata without spreadsheet drift",
                "A real workspace — not a reskin of the GitHub UI",
              ].map((text) => (
                <div
                  key={text}
                  className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-muted-foreground"
                >
                  <div className="h-1 w-1 rounded-full bg-white/30" />
                  {text}
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
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 lg:col-span-2">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.04),transparent_65%)]" />
              {/* Decorative search preview */}
              <div className="absolute right-5 top-5 hidden w-56 overflow-hidden rounded-xl border border-white/10 bg-background/80 p-3 backdrop-blur-sm lg:block">
                <div className="mb-2.5 flex items-center gap-2 rounded-md bg-white/[0.04] px-2 py-1.5">
                  <Search className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-[10px] text-white/50">language:rust tags:async</span>
                </div>
                <div className="space-y-1.5">
                  {["tokio/tokio", "rayon-rs/rayon", "dtolnay/async-trait"].map((repo) => (
                    <div
                      key={repo}
                      className="flex items-center gap-2 rounded-md bg-white/[0.03] px-2 py-1.5 font-mono text-[10px] text-white/40"
                    >
                      <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orange-400/60" />
                      {repo}
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative flex h-full flex-col justify-end pt-28 lg:pt-24">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
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
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 lg:col-span-1">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(139,92,246,0.06),transparent_70%)]" />
              {/* Decorative classification preview */}
              <div className="mb-6 space-y-1.5">
                {[
                  { label: "cli-tools", tag: "devtools" },
                  { label: "nn-paper", tag: "ml-research" },
                  { label: "deno/deno", tag: "runtime" },
                ].map(({ label, tag }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-md bg-white/[0.04] px-2.5 py-1.5 font-mono text-[10px]"
                  >
                    <span className="text-white/40">{label}</span>
                    <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-violet-400">
                      {tag}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight">AI does the first taxonomy pass</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                One LLM sweep drafts a classification across your entire star list. Review, edit, or override — the model handles the first mile, you handle the last 10%.
              </p>
            </div>

            {/* Card 3 — Tags & Collections (small, 1-col) */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 lg:col-span-1">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.04),transparent_60%)]" />
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
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                <Tags className="h-4 w-4" />
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight">Collections and tags that stay yours</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Stack tags, nest collections, build a system that evolves with your stack. No schema drift, no migration scripts.
              </p>
            </div>

            {/* Card 4 — Status Tracking (large, 2-col) */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 lg:col-span-2">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,255,255,0.03),transparent_60%)]" />
              {/* Status pill decoration */}
              <div className="absolute right-5 top-5 hidden space-y-2 lg:block">
                {[
                  { color: "bg-emerald-400", status: "currently-using", repo: "vercel/next.js" },
                  { color: "bg-amber-400", status: "want-to-try", repo: "gleam-lang/gleam" },
                  { color: "bg-zinc-500", status: "archived", repo: "socketio/socket.io" },
                ].map(({ color, status, repo }) => (
                  <div
                    key={repo}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-background/80 px-3 py-2 backdrop-blur-sm"
                  >
                    <div className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${color}`} />
                    <span className="font-mono text-[10px] text-white/60">{status}</span>
                    <span className="font-mono text-[10px] text-white/30">· {repo}</span>
                  </div>
                ))}
              </div>

              <div className="relative flex h-full flex-col justify-end pt-28 lg:pt-24">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <BookOpen className="h-4 w-4" />
                </div>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">Track intent, not just interest</h3>
                <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                  Mark repos as want-to-try, currently-using, or archived. Attach private notes that persist across sessions — stop reconstructing why a tool mattered when you need it.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Workflow ── */}
        <section
          id="workflow"
          className="border-t border-white/10 bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.02))]"
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

              <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Zap className="h-4 w-4 text-amber-400" />
                  Works with your existing GitHub stars
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  No import steps, no CSV uploads. StarDash reads your stars directly via the GitHub OAuth token — the same one you authenticated with. Your data stays under your control.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {workflow.map((item) => (
                <div
                  key={item.step}
                  className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-[72px_1fr]"
                >
                  <div className="font-mono text-sm text-muted-foreground">{item.step}</div>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
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
