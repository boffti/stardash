drop policy if exists "repos_insert_authenticated" on public.repos;
drop policy if exists "repos_update_authenticated" on public.repos;

drop policy if exists "user_starred_repos_insert_own" on public.user_starred_repos;
drop policy if exists "user_starred_repos_delete_own" on public.user_starred_repos;
