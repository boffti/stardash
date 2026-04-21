-- Migration 016: cached Discover search history.

create table if not exists public.discover_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null,
  normalized_query text not null,
  results jsonb not null default '[]'::jsonb,
  pipeline_events jsonb not null default '[]'::jsonb,
  result_count integer not null default 0,
  model_provider text,
  model_id text,
  search_version text not null default 'v1',
  cached_at timestamptz not null default now(),
  last_run_at timestamptz not null default now(),
  last_opened_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  is_saved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discover_searches_query_length_check check (char_length(query) between 1 and 500),
  constraint discover_searches_normalized_query_length_check check (char_length(normalized_query) between 1 and 500),
  unique (user_id, normalized_query, search_version)
);

alter table public.discover_searches enable row level security;

create policy "discover_searches_select_own"
  on public.discover_searches
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "discover_searches_insert_own"
  on public.discover_searches
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "discover_searches_update_own"
  on public.discover_searches
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "discover_searches_delete_own"
  on public.discover_searches
  for delete
  to authenticated
  using (auth.uid() = user_id);

create index if not exists idx_discover_searches_user_saved
  on public.discover_searches (user_id, is_saved desc, last_run_at desc);

create index if not exists idx_discover_searches_user_expires
  on public.discover_searches (user_id, expires_at);

create or replace function public.update_discover_searches_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_discover_searches_update on public.discover_searches;
create trigger on_discover_searches_update
  before update on public.discover_searches
  for each row execute function public.update_discover_searches_updated_at();
