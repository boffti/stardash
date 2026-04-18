-- Create function to auto-create profile on user signup (from GitHub OAuth)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    github_username,
    github_avatar_url,
    github_id
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'user_name', new.raw_user_meta_data ->> 'preferred_username'),
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'provider_id'
  )
  on conflict (id) do update set
    github_username = excluded.github_username,
    github_avatar_url = excluded.github_avatar_url,
    github_id = excluded.github_id,
    updated_at = now();

  return new;
end;
$$;

-- Drop existing trigger if exists and create new one
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
