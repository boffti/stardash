# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Codex, Gemini, etc.) when working with code in this repository.

> **Note:** `CLAUDE.md` is a symlink to this file. Edit `AGENTS.md` — it is the source of truth.

## Commands

```bash
pnpm dev        # Start development server (http://localhost:3000)
pnpm build      # Production build (TypeScript errors are ignored — see next.config.mjs)
pnpm lint       # ESLint
pnpm start      # Start production server
```

No test suite is configured. Use `pnpm lint` to catch issues before committing.

## Mandatory Workflows

### UI Work

Use **all** of the following before writing or modifying components:

- **`ui-ux-pro-max` skill** — design direction, style, and polish
- **`frontend-design` skill** — component structure and implementation patterns
- **`21magic` MCP** (`mcp__21magic__*`) — component inspiration and generation
- **`magicuidesign` MCP** (`mcp__magicuidesign__*`) — Magic UI component registry
- **`shadcn` MCP** (`mcp__shadcn__*`) — shadcn/ui component lookup and installation

### New Features

1. Run **`superpowers:brainstorming`** skill to explore the solution space
2. Run **`grill-me`** skill to surface requirements and edge cases

Only begin implementation after both are complete.

### Codebase Exploration

Use **`auggie` MCP** (`mcp__auggie__codebase-retrieval`) as the primary search tool. Prefer over `grep`, `find`, or manual file browsing.

### Database & Auth

Supabase project: **`your-supabase-project`** (ref: `SUPABASE_PROJECT_REF`). Use **Supabase MCP** for all DB/auth interactions — schema inspection, migrations, auth config. Never guess at schema shape.

### Deployment

Vercel project: **`stardash`**. Use **Vercel MCP** (`mcp__vercel__*`) for deployment status, build logs, runtime logs, and config.

### Observability

- **Langfuse MCP** (`mcp__langfuse__*`) — LLM traces, token usage, AI categorization errors
- **Sentry MCP** (`mcp__sentry__*`) — error events and issues

---

## Architecture

**StarDash** is a Next.js 16 (App Router) dashboard for organizing GitHub starred repositories.

**Stack:** Next.js 16.2 + React 19 + TypeScript 5.7 · shadcn/ui (new-york) + Tailwind CSS v4 + Lucide React · Framer Motion · SWR · Supabase (auth + Postgres) · Vercel AI SDK 6 + OpenRouter (Gemini 2.0 Flash) · Langfuse + Sentry · Recharts + dnd-kit

### App Router Structure

```
app/
├── (authenticated)/          # Auth-enforced layout
│   ├── dashboard/            # Main starred repos view
│   ├── settings/             # Tags + collections management
│   ├── trending/             # Trending recommendations
│   └── recently-viewed/
├── auth/
│   ├── login/                # GitHub OAuth entry
│   ├── callback/route.ts     # OAuth code exchange + token storage
│   └── error/
├── api/
│   ├── github/starred|readme|star|health
│   ├── ai/categorize/        # Two-phase AI taxonomy + classification
│   ├── user/metadata|repo-id
│   ├── cron/star-snapshots   # Daily snapshots (Vercel cron @ 2AM UTC)
│   └── test-observability
└── global-error.tsx
```

### Auth Flow

GitHub OAuth via Supabase. `provider_token` (~8h TTL) stored in `profiles` table and retrieved via `getValidGitHubToken(userId)` from `lib/tokens.ts`. Expired tokens require re-auth.

**Key files:**
- `lib/supabase/client.ts` — browser client
- `lib/supabase/server.ts` — async server/RSC client (reads cookies)
- `lib/supabase/admin.ts` — service-role admin (server only, never expose to client)
- `lib/supabase/middleware.ts` — session refresh (**no code between `createServerClient` and `getUser()`**)
- `lib/tokens.ts` — `getValidGitHubToken(userId)`
- `lib/auth.ts` — `getUser()`, `requireAuth()`, `getUserProfile()`, `signOut()`
- `middleware.ts` — session refresh + redirects authenticated users away from `/auth/login`

> Prefer `lib/auth.ts` or `lib/supabase/server.ts` for new server code. Avoid `modules/auth/` (legacy).

### Data Flow

**Starred repos:** `GET /api/github/starred` → `getValidGitHubToken` → `lib/github.ts` (paginates up to 5000 via `vnd.github.star+json`) → upsert into `repos` + `user_starred_repos` → cached in `localStorage` (`stardash-repos-cache-{userId}`, 24h TTL).

**User metadata:** `GET /api/user/metadata` returns tags, collections, per-repo state (status, notes, pinned, assignments) from DB.

**README:** On-demand via `GET /api/github/readme?owner=&repo=`, cached in `repos.readme`.

### AI Categorization

`lib/ai-categorize.ts` + `POST /api/ai/categorize` — OpenRouter + `google/gemini-2.0-flash-001` via Vercel AI SDK `generateObject()`.

1. **Taxonomy** — up to 500 repo summaries → 5–12 collections + 15–25 tags
2. **Classification** — batches of 100 → 1–3 collections + 1–3 tags per repo

24h rate limit per user (`profiles.last_ai_categorization_at`). Flush spans: `after(async () => langfuseSpanProcessor?.forceFlush())`.

### Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | User identity, GitHub token, sync timestamps, AI rate limit |
| `repos` | Global repo catalog (admin-written, user-readable) |
| `user_starred_repos` | Per-user: status, notes, pinned |
| `tags` / `collections` | User-owned taxonomy |
| `user_starred_repo_tags` / `_collections` | Many-to-many junctions |
| `repo_star_snapshots` | Daily star history for trending |

**RLS:** All user tables enforce `auth.uid() = user_id`. `repos` is authenticated-read, admin-write only (`lib/supabase/admin.ts`).

**`user_starred_repos.status`:** `want-to-try` | `currently-using` | `tried-liked` | `tried-dropped` | `just-interesting` | `reference`

### UI Stack

shadcn/ui (new-york) in `components/ui/` · Tailwind CSS v4 (`app/globals.css`) · Lucide React (`lucide-react`) · Framer Motion · dark by default (`storageKey: "stardash-theme"`) · `next-themes`

Custom components: `bento-grid`, `border-beam`, `marquee`, `particles`, `shine-border`, `spinner`, `kbd`, `button-group`, `chart`.

### Observability

**Sentry:** `sentry.{client,server,edge}.config.ts` + `instrumentation.ts`. Call `Sentry.captureException(err)` in API route catch blocks.

**Langfuse:** `LangfuseSpanProcessor` in `instrumentation.ts`. All `generateObject`/`generateText` calls use `experimental_telemetry: { isEnabled: true }`. **Always pass `baseUrl: process.env.LANGFUSE_BASE_URL`** (SDK defaults to `LANGFUSE_BASEURL`).

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY       # Server only — never expose to client

OPENROUTER_API_KEY
CRON_SECRET                     # Bearer token for /api/cron/* routes

NEXT_PUBLIC_SENTRY_DSN
SENTRY_ORG                      # your-sentry-org
SENTRY_PROJECT                  # stardash
SENTRY_AUTH_TOKEN

LANGFUSE_SECRET_KEY
LANGFUSE_PUBLIC_KEY
LANGFUSE_BASE_URL               # Must pass explicitly — SDK defaults to LANGFUSE_BASEURL
```
