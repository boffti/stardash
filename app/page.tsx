import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowRight,
  FolderTree,
  Github,
  LayoutTemplate,
  Search,
  Sparkles,
  Star,
  Tags,
} from "lucide-react"

import { LandingHeroMedia } from "@/components/landing-hero-media"
import { LandingThemeToggle } from "@/components/landing-theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

const featureCards = [
  {
    icon: Search,
    title: "Find signal fast",
    description:
      "Search across owners, languages, notes, and tags instead of scrolling through years of impulse stars.",
  },
  {
    icon: Tags,
    title: "Shape your own system",
    description:
      "Keep lightweight metadata close to the repos you care about so your stack stays navigable.",
  },
  {
    icon: Sparkles,
    title: "Use AI where it helps",
    description:
      "Let categorization handle the first pass, then refine the edges yourself without losing control.",
  },
]

const workflow = [
  {
    step: "01",
    title: "Sync your GitHub stars",
    copy: "Pull your full starred list into a workspace designed for triage instead of nostalgia.",
  },
  {
    step: "02",
    title: "Sort by intent",
    copy: "Group tools by workflow, status, and personal taxonomy so the useful repos stay visible.",
  },
  {
    step: "03",
    title: "Return with context",
    copy: "Open notes, tags, and collections alongside the repo instead of reconstructing why it mattered.",
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
        <section className="mx-auto flex w-full max-w-7xl flex-col items-center gap-12 px-6 py-16 text-center lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              <Github className="h-3.5 w-3.5" />
              Built for developers with too many stars
            </div>

            <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-balance sm:text-6xl lg:text-7xl">
              A sharp workspace for the repos you meant to come back to.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              StarDash turns your GitHub stars into a working set: searchable,
              categorized, and annotated so useful repos stop disappearing into
              a flat list.
            </p>

            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
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
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 border-white/10 bg-transparent hover:bg-white/5"
              >
                <Link href="#workflow">See the workflow</Link>
              </Button>
            </div>

            <div className="mt-12 grid gap-4 border-t border-white/10 pt-8 text-left sm:grid-cols-3">
              <div>
                <div className="text-2xl font-semibold tracking-tight">5,000</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  repos supported in a single sync pass
                </p>
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight">Local-first</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  notes and metadata without schema friction
                </p>
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight">AI-assisted</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  categorization when you want speed, not when you need control
                </p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-6xl space-y-5">
            <LandingHeroMedia />

            <Card className="border-white/10 bg-card/70 py-0 shadow-none">
              <CardContent className="grid gap-3 px-5 py-4 text-xs text-muted-foreground sm:grid-cols-3">
                <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3">
                  <div className="mb-1 font-mono text-zinc-900 dark:text-zinc-100">search</div>
                  owner, repo, note, tag, language
                </div>
                <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3">
                  <div className="mb-1 font-mono text-zinc-900 dark:text-zinc-100">organize</div>
                  collections, statuses, personal taxonomy
                </div>
                <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3">
                  <div className="mb-1 font-mono text-zinc-900 dark:text-zinc-100">review</div>
                  notes, context, and trending follow-up
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.02]">
          <div className="mx-auto grid w-full max-w-7xl gap-4 px-6 py-6 text-sm text-muted-foreground lg:grid-cols-[1fr_repeat(3,minmax(0,1fr))] lg:px-8">
            <div className="max-w-xs font-medium text-foreground">
              Built for developers who use stars as research, backlog, and memory.
            </div>
            <div className="rounded-lg border border-white/8 px-4 py-3">
              Searchable index instead of endless pagination
            </div>
            <div className="rounded-lg border border-white/8 px-4 py-3">
              Personal metadata without spreadsheet drift
            </div>
            <div className="rounded-lg border border-white/8 px-4 py-3">
              Product UI that feels like a tool, not a promo site
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Core capabilities
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              The homepage should explain the product the same way the product behaves.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Clear hierarchy, neutral surfaces, and enough product detail to
              prove the app without sliding into ornamental SaaS filler.
            </p>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {featureCards.map((feature) => {
              const Icon = feature.icon

              return (
                <Card
                  key={feature.title}
                  className="border-white/10 bg-card/70 py-0 shadow-none"
                >
                  <CardHeader>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                      <Icon className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                    <CardDescription className="text-sm leading-6">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              )
            })}
          </div>
        </section>

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
                The structure is simple on purpose: sync, sort, annotate, and
                revisit. Everything on the page points back to that loop.
              </p>

              <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <LayoutTemplate className="h-4 w-4" />
                  Sharp, product-first landing page
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  No marquee logos, no glowing beams, no pseudo-enterprise bento
                  wallpaper. Just enough surface area to explain why the app is useful.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {workflow.map((item) => (
                <div
                  key={item.step}
                  className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-[72px_1fr]"
                >
                  <div className="font-mono text-sm text-muted-foreground">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {item.copy}
                    </p>
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
            Organize the repos worth keeping in rotation.
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
