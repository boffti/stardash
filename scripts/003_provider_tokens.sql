-- Add provider token storage to profiles table

alter table public.profiles add column if not exists provider_token text;
alter table public.profiles add column if not exists token_expires_at timestamptz;
alter table public.profiles add column if not exists last_token_refresh_at timestamptz;

create index if not exists idx_profiles_token_expires_at 
  on public.profiles(token_expires_at) 
  where provider_token is not null;

create or replace function public.token_needs_refresh(p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = p_user_id
      and provider_token is not null
      and (token_expires_at is null or token_expires_at < now() + interval '30 minutes')
  );
end;
$$;

create or replace function public.get_valid_token(p_user_id uuid)
returns text
language plpgsql
security definer
as $$
begin
  return (
    select provider_token from public.profiles
    where id = p_user_id
      and provider_token is not null
      and (token_expires_at is null or token_expires_at > now())
  );
end;
$$;

comment on column public.profiles.provider_token is 'GitHub OAuth access token (expires after 8 hours)';
comment on column public.profiles.token_expires_at is 'Token expiration timestamp';
comment on column public.profiles.last_token_refresh_at is 'Last time token was refreshed';
