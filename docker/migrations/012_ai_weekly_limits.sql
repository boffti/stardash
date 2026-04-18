-- Weekly limit tracking for contribution brief (10/week per user)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_brief_week_start  timestamptz,
  ADD COLUMN IF NOT EXISTS ai_brief_count        integer NOT NULL DEFAULT 0,
  -- Weekly limit tracking for repo intel (10/week per user)
  ADD COLUMN IF NOT EXISTS ai_intel_week_start  timestamptz,
  ADD COLUMN IF NOT EXISTS ai_intel_count        integer NOT NULL DEFAULT 0;
