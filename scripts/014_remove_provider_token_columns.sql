-- GitHub tokens are now stored in httpOnly session cookies, not the database.
-- This migration removes the token storage columns that were added in 003.
-- All clauses use IF EXISTS so this is safe to run on both old and new installs.

drop index if exists public.idx_profiles_token_expires_at;

drop function if exists public.token_needs_refresh(uuid);
drop function if exists public.get_valid_token(uuid);

alter table public.profiles
  drop column if exists provider_token,
  drop column if exists token_expires_at,
  drop column if exists last_token_refresh_at;
