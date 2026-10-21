# StarDash traction plan: local-first rewrite, MCP, Radar-first

Date: 2026-10-21. Status: proposal. Estimates are focused solo days with AI assistance.

## Goal

Turn StarDash from a cloud-first app (Supabase + Vercel cron + OpenRouter) into a
single-container, local-first tool that a stranger can run in under two minutes,
positioned around Radar ("new repos your taste says to look at"), with an MCP server
so agents can use it. Target: 500 stars within 90 days of launch.

## Why this shape

| Project                              | Stars | Shape                                       |
| ------------------------------------ | ----- | ------------------------------------------- |
| AmintaCCCP/GithubStarsManager        | 3,720 | Electron, 100% local, MCP, bilingual        |
| izumi0uu/better-github-stars-manager | 240   | Chrome extension, local-first               |
| GEMILUXVII/starflow                  | 44    | One Docker container, SQLite                |
| boffti/stardash                      | 12    | Needs Supabase project + OAuth app + Vercel |

Every project above 40 stars needs zero accounts to try. StarDash needs four.
Leader owns "organize your stars." Nobody owns "ranked inbound feed with
people-you-follow signal." Radar is the wedge.

## Measured coupling (what the rewrite actually touches)

- 44 files import Supabase. 24 API routes. 7 client components use the browser client.
- ~95 direct `.from("table")` query sites across ~30 files. 14 tables. 2 Postgres RPCs
  (`get_user_repo_metadata`, `check_and_increment_ai_limit`). 1 auth trigger.
- Auth is centralized: `lib/auth.ts`, `lib/tokens.ts`, `lib/supabase/middleware.ts`,
  used by 26 callers. Good: swap the three, callers mostly survive.
- Cron: 2 routes under `app/api/cron/*`, scheduled by `vercel.json`.
- Observability: Sentry in 16 files, Langfuse in 9, all env-gated. Keep, make no-op without env.
- `modules/auth/` is legacy and deletable. `feat/mcp` branch has no commits beyond main.

## Target architecture

- **Runtime:** Next.js 16 standalone, Node 24, `node:24-slim` image (glibc, avoids
  native-module pain on Alpine). One container, one volume at `/data`.
- **DB:** SQLite via Drizzle + `better-sqlite3`. Schema in `lib/db/schema.ts`, migrations
  via `drizzle-kit`, auto-applied on boot. Keep `user_id` on every per-user table so the
  hosted multi-user demo uses the same schema. RLS becomes `where user_id = ?` in queries.
- **Auth, two modes, one interface:** `getSession()` returns `{ user, githubToken }`.
  - `AUTH_MODE=pat` (default, self-host): first-run `/setup` page asks for a GitHub PAT,
    validates against `GET /user`, stores owner + token in SQLite, sets an HMAC-signed
    cookie (`node:crypto`, no library). Single owner. No OAuth app needed.
  - `AUTH_MODE=github` (hosted demo): GitHub OAuth via `arctic`, sessions table in SQLite.
- **Scheduler:** in-process. `instrumentation.ts` registers a `setInterval` driver
  (`node-cron` only if intervals get awkward) that calls the existing cron route
  handlers directly. `CRON_SECRET` stays for external triggering. `vercel.json` crons deleted.
- **AI:** unchanged (`lib/ai-provider.ts` already provider-agnostic). Self-host: env key or
  per-user key in SQLite, no quotas. Hosted demo: BYO key only, no free quota.
- **Observability:** unchanged, optional.
- **MCP:** `app/api/mcp/route.ts` using `mcp-handler` (Streamable HTTP). Auth by the
  session cookie or a per-user API token minted in Settings. Agents point at
  `http://localhost:3000/api/mcp`.
- **Hosted stardash.dev:** demo only. Fly.io or Railway, one machine, one volume,
  `AUTH_MODE=github`. Not a product.

Dropped: Supabase, Vercel cron, free hosted AI quota, `modules/auth/`, `github_oauth_tokens`
table (folded into `profiles`), both RPCs (become TypeScript).

## Phases

### Phase 0: Stabilize and signal (1 day)

- Fix `.gitignore` (last line is `.mcp.jsonsupabase/.temp/`; `.mcp.json` with Langfuse keys is untracked but unignored).
- Merge the Radar branch to `main` behind an env flag so it is not lost.
- Merge or close the 7 Dependabot PRs. Keep zod 3 until Phase 1 (schema work is a natural time to move).
- Do not restore Supabase. Put a README banner: "v1 rewrite in progress: single container, SQLite, MCP. Star to follow." Pin a roadmap issue linking this plan.
- Done when: `main` typechecks, Radar code is on `main`, banner is live.

### Phase 1: Data layer (4 to 5 days)

- Add Drizzle + better-sqlite3. Write `lib/db/schema.ts` for 13 tables (14 minus `github_oauth_tokens`).
- `lib/db/index.ts`: open `/data/stardash.db` (env `DATABASE_PATH`), run migrations on boot, WAL mode.
- Port the two RPCs: `get_user_repo_metadata` becomes one query module, `check_and_increment_ai_limit` becomes a transaction, bypassed when `AUTH_MODE=pat`.
- Convert ~95 query sites. Mechanical. Go route by route, one commit per route. Order: `user/metadata`, `github/starred`, tags/collections, `radar/*`, `search/*`, `ai/*`, `cron/*`, `intel/*`.
- Delete `lib/supabase/admin.ts`, keep `server.ts` and `client.ts` as thin shims until Phase 2 removes them.
- Done when: every API route compiles against Drizzle, `pnpm typecheck` clean, `scripts/radar-score.check.ts` passes, and a seeded SQLite file serves the dashboard locally.

### Phase 2: Auth (2 to 3 days)

- `lib/auth.ts` rewritten: `getSession()`, `requireSession()`, cookie signing, `AUTH_MODE` switch.
- `lib/tokens.ts`: returns the stored PAT (pat mode) or the OAuth token with refresh (github mode).
- `/setup` page (pat mode, first run only). `/auth/login` + `/auth/callback` on `arctic` (github mode).
- `middleware.ts`: cookie check and redirects only. Delete `lib/supabase/*`, `modules/auth/`, `app/api/auth/token`.
- Rewrite the 7 client components that imported the browser client to use `/api/user/*` routes and the existing `UserProvider`.
- Done when: fresh DB, open app, paste PAT, see your stars. And: `AUTH_MODE=github` round-trips OAuth locally.

### Phase 3: Container, scheduler, install story (1 to 2 days)

- Dockerfile on `node:24-slim`, `output: "standalone"`, `VOLUME /data`, `HEALTHCHECK` on `/api/health`.
- In-process scheduler in `instrumentation.ts` (star snapshots 02:00, radar ingest 02:30, both skip if a run happened in the last 20h so restarts do not double-run).
- `docker-compose.yml` becomes one service. GitHub Actions publishes `ghcr.io/boffti/stardash:latest` and semver tags on release.
- `.env.example` shrinks to: `DATABASE_PATH`, `AUTH_MODE`, `OPENROUTER_API_KEY` (optional), `CRON_SECRET` (optional), `GITHUB_CLIENT_ID/SECRET` (github mode only).
- Done when: on a clean machine, `docker run -p 3000:3000 -v stardash:/data ghcr.io/boffti/stardash` to first synced star takes under two minutes, timed.

### Phase 4: MCP server (2 to 3 days)

- `app/api/mcp/route.ts` with `mcp-handler`. Tools: `search_stars`, `get_repo`, `list_tags_collections`, `radar_feed`, `radar_action` (dismiss/snooze/star), `star_repo`, `add_note`.
- Settings page mints and revokes API tokens (hashed in SQLite). MCP auth accepts `Authorization: Bearer <token>` or the session cookie.
- README section with copy-paste config for Claude Code, Cursor, Claude Desktop.
- Done when: Claude Code lists the tools and `radar_feed` returns today's feed.

### Phase 5: Radar-first repositioning (3 to 4 days)

- `/radar` is the post-login landing. Dashboard moves to second nav slot.
- Radar polish from the current branch: keyboard triage, evidence line, "Scan now". Add one hook feature: weekly "Radar digest" email-free summary page at `/radar/week` (shareable screenshot material).
- README rewrite: 20-second Radar GIF at the top, `docker run` one-liner above the fold, feature table second, MCP config third, self-host env table last. Add `README.zh-CN.md` (three of the top eight repos in this niche are CN-first).
- Landing page (`app/page.tsx`) rewritten around Radar with the same GIF. Demo instance seeded with a public sample profile.
- Repo hygiene: Discussions on, labels (`good first issue`, `help wanted`, `radar`, `mcp`), the 4 existing issues labelled good-first-issue, `CONTRIBUTING.md` updated for the SQLite dev loop (`pnpm dev`, no accounts), pinned roadmap issue.
- Done when: a stranger reading only the README above the fold can say what Radar does and run it.

### Phase 6: Launch (2 days work, 1 week calendar)

- Tag `v1.0.0` with release notes and the GIF.
- Day 1: Show HN ("I kept starring repos and forgetting them, so I built a Radar for new ones"). Same morning: r/selfhosted, r/github, X and Bluesky thread.
- Day 2 to 3: Product Hunt (schedule Tuesday). dev.to post on the Radar scoring (taste profile, social signal outranks topic match; `lib/radar.ts` is a readable 156 lines, link it).
- Day 3 to 5: PRs to `awesome-selfhosted` and `awesome-mcp-servers`. Chinese post on Juejin or V2EX using the zh README.
- Respond to every issue and comment within 24h for the first two weeks.

### Phase 7: Compounding (8 weeks, 1 day per week)

- Weekly release cadence, each with one visible change and a changelog entry.
- Monthly "Radar found these" post using your own feed as content.
- Merge external PRs fast; credit in release notes.

## Totals

| Phase           | Days                  |
| --------------- | --------------------- |
| 0 Stabilize     | 1                     |
| 1 Data layer    | 4 to 5                |
| 2 Auth          | 2 to 3                |
| 3 Container     | 1 to 2                |
| 4 MCP           | 2 to 3                |
| 5 Positioning   | 3 to 4                |
| 6 Launch        | 2                     |
| Total to launch | 15 to 20 focused days |

Part-time at ~2 days/week: launch in 8 to 10 weeks. Full-time: 4 weeks.

## Metrics and kill criteria

- Launch week: 100 stars, 50 unique clones/pulls, 3 external issues.
- Day 90: 500 stars, 3 merged external PRs, 20 image pulls/day.
- Kill: under 150 stars 30 days after Show HN and Product Hunt both ran. Then maintenance mode, move the energy to another project.

## Risks

- **Rewrite stalls mid-way.** Mitigation: Phase 1 goes route by route with one commit each; the app is runnable after every commit via the shims.
- **better-sqlite3 build pain in Docker.** Mitigation: glibc image. Fallback: `@libsql/client` (pure JS build available) or Node 24 `node:sqlite`.
- **Hosted demo cost.** Mitigation: BYO AI key only, one small machine, demo seeded read-mostly.
- **Radar needs GitHub API budget nightly.** In pat mode the owner's token is used (5k/h, plenty). Hosted uses `GITHUB_PAT` as today.
- **Leader ships a Radar clone.** They have 188 forks and a desktop app; they could. Speed and the social-graph signal are the moat. Ship before they notice.

## Out of scope

Vector search, repo Q&A chat, gist and fork management, Electron app, browser extension.
The leader has all of these. Do not compete on surface area.
