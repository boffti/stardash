-- Migration 017: extended AI guardrails
-- • Daily sublimit columns for brief and intel
-- • Weekly + daily limit columns for AI search (Discover)
-- • 24-hour cooldown column for personalized search

ALTER TABLE profiles
  -- Daily sublimits for contribution briefs
  ADD COLUMN IF NOT EXISTS ai_brief_day_start   timestamptz,
  ADD COLUMN IF NOT EXISTS ai_brief_day_count   integer NOT NULL DEFAULT 0,

  -- Daily sublimits for repo intel
  ADD COLUMN IF NOT EXISTS ai_intel_day_start   timestamptz,
  ADD COLUMN IF NOT EXISTS ai_intel_day_count   integer NOT NULL DEFAULT 0,

  -- Weekly + daily limits for AI Discover search (new feature)
  ADD COLUMN IF NOT EXISTS ai_search_week_start timestamptz,
  ADD COLUMN IF NOT EXISTS ai_search_count      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_search_day_start  timestamptz,
  ADD COLUMN IF NOT EXISTS ai_search_day_count  integer NOT NULL DEFAULT 0,

  -- 24-hour cooldown for personalized search recommendations
  ADD COLUMN IF NOT EXISTS last_personalized_search_at timestamptz;
