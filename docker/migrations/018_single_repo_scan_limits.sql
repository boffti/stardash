-- Migration 018: daily cap for single-repo contribution scans
-- Adds two columns to profiles so the server can enforce a per-user daily
-- limit on single-repo contribution-opportunity scans independently of the
-- 5-minute broad-scan cooldown that only covers multi-repo scans.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS single_repo_scan_day_start  timestamptz,
  ADD COLUMN IF NOT EXISTS single_repo_scan_day_count  integer NOT NULL DEFAULT 0;
