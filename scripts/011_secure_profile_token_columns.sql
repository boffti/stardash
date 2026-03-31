revoke select (provider_token, token_expires_at, last_token_refresh_at)
on public.profiles
from anon, authenticated;

revoke update (provider_token, token_expires_at, last_token_refresh_at)
on public.profiles
from anon, authenticated;
