-- Add context_hash column to discover_searches for interest-aware cache invalidation.
-- NULL on existing rows — they will be treated as stale on next cache lookup and re-run.
-- (Applied to remote via MCP on 2026-05-21; file recreated from the migration history table.)
ALTER TABLE public.discover_searches
  ADD COLUMN IF NOT EXISTS context_hash text;

-- Index for fast lookup by (user_id, normalized_query, search_version, context_hash)
CREATE INDEX IF NOT EXISTS discover_searches_context_hash_idx
  ON public.discover_searches (user_id, normalized_query, search_version, context_hash)
  WHERE context_hash IS NOT NULL;
