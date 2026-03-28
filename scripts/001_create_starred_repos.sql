-- Create profiles table to store user data from GitHub OAuth
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  github_username text,
  github_avatar_url text,
  github_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Create starred_repos table
create table if not exists public.starred_repos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  github_repo_id bigint not null,
  owner text not null,
  name text not null,
  full_name text not null,
  description text,
  language text,
  language_color text,
  topics text[] default '{}',
  homepage text,
  license text,
  stargazers_count integer default 0,
  forks_count integer default 0,
  open_issues_count integer default 0,
  pushed_at timestamptz,
  starred_at timestamptz,
  avatar_url text,
  status text check (status in ('want-to-try', 'currently-using', 'tried-liked', 'tried-dropped', 'just-interesting', 'reference')),
  is_pinned boolean default false,
  notes text,
  readme text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, github_repo_id)
);

alter table public.starred_repos enable row level security;

create policy "starred_repos_select_own" on public.starred_repos for select using (auth.uid() = user_id);
create policy "starred_repos_insert_own" on public.starred_repos for insert with check (auth.uid() = user_id);
create policy "starred_repos_update_own" on public.starred_repos for update using (auth.uid() = user_id);
create policy "starred_repos_delete_own" on public.starred_repos for delete using (auth.uid() = user_id);

-- Create tags table
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  color text not null,
  created_at timestamptz default now(),
  unique(user_id, label)
);

alter table public.tags enable row level security;

create policy "tags_select_own" on public.tags for select using (auth.uid() = user_id);
create policy "tags_insert_own" on public.tags for insert with check (auth.uid() = user_id);
create policy "tags_update_own" on public.tags for update using (auth.uid() = user_id);
create policy "tags_delete_own" on public.tags for delete using (auth.uid() = user_id);

-- Create repo_tags junction table
create table if not exists public.repo_tags (
  repo_id uuid not null references public.starred_repos(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (repo_id, tag_id)
);

alter table public.repo_tags enable row level security;

create policy "repo_tags_select_own" on public.repo_tags for select using (
  exists (select 1 from public.starred_repos where id = repo_id and user_id = auth.uid())
);
create policy "repo_tags_insert_own" on public.repo_tags for insert with check (
  exists (select 1 from public.starred_repos where id = repo_id and user_id = auth.uid())
);
create policy "repo_tags_delete_own" on public.repo_tags for delete using (
  exists (select 1 from public.starred_repos where id = repo_id and user_id = auth.uid())
);

-- Create collections table
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text,
  color text,
  created_at timestamptz default now(),
  unique(user_id, name)
);

alter table public.collections enable row level security;

create policy "collections_select_own" on public.collections for select using (auth.uid() = user_id);
create policy "collections_insert_own" on public.collections for insert with check (auth.uid() = user_id);
create policy "collections_update_own" on public.collections for update using (auth.uid() = user_id);
create policy "collections_delete_own" on public.collections for delete using (auth.uid() = user_id);

-- Create repo_collections junction table
create table if not exists public.repo_collections (
  repo_id uuid not null references public.starred_repos(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  primary key (repo_id, collection_id)
);

alter table public.repo_collections enable row level security;

create policy "repo_collections_select_own" on public.repo_collections for select using (
  exists (select 1 from public.starred_repos where id = repo_id and user_id = auth.uid())
);
create policy "repo_collections_insert_own" on public.repo_collections for insert with check (
  exists (select 1 from public.starred_repos where id = repo_id and user_id = auth.uid())
);
create policy "repo_collections_delete_own" on public.repo_collections for delete using (
  exists (select 1 from public.starred_repos where id = repo_id and user_id = auth.uid())
);

-- Create indexes for better query performance
create index if not exists idx_starred_repos_user_id on public.starred_repos(user_id);
create index if not exists idx_starred_repos_language on public.starred_repos(language);
create index if not exists idx_starred_repos_starred_at on public.starred_repos(starred_at desc);
create index if not exists idx_starred_repos_stargazers_count on public.starred_repos(stargazers_count desc);
create index if not exists idx_tags_user_id on public.tags(user_id);
create index if not exists idx_collections_user_id on public.collections(user_id);

-- Create function to auto-update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create triggers for updated_at
create trigger on_profiles_update
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

create trigger on_starred_repos_update
  before update on public.starred_repos
  for each row
  execute function public.handle_updated_at();
