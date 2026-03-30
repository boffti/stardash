drop policy if exists "repos_select_authenticated" on public.repos;

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
security definer
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

revoke all on function public.get_user_repo_metadata() from public;
grant execute on function public.get_user_repo_metadata() to authenticated;
