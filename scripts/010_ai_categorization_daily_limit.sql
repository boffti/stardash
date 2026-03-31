alter table public.profiles
  add column if not exists last_ai_categorization_at timestamptz;
