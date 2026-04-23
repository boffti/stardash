-- Migration 019: atomic AI limit check-and-increment
--
-- Replaces the TS-side read-then-update pattern with a single PL/pgSQL function
-- that acquires a row-level lock (SELECT … FOR UPDATE) before checking and
-- incrementing counters, eliminating the TOCTOU race where concurrent requests
-- from the same user could both bypass the weekly/daily quota.
--
-- Called via: supabase.rpc('check_and_increment_ai_limit', { … })

CREATE OR REPLACE FUNCTION check_and_increment_ai_limit(
  p_user_id      uuid,
  p_feature      text,         -- 'brief' | 'intel' | 'search'
  p_weekly_limit int,
  p_daily_limit  int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec             profiles%ROWTYPE;
  v_now             timestamptz := now();
  v_week_interval   interval    := '7 days';
  v_day_interval    interval    := '1 day';

  v_week_start      timestamptz;
  v_week_count      int;
  v_day_start       timestamptz;
  v_day_count       int;

  v_is_new_week     bool;
  v_is_new_day      bool;
  v_cur_week_count  int;
  v_cur_week_start  timestamptz;
  v_cur_day_count   int;
  v_cur_day_start   timestamptz;
BEGIN
  -- Lock the profile row so concurrent calls for the same user are serialized.
  SELECT * INTO v_rec FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'profile_not_found');
  END IF;

  -- Extract feature-specific column values.
  CASE p_feature
    WHEN 'brief' THEN
      v_week_start := v_rec.ai_brief_week_start;
      v_week_count := COALESCE(v_rec.ai_brief_count, 0);
      v_day_start  := v_rec.ai_brief_day_start;
      v_day_count  := COALESCE(v_rec.ai_brief_day_count, 0);
    WHEN 'intel' THEN
      v_week_start := v_rec.ai_intel_week_start;
      v_week_count := COALESCE(v_rec.ai_intel_count, 0);
      v_day_start  := v_rec.ai_intel_day_start;
      v_day_count  := COALESCE(v_rec.ai_intel_day_count, 0);
    WHEN 'search' THEN
      v_week_start := v_rec.ai_search_week_start;
      v_week_count := COALESCE(v_rec.ai_search_count, 0);
      v_day_start  := v_rec.ai_search_day_start;
      v_day_count  := COALESCE(v_rec.ai_search_day_count, 0);
    ELSE
      RETURN jsonb_build_object('allowed', false, 'error', 'unknown_feature');
  END CASE;

  -- Weekly window check.
  v_is_new_week    := v_week_start IS NULL OR (v_now - v_week_start) >= v_week_interval;
  v_cur_week_count := CASE WHEN v_is_new_week THEN 0 ELSE v_week_count END;
  v_cur_week_start := CASE WHEN v_is_new_week THEN v_now  ELSE v_week_start END;

  IF v_cur_week_count >= p_weekly_limit THEN
    RETURN jsonb_build_object(
      'allowed',      false,
      'remaining',    0,
      'nextAllowedAt', (v_week_start + v_week_interval)::text,
      'limitType',    'weekly'
    );
  END IF;

  -- Daily window check (optional).
  v_cur_day_count := 0;
  v_cur_day_start := v_now;

  IF p_daily_limit IS NOT NULL THEN
    v_is_new_day    := v_day_start IS NULL OR (v_now - v_day_start) >= v_day_interval;
    v_cur_day_count := CASE WHEN v_is_new_day THEN 0 ELSE v_day_count END;
    v_cur_day_start := CASE WHEN v_is_new_day THEN v_now ELSE v_day_start END;

    IF v_cur_day_count >= p_daily_limit THEN
      RETURN jsonb_build_object(
        'allowed',      false,
        'remaining',    0,
        'nextAllowedAt', (v_day_start + v_day_interval)::text,
        'limitType',    'daily'
      );
    END IF;
  END IF;

  -- Persist incremented counters (within the same locked transaction).
  CASE p_feature
    WHEN 'brief' THEN
      UPDATE profiles SET
        ai_brief_week_start = v_cur_week_start,
        ai_brief_count      = v_cur_week_count + 1,
        ai_brief_day_start  = CASE WHEN p_daily_limit IS NOT NULL THEN v_cur_day_start ELSE ai_brief_day_start END,
        ai_brief_day_count  = CASE WHEN p_daily_limit IS NOT NULL THEN v_cur_day_count + 1 ELSE ai_brief_day_count END
      WHERE id = p_user_id;
    WHEN 'intel' THEN
      UPDATE profiles SET
        ai_intel_week_start = v_cur_week_start,
        ai_intel_count      = v_cur_week_count + 1,
        ai_intel_day_start  = CASE WHEN p_daily_limit IS NOT NULL THEN v_cur_day_start ELSE ai_intel_day_start END,
        ai_intel_day_count  = CASE WHEN p_daily_limit IS NOT NULL THEN v_cur_day_count + 1 ELSE ai_intel_day_count END
      WHERE id = p_user_id;
    WHEN 'search' THEN
      UPDATE profiles SET
        ai_search_week_start = v_cur_week_start,
        ai_search_count      = v_cur_week_count + 1,
        ai_search_day_start  = CASE WHEN p_daily_limit IS NOT NULL THEN v_cur_day_start ELSE ai_search_day_start END,
        ai_search_day_count  = CASE WHEN p_daily_limit IS NOT NULL THEN v_cur_day_count + 1 ELSE ai_search_day_count END
      WHERE id = p_user_id;
  END CASE;

  RETURN jsonb_build_object(
    'allowed',      true,
    'remaining',    LEAST(
      p_weekly_limit - (v_cur_week_count + 1),
      CASE WHEN p_daily_limit IS NOT NULL
           THEN p_daily_limit - (v_cur_day_count + 1)
           ELSE p_weekly_limit
      END
    ),
    'nextAllowedAt', null
  );
END;
$$;
