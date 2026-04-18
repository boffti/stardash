alter table public.tags
  add constraint tags_id_user_id_unique unique (id, user_id);

alter table public.collections
  add constraint collections_id_user_id_unique unique (id, user_id);

alter table public.user_starred_repos
  add constraint user_starred_repos_id_user_id_unique unique (id, user_id);

alter table public.user_starred_repo_tags
  add column if not exists user_id uuid;

update public.user_starred_repo_tags usrt
set user_id = usr.user_id
from public.user_starred_repos usr
where usr.id = usrt.user_starred_repo_id
  and usrt.user_id is null;

alter table public.user_starred_repo_tags
  alter column user_id set not null;

alter table public.user_starred_repo_collections
  add column if not exists user_id uuid;

update public.user_starred_repo_collections usrc
set user_id = usr.user_id
from public.user_starred_repos usr
where usr.id = usrc.user_starred_repo_id
  and usrc.user_id is null;

alter table public.user_starred_repo_collections
  alter column user_id set not null;

alter table public.user_starred_repo_tags
  add constraint user_starred_repo_tags_user_starred_repo_owner_fkey
  foreign key (user_starred_repo_id, user_id)
  references public.user_starred_repos (id, user_id)
  on delete cascade;

alter table public.user_starred_repo_tags
  add constraint user_starred_repo_tags_tag_owner_fkey
  foreign key (tag_id, user_id)
  references public.tags (id, user_id)
  on delete cascade;

alter table public.user_starred_repo_collections
  add constraint user_starred_repo_collections_user_starred_repo_owner_fkey
  foreign key (user_starred_repo_id, user_id)
  references public.user_starred_repos (id, user_id)
  on delete cascade;

alter table public.user_starred_repo_collections
  add constraint user_starred_repo_collections_collection_owner_fkey
  foreign key (collection_id, user_id)
  references public.collections (id, user_id)
  on delete cascade;

drop policy if exists "user_starred_repo_tags_select_own" on public.user_starred_repo_tags;
drop policy if exists "user_starred_repo_tags_insert_own" on public.user_starred_repo_tags;
drop policy if exists "user_starred_repo_tags_delete_own" on public.user_starred_repo_tags;

create policy "user_starred_repo_tags_select_own"
  on public.user_starred_repo_tags
  for select
  using (auth.uid() = user_id);

create policy "user_starred_repo_tags_insert_own"
  on public.user_starred_repo_tags
  for insert
  with check (auth.uid() = user_id);

create policy "user_starred_repo_tags_delete_own"
  on public.user_starred_repo_tags
  for delete
  using (auth.uid() = user_id);

drop policy if exists "user_starred_repo_collections_select_own" on public.user_starred_repo_collections;
drop policy if exists "user_starred_repo_collections_insert_own" on public.user_starred_repo_collections;
drop policy if exists "user_starred_repo_collections_delete_own" on public.user_starred_repo_collections;

create policy "user_starred_repo_collections_select_own"
  on public.user_starred_repo_collections
  for select
  using (auth.uid() = user_id);

create policy "user_starred_repo_collections_insert_own"
  on public.user_starred_repo_collections
  for insert
  with check (auth.uid() = user_id);

create policy "user_starred_repo_collections_delete_own"
  on public.user_starred_repo_collections
  for delete
  using (auth.uid() = user_id);

create or replace function public.get_user_repo_metadata()
returns table (
  github_repo_id bigint,
  user_starred_repo_id uuid,
  status text,
  is_pinned boolean,
  notes text,
  tag_ids uuid[],
  collection_ids uuid[]
)
language sql
security invoker
set search_path = public
as $$
  select
    r.github_repo_id,
    usr.id as user_starred_repo_id,
    usr.status,
    usr.is_pinned,
    usr.notes,
    coalesce(array_agg(distinct usrt.tag_id) filter (where usrt.tag_id is not null), '{}'::uuid[]) as tag_ids,
    coalesce(array_agg(distinct usrc.collection_id) filter (where usrc.collection_id is not null), '{}'::uuid[]) as collection_ids
  from public.user_starred_repos usr
  join public.repos r
    on r.id = usr.repo_id
  left join public.user_starred_repo_tags usrt
    on usrt.user_starred_repo_id = usr.id
   and usrt.user_id = usr.user_id
  left join public.user_starred_repo_collections usrc
    on usrc.user_starred_repo_id = usr.id
   and usrc.user_id = usr.user_id
  where usr.user_id = auth.uid()
  group by r.github_repo_id, usr.id, usr.status, usr.is_pinned, usr.notes;
$$;

grant execute on function public.get_user_repo_metadata() to authenticated;
