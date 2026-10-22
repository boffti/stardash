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

No test suite is configured. Use `pnpm lint` and `pnpm typecheck` before committing. `pnpm check:db` exercises the SQLite data layer in memory; `pnpm check:radar` runs the Radar scoring self-check.

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

The database is a local SQLite file via `node:sqlite` (no ORM). The whole schema lives in `lib/db.ts`; additive changes go in its `MIGRATIONS` array. Auth is GitHub sign-in through a GitHub App the instance creates for itself (manifest flow, `app/api/auth/github/*`), with paste-a-PAT as fallback (`app/api/auth/login/route.ts`), and an HMAC-signed cookie (`lib/session.ts`). Never guess at schema shape: read `lib/db.ts`.

### Deployment

Single container: `Dockerfile` (node:24-slim, Next standalone, SQLite on the `/data` volume), published to `ghcr.io/boffti/stardash` by `.github/workflows/docker.yml` on pushes to main and `v*` tags. `docker-compose.yml` is one service. Nightly jobs run in-process from `lib/scheduler.ts` (started in `instrumentation.ts`, production only unless `SCHEDULER=1`); the cron routes accept `CRON_SECRET` or the per-process secret from `lib/cron-auth.ts`. Not deployed on Vercel; `vercel.json` only carries `ignoreCommand: exit 0`.

### Observability

- **Langfuse MCP** (`mcp__langfuse__*`) — LLM traces, token usage, AI categorization errors
- **Sentry MCP** (`mcp__sentry__*`) — error events and issues

---

## Architecture

**StarDash** is a Next.js 16 (App Router) dashboard for organizing GitHub starred repositories.

**Stack:** Next.js 16.2 + React 19 + TypeScript 5.7 · shadcn/ui (new-york) + Tailwind CSS v4 + Lucide React · Framer Motion · SWR · SQLite via `node:sqlite` (data) + self-created GitHub App OAuth or PAT, signed cookie (auth) · Vercel AI SDK 6 + OpenRouter (cheap default model, `AI_MODEL` env) · Langfuse + Sentry · Recharts + dnd-kit

### App Router Structure

```
app/
├── (authenticated)/          # Auth-enforced layout
│   ├── dashboard/            # Main starred repos view
│   ├── settings/             # Tags + collections management
│   ├── radar/                # Inbound feed: new/rising repos ranked by taste (lib/radar.ts)
│   ├── trending/             # Recommendations drawn from your own stars
│   ├── search/               # Discover: AI query expansion over GitHub search
│   ├── intel/                # AI repo health reports
│   ├── contribute/           # Good-first-issue discovery
│   └── recently-viewed/
├── auth/
│   ├── login/                # Connect GitHub (manifest flow) or paste a PAT
│   └── error/
├── api/
│   ├── auth/github/setup|setup/callback|start|callback · auth/login
│   ├── github/starred|readme|star|health
│   ├── ai/categorize/        # Two-phase AI taxonomy + classification
│   ├── user/metadata|repo-id
│   ├── cron/star-snapshots   # Daily snapshots (called by lib/scheduler.ts, or externally with CRON_SECRET)
│   ├── cron/radar-ingest     # Radar candidates from GitHub search, HN, social graph (same scheduler)
│   ├── health                # Container healthcheck
│   ├── radar/                # GET feed · action (dismiss/snooze/undo) · scan (user-triggered ingest)
│   ├── search/repos|personalized|saved
│   ├── ai/repo-intel|contribution-brief
│   └── test-observability
└── global-error.tsx
```

### Auth Flow

Single-owner. Two ways in, same tail (`signInWithGitHubToken()` in `lib/github-login.ts`: look up `/user`, enforce that the first GitHub user to sign in owns the instance, store the grant in `profiles`, set the `sd_session` cookie `<userId>.<hmac>` whose secret is minted once into `meta`).

1. **Connect GitHub (default).** `GET /api/auth/github/setup` posts a GitHub App manifest to github.com; the self-hoster clicks "Create GitHub App" and GitHub redirects back to `/api/auth/github/setup/callback` with a code that is converted into `client_id`/`client_secret`, stored in `meta` (`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` env override this). `GET /api/auth/github/start` then runs normal OAuth to `/api/auth/github/callback`. App user tokens expire in 8h; `lib/tokens.ts` refreshes them with the stored refresh token. Callback URLs are pinned to the instance origin (`appUrl()`: `APP_URL` env, else forwarded headers).
2. **Paste a PAT (fallback).** `POST /api/auth/login`. Non-expiring token, no app needed. For GitHub Enterprise and headless setups.

**Key files:**

- `lib/db.ts` — `db` singleton, schema, `nowIso`/`toJson`/`fromJson`
- `lib/session.ts` — cookie signing/verification; `lib/session-cookie.ts` holds only the cookie name (importable from middleware)
- `lib/auth.ts` — `getUser()` → `{ id, login, avatarUrl } | null`, `requireAuth()`, `signOut()`, `reauthenticate()` (server actions)
- `lib/github-app.ts` — app credentials (env or `meta`), manifest, OAuth code exchange and refresh
- `lib/github-login.ts` — `signInWithGitHubToken()`, shared by both login paths
- `lib/tokens.ts` — `getValidGitHubToken(userId?)` (stored token, auto-refreshed), `getAnyValidGitHubToken()` (`GITHUB_PAT` env, else the owner's)
- `lib/metadata-actions.ts` — `"use server"` wrappers client components call for tag/collection/status mutations
- `middleware.ts` — cookie presence check + redirects only (HMAC verified in `getUser()`)

### Data Flow

**Starred repos:** `GET /api/github/starred` → `getValidGitHubToken` → `lib/github.ts` (paginates up to 5000 via `vnd.github.star+json`) → `upsertStarredRepos()` in `lib/user-metadata.ts` (one transaction) → cached in `localStorage` (`stardash-repos-cache-{userId}`, 24h TTL).

**User metadata:** `GET /api/user/metadata` returns tags, collections, per-repo state (status, notes, pinned, assignments) from DB.

**README:** On-demand via `GET /api/github/readme?owner=&repo=`, cached in `repos.readme`.

### AI Categorization

`lib/ai-categorize.ts` + `POST /api/ai/categorize` — OpenRouter, default model in `lib/ai-provider.ts` (`AI_MODEL` env overrides; users may bring OpenAI/Anthropic keys via Settings, sent as `x-ai-key`/`x-ai-provider` headers) via Vercel AI SDK `generateObject()`.

1. **Taxonomy** — up to 500 repo summaries → 5–12 collections + 15–25 tags
2. **Classification** — batches of 100 → 1–3 collections + 1–3 tags per repo

Cooldown per user via `profiles.last_ai_categorization_at`. Weekly AI quotas are stubbed open in `lib/ai-weekly-limit.ts` (self-hosted build). Flush spans: `after(async () => langfuseSpanProcessor?.forceFlush())`.

**AI schema rule:** no `.max()` on strings or arrays in `generateObject` schemas. OpenRouter-hosted models ignore JSON Schema `maxLength`/`maxItems`, and any overflow becomes a 500. State limits in `.describe()` text and clamp in code (`.transform()` or `.slice()`) instead. Numeric ranges like 0–100 are fine.

### Radar

Inbound feed. Nightly `radar-ingest` pulls candidates from three sources: GitHub search (`created:>7d stars:>50`, `created:>30d stars:>300`), Hacker News stories linking to GitHub (Algolia API), and each user's `received_events` (WatchEvents = stars by people they follow). Candidates land in `radar_candidates` (global) with a same-day row in `repo_star_snapshots` so velocity works without a second job.

`GET /api/radar` builds a taste profile from the user's stars (`lib/radar.ts`: topic/language weights × status, `tried-dropped` is negative) and scores every candidate. Social signal outranks a full topic match. Reasons are returned as plain-language strings and rendered as the row's evidence line. Triage actions live in `radar_actions`; starring uses the existing `/api/github/star` route.

### Database Schema

| Table                                     | Purpose                                                       |
| ----------------------------------------- | ------------------------------------------------------------- |
| `profiles`                                | Owner identity, GitHub token + refresh token, sync timestamps |
| `repos`                                   | Repo catalog (one row per GitHub repo)                        |
| `user_starred_repos`                      | Per-user: status, notes, pinned                               |
| `tags` / `collections`                    | User-owned taxonomy                                           |
| `user_starred_repo_tags` / `_collections` | Many-to-many junctions                                        |
| `repo_star_snapshots`                     | Daily star history for velocity (stars + radar candidates)    |
| `radar_candidates`                        | Pool of new/rising repos                                      |
| `radar_signals`                           | Per-user: people you follow starred repo X                    |
| `radar_actions`                           | Per-user triage: dismissed / snoozed / starred                |
| `discover_searches`                       | Cached Discover search results per user                       |
| `repo_insights`                           | AI repo intel cache (7d)                                      |
| `meta`                                    | Key/value: session secret, GitHub App client id/secret        |

**Scoping:** there is no RLS. Every query on a per-user table carries `where user_id = ?`. Postgres arrays/jsonb became JSON text (`topics`, `sources`, `results`, `pipeline_events`, `metrics`, `top_pain_points`), booleans are 0/1, timestamps are ISO strings.

**`user_starred_repos.status`:** `want-to-try` | `currently-using` | `tried-liked` | `tried-dropped` | `just-interesting` | `reference`

### UI Stack

shadcn/ui (new-york) in `components/ui/` · Tailwind CSS v4 (`app/globals.css`) · Lucide React (`lucide-react`) · Framer Motion · dark by default (`storageKey: "stardash-theme"`) · `next-themes`

Custom components: `bento-grid`, `border-beam`, `marquee`, `particles`, `shine-border`, `spinner`, `kbd`, `button-group`, `chart`.

**Radius rule:** `rounded-md` for inputs, selects and small controls; `rounded-lg` for cards and list rows; `rounded-xl` for page-level panels, empty states and header controls; `rounded-full` for avatars, pills and icon buttons. Nothing larger than `xl`; `rounded-none` only for the cmdk reset inside dialogs.

**Motion rule:** decorative animation (particles, marquee, border beam, shine) must degrade to static under `prefers-reduced-motion`. CSS animations are covered globally in `globals.css`; framer-motion through `MotionProvider` in the root layout; canvas loops check `matchMedia` themselves.

**Copy rule:** no em-dashes in UI strings. Use a period or a comma.

### Observability

**Sentry:** `sentry.{client,server,edge}.config.ts` + `instrumentation.ts`. Call `Sentry.captureException(err)` in API route catch blocks.

**Langfuse:** `LangfuseSpanProcessor` in `instrumentation.ts`. All `generateObject`/`generateText` calls use `experimental_telemetry: { isEnabled: true }`. **Always pass `baseUrl: process.env.LANGFUSE_BASE_URL`** (SDK defaults to `LANGFUSE_BASEURL`).

### Environment Variables

```
DATABASE_PATH                   # SQLite file, default ./data/stardash.db

OPENROUTER_API_KEY
AI_MODEL                        # Optional OpenRouter model id override
CRON_SECRET                     # Optional: lets an external scheduler call /api/cron/*; DISABLE_SCHEDULER turns in-process jobs off
GITHUB_PAT                      # Optional token for background jobs; defaults to the owner's token
GITHUB_CLIENT_ID / _SECRET      # Optional: use a pre-made GitHub App instead of the manifest flow
APP_URL                         # Optional: public origin when proxy headers are missing

NEXT_PUBLIC_SENTRY_DSN
SENTRY_ORG
SENTRY_PROJECT
SENTRY_AUTH_TOKEN

LANGFUSE_SECRET_KEY
LANGFUSE_PUBLIC_KEY
LANGFUSE_BASE_URL               # Must pass explicitly — SDK defaults to LANGFUSE_BASEURL
```
