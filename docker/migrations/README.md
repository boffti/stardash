# Database Migrations

These SQL files set up the StarDash schema in your Supabase project.
Run them **in order** using the Supabase SQL editor or CLI.

| File | Description |
|------|-------------|
| `001_create_starred_repos.sql` | Initial schema — starred repos + profiles |
| `002_profile_trigger.sql` | Auto-create profile on auth.users insert |
| `003_provider_tokens.sql` | GitHub OAuth token storage in profiles |
| `004_repo_star_snapshots.sql` | Daily star count history table |
| `005_global_repos_and_user_starred_mapping.sql` | Global repo catalog + per-user mapping |
| `006_drop_legacy_starred_repo_tables.sql` | Removes old tables superseded by 005 |
| `007_harden_user_taxonomy_ownership.sql` | RLS: tags/collections owned by user |
| `008_lock_down_repo_writes.sql` | RLS: repos writable only by service role |
| `009_lock_down_repo_reads.sql` | RLS: repos readable only by authenticated users |
| `010_ai_categorization_daily_limit.sql` | Rate-limit column for AI categorization |
| `011_secure_profile_token_columns.sql` | RLS on sensitive profile token columns |
| `012_ai_weekly_limits.sql` | Weekly AI usage tracking columns |
| `013_guardrails.sql` | Input length CHECK constraints + contribution scan rate-limit column |
| `014_remove_provider_token_columns.sql` | Removes legacy profile token columns |
| `015_github_oauth_tokens.sql` | Server-only GitHub OAuth token store for cookie repair |
| `016_discover_searches.sql` | Cached Discover search history and saved searches |

## How to apply

### Option A — Supabase Dashboard (recommended for first-time setup)

1. Open your Supabase project → **SQL Editor**
2. Paste and run each file in the numbered order above

### Option B — Supabase CLI

```bash
supabase db push --db-url "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
```

Or run each file individually:

```bash
psql "$DATABASE_URL" -f 001_create_starred_repos.sql
psql "$DATABASE_URL" -f 002_profile_trigger.sql
# ... continue in order
```

## Notes

- All migrations are **idempotent** (`IF NOT EXISTS`, `IF EXISTS`) — safe to re-run.
- Migrations 008 and 009 lock down the `repos` table so only the service role can write to it. Your app must use `SUPABASE_SERVICE_ROLE_KEY` for repo upserts.
- After running migrations, enable **GitHub** as an OAuth provider in **Supabase → Auth → Providers** with your GitHub OAuth App credentials.
