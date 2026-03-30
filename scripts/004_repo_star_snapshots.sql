create table if not exists public.repo_star_snapshots (
  id uuid primary key default gen_random_uuid(),
  repo_github_id bigint not null,
  owner text not null,
  name text not null,
  star_count integer not null,
  snapshot_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (repo_github_id, snapshot_date)
);

comment on table public.repo_star_snapshots is 'Stores daily snapshots of star counts for repos to calculate velocity trends';

alter table public.repo_star_snapshots enable row level security;

create policy "Allow read access to authenticated users"
  on public.repo_star_snapshots
  for select
  to authenticated
  using (true);

create policy "Allow insert from service role"
  on public.repo_star_snapshots
  for insert
  to service_role
  with check (true);

create policy "Allow update from service role"
  on public.repo_star_snapshots
  for update
  to service_role
  using (true);

create index if not exists idx_repo_star_snapshots_repo_id
  on public.repo_star_snapshots (repo_github_id);

create index if not exists idx_repo_star_snapshots_date
  on public.repo_star_snapshots (snapshot_date);

create index if not exists idx_repo_star_snapshots_repo_date
  on public.repo_star_snapshots (repo_github_id, snapshot_date);
