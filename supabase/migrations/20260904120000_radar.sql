-- Radar: inbound feed of new/rising repos scored against each user's taste.

create table if not exists public.radar_candidates (
  github_repo_id bigint primary key,
  owner text not null,
  name text not null,
  full_name text not null,
  description text,
  language text,
  topics text[] not null default '{}',
  stargazers_count integer not null default 0,
  forks_count integer not null default 0,
  pushed_at timestamptz,
  gh_created_at timestamptz,
  avatar_url text,
  html_url text not null,
  -- {"new": true, "hn": {"points": 120, "title": "...", "url": "..."}}
  sources jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists radar_candidates_last_seen_idx
  on public.radar_candidates (last_seen_at desc);

-- Per-user social signal: someone the user follows starred this repo.
create table if not exists public.radar_signals (
  user_id uuid not null references auth.users(id) on delete cascade,
  github_repo_id bigint not null,
  actor_login text not null,
  seen_at timestamptz not null default now(),
  primary key (user_id, github_repo_id, actor_login)
);

create index if not exists radar_signals_user_seen_idx
  on public.radar_signals (user_id, seen_at desc);

-- Per-user triage decisions. Snoozed rows resurface after `until`.
create table if not exists public.radar_actions (
  user_id uuid not null references auth.users(id) on delete cascade,
  github_repo_id bigint not null,
  action text not null check (action in ('dismissed', 'snoozed', 'starred')),
  until timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, github_repo_id)
);

alter table public.radar_candidates enable row level security;
alter table public.radar_signals enable row level security;
alter table public.radar_actions enable row level security;

create policy "radar_candidates_read_authenticated"
  on public.radar_candidates for select to authenticated using (true);

create policy "radar_signals_select_own"
  on public.radar_signals for select to authenticated using (auth.uid() = user_id);

create policy "radar_actions_select_own"
  on public.radar_actions for select to authenticated using (auth.uid() = user_id);
create policy "radar_actions_insert_own"
  on public.radar_actions for insert to authenticated with check (auth.uid() = user_id);
create policy "radar_actions_update_own"
  on public.radar_actions for update to authenticated using (auth.uid() = user_id);
create policy "radar_actions_delete_own"
  on public.radar_actions for delete to authenticated using (auth.uid() = user_id);

-- Cron writes candidates/signals via the service role; no write policies for users.
