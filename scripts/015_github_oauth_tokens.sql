-- Migration 015: server-only GitHub OAuth token store.
-- Used to repair the short-lived httpOnly gh_token cookie from route handlers.

create table if not exists public.github_oauth_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider_token text not null,
  provider_refresh_token text,
  token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.github_oauth_tokens enable row level security;

-- Intentionally no authenticated-user SELECT/INSERT/UPDATE/DELETE policies.
-- The app reads/writes this table through the service-role admin client only.

create index if not exists idx_github_oauth_tokens_token_expires_at
  on public.github_oauth_tokens(token_expires_at);
