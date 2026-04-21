create table if not exists public.repos (
  id uuid primary key default gen_random_uuid(),
  github_repo_id bigint not null unique,
  owner text not null,
  name text not null,
  full_name text not null,
  description text,
  language text,
  language_color text,
  topics text[] not null default '{}'::text[],
  homepage text,
  license text,
  stargazers_count integer not null default 0,
  forks_count integer not null default 0,
  open_issues_count integer not null default 0,
  pushed_at timestamptz,
  avatar_url text,
  archived boolean not null default false,
  readme text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.repos enable row level security;

create policy "repos_select_authenticated"
  on public.repos
  for select
  to authenticated
  using (true);

create policy "repos_insert_authenticated"
  on public.repos
  for insert
  to authenticated
  with check (true);

create policy "repos_update_authenticated"
  on public.repos
  for update
  to authenticated
  using (true);

create table if not exists public.user_starred_repos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  repo_id uuid not null references public.repos(id) on delete cascade,
  starred_at timestamptz,
  status text check (status in ('want-to-try', 'currently-using', 'tried-liked', 'tried-dropped', 'just-interesting', 'reference')),
  is_pinned boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, repo_id)
);

alter table public.user_starred_repos enable row level security;

create policy "user_starred_repos_select_own"
  on public.user_starred_repos
  for select
  using (auth.uid() = user_id);

create policy "user_starred_repos_insert_own"
  on public.user_starred_repos
  for insert
  with check (auth.uid() = user_id);

create policy "user_starred_repos_update_own"
  on public.user_starred_repos
  for update
  using (auth.uid() = user_id);

create policy "user_starred_repos_delete_own"
  on public.user_starred_repos
  for delete
  using (auth.uid() = user_id);

create table if not exists public.user_starred_repo_tags (
  user_starred_repo_id uuid not null references public.user_starred_repos(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (user_starred_repo_id, tag_id)
);

alter table public.user_starred_repo_tags enable row level security;

create policy "user_starred_repo_tags_select_own"
  on public.user_starred_repo_tags
  for select
  using (
    exists (
      select 1
      from public.user_starred_repos usr
      where usr.id = user_starred_repo_id
        and usr.user_id = auth.uid()
    )
  );

create policy "user_starred_repo_tags_insert_own"
  on public.user_starred_repo_tags
  for insert
  with check (
    exists (
      select 1
      from public.user_starred_repos usr
      where usr.id = user_starred_repo_id
        and usr.user_id = auth.uid()
    )
  );

create policy "user_starred_repo_tags_delete_own"
  on public.user_starred_repo_tags
  for delete
  using (
    exists (
      select 1
      from public.user_starred_repos usr
      where usr.id = user_starred_repo_id
        and usr.user_id = auth.uid()
    )
  );

create table if not exists public.user_starred_repo_collections (
  user_starred_repo_id uuid not null references public.user_starred_repos(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  primary key (user_starred_repo_id, collection_id)
);

alter table public.user_starred_repo_collections enable row level security;

create policy "user_starred_repo_collections_select_own"
  on public.user_starred_repo_collections
  for select
  using (
    exists (
      select 1
      from public.user_starred_repos usr
      where usr.id = user_starred_repo_id
        and usr.user_id = auth.uid()
    )
  );

create policy "user_starred_repo_collections_insert_own"
  on public.user_starred_repo_collections
  for insert
  with check (
    exists (
      select 1
      from public.user_starred_repos usr
      where usr.id = user_starred_repo_id
        and usr.user_id = auth.uid()
    )
  );

create policy "user_starred_repo_collections_delete_own"
  on public.user_starred_repo_collections
  for delete
  using (
    exists (
      select 1
      from public.user_starred_repos usr
      where usr.id = user_starred_repo_id
        and usr.user_id = auth.uid()
    )
  );

create index if not exists idx_repos_github_repo_id
  on public.repos (github_repo_id);

create index if not exists idx_repos_full_name
  on public.repos (full_name);

create index if not exists idx_user_starred_repos_user_id
  on public.user_starred_repos (user_id);

create index if not exists idx_user_starred_repos_repo_id
  on public.user_starred_repos (repo_id);

create index if not exists idx_user_starred_repos_starred_at
  on public.user_starred_repos (starred_at desc);

create index if not exists idx_user_starred_repo_tags_user_starred_repo_id
  on public.user_starred_repo_tags (user_starred_repo_id);

create index if not exists idx_user_starred_repo_collections_user_starred_repo_id
  on public.user_starred_repo_collections (user_starred_repo_id);

drop trigger if exists on_repos_update on public.repos;
create trigger on_repos_update
  before update on public.repos
  for each row
  execute function public.handle_updated_at();

drop trigger if exists on_user_starred_repos_update on public.user_starred_repos;
create trigger on_user_starred_repos_update
  before update on public.user_starred_repos
  for each row
  execute function public.handle_updated_at();

insert into public.repos (
  github_repo_id,
  owner,
  name,
  full_name,
  description,
  language,
  language_color,
  topics,
  homepage,
  license,
  stargazers_count,
  forks_count,
  open_issues_count,
  pushed_at,
  avatar_url,
  archived,
  readme
)
select distinct on (sr.github_repo_id)
  sr.github_repo_id,
  sr.owner,
  sr.name,
  sr.full_name,
  sr.description,
  sr.language,
  sr.language_color,
  coalesce(sr.topics, '{}'::text[]),
  sr.homepage,
  sr.license,
  coalesce(sr.stargazers_count, 0),
  coalesce(sr.forks_count, 0),
  coalesce(sr.open_issues_count, 0),
  sr.pushed_at,
  sr.avatar_url,
  false,
  sr.readme
from public.starred_repos sr
on conflict (github_repo_id) do update
set owner = excluded.owner,
    name = excluded.name,
    full_name = excluded.full_name,
    description = excluded.description,
    language = excluded.language,
    language_color = excluded.language_color,
    topics = excluded.topics,
    homepage = excluded.homepage,
    license = excluded.license,
    stargazers_count = excluded.stargazers_count,
    forks_count = excluded.forks_count,
    open_issues_count = excluded.open_issues_count,
    pushed_at = excluded.pushed_at,
    avatar_url = excluded.avatar_url,
    readme = coalesce(excluded.readme, public.repos.readme);

insert into public.user_starred_repos (
  user_id,
  repo_id,
  starred_at,
  status,
  is_pinned,
  notes,
  created_at,
  updated_at
)
select
  sr.user_id,
  r.id,
  sr.starred_at,
  sr.status,
  coalesce(sr.is_pinned, false),
  sr.notes,
  sr.created_at,
  sr.updated_at
from public.starred_repos sr
join public.repos r on r.github_repo_id = sr.github_repo_id
on conflict (user_id, repo_id) do update
set starred_at = excluded.starred_at,
    status = coalesce(public.user_starred_repos.status, excluded.status),
    is_pinned = coalesce(public.user_starred_repos.is_pinned, excluded.is_pinned),
    notes = coalesce(public.user_starred_repos.notes, excluded.notes),
    updated_at = greatest(public.user_starred_repos.updated_at, excluded.updated_at);

insert into public.user_starred_repo_tags (user_starred_repo_id, tag_id)
select distinct
  usr.id,
  rt.tag_id
from public.repo_tags rt
join public.starred_repos sr on sr.id = rt.repo_id
join public.repos r on r.github_repo_id = sr.github_repo_id
join public.user_starred_repos usr
  on usr.user_id = sr.user_id
 and usr.repo_id = r.id
on conflict do nothing;

insert into public.user_starred_repo_collections (user_starred_repo_id, collection_id)
select distinct
  usr.id,
  rc.collection_id
from public.repo_collections rc
join public.starred_repos sr on sr.id = rc.repo_id
join public.repos r on r.github_repo_id = sr.github_repo_id
join public.user_starred_repos usr
  on usr.user_id = sr.user_id
 and usr.repo_id = r.id
on conflict do nothing;
