# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
When working on any UI-related task, you **must** use all of the following before writing or modifying components:
- **`ui-ux-pro-max` skill** — design direction, style, and polish
- **`frontend-design` skill** — component structure and implementation patterns
- **`21magic` MCP** (`mcp__21magic__*`) — component inspiration and generation
- **`magicuidesign` MCP** (`mcp__magicuidesign__*`) — Magic UI component registry
- **`shadcn` MCP** (`mcp__shadcn__*`) — shadcn/ui component lookup and installation

### New Features
Before implementing any new feature:
1. Run the **`superpowers:brainstorming` skill** to explore the solution space
2. Run the **`grill-me` skill** to surface all requirements and edge cases
Only begin implementation after both are complete.

### Codebase Exploration
Use the **`auggie` MCP** (`mcp__auggie__codebase-retrieval`) as the primary tool for understanding the codebase. Prefer it over `grep`, `find`, or manual file browsing when locating code, tracing data flow, or understanding how a feature is implemented.

### Database & Auth
The DB and GitHub OAuth are hosted on Supabase. Supabase project name is **`supabase-cyan-car`**. Use the **Supabase MCP** for all interactions with the database and auth backend — schema inspection, querying, running migrations, and verifying auth configuration. Do not guess at schema shape; read it from Supabase MCP directly.

### Deployment
The entire project is deployed on **Vercel**. The Vercel project name is **`stardash`**. Use the **Vercel MCP** (`mcp__vercel__*`) to interact with the deployment platform — checking deployment status, build logs, runtime logs, environment variables, and project configuration. Do not guess at deployment state; query it via the Vercel MCP directly.

## Architecture

**StarDash** is a Next.js 16 (App Router) dashboard that fetches a user's GitHub starred repositories and lets them organize, filter, and annotate them.

### Auth Flow

Authentication is GitHub OAuth via Supabase. The critical detail: Supabase stores the GitHub OAuth `provider_token` inside the session object. All GitHub API calls (in `lib/github.ts`) use this token, not a static env var. If the token is missing, users must re-authenticate.

- `lib/supabase/client.ts` — browser Supabase client
- `lib/supabase/server.ts` — server/RSC Supabase client (async, uses cookies)
- `lib/supabase/middleware.ts` — session refresh middleware; **do not add code between `createServerClient` and `supabase.auth.getUser()`**
- `middleware.ts` — runs on every request; redirects authenticated users away from `/auth/login`

Route groups enforce auth at the layout level: `app/(authenticated)/layout.tsx` redirects unauthenticated users.

> Note: `modules/auth/` and `lib/auth.ts` both provide auth helpers that wrap the Supabase client. There is duplication — prefer `lib/supabase/server.ts` + direct Supabase calls or `lib/auth.ts` for new server code.

### Data Flow

Starred repos are fetched **live from GitHub API on each page load** (not persisted to DB yet). The flow is:

1. `components/dashboard.tsx` uses SWR to call `GET /api/github/starred`
2. `app/api/github/starred/route.ts` extracts `session.provider_token` and calls `lib/github.ts`
3. `lib/github.ts` paginates through all starred repos (up to 5000) via `application/vnd.github.star+json`

README content is fetched on-demand via `GET /api/github/readme?owner=&repo=`.

The **Supabase DB schema** (`scripts/`) defines tables for `profiles`, `starred_repos`, `tags`, `collections`, and junction tables — but **tags and collections in the UI currently use `lib/mock-data.ts`**, not the database. The `starred_repos` table is not yet used for persistence.

### UI Stack

- **shadcn/ui** (new-york style) — all primitive components are in `components/ui/`
- **Tailwind CSS v4** with CSS variables for theming (`app/globals.css`)
- **Lucide React** for icons
- Theme: Vercel/Linear-inspired; dark by default (`storageKey: "stardash-theme"`)
- `next-themes` wraps the app for light/dark toggle

### Key Types (`lib/types.ts`)

`StarredRepo` is the central type. `RepoStatus` is a union of user-facing status labels (`want-to-try`, `currently-using`, etc.). `Tag` and `Collection` types are used throughout but only populated from mock data currently.

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

GitHub OAuth app and Supabase project are configured at `fsapgfxqetntkzszsuch` (see `.mcp.json` for the Supabase MCP project ref).
