-- Migration 013: guardrails — input limits and rate limit columns
-- Adds last_contribution_scan_at to profiles for rate limiting.
-- Adds CHECK constraints on tags.label, collections.name, user_starred_repos.notes
-- as a DB-level backstop for app-level validation.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_contribution_scan_at TIMESTAMPTZ;

ALTER TABLE tags
  ADD CONSTRAINT tags_label_length_check
  CHECK (char_length(label) <= 50);

ALTER TABLE collections
  ADD CONSTRAINT collections_name_length_check
  CHECK (char_length(name) <= 50);

ALTER TABLE user_starred_repos
  ADD CONSTRAINT user_starred_repos_notes_length_check
  CHECK (notes IS NULL OR char_length(notes) <= 5000);
