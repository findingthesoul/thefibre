-- ============================================================================
-- Fix the hygiene finding uniqueness so an upsert can actually name it.
--
-- 20260913000000 built the index over an EXPRESSION:
--
--   coalesce(related_id, '00000000-...'::uuid)
--
-- which is correct SQL and unusable from the API. PostgREST's `on_conflict`
-- takes a COLUMN LIST, not an expression, so every upsert failed with "there
-- is no unique or exclusion constraint matching the ON CONFLICT
-- specification" and the sweep recorded nothing at all. Found by running the
-- real sweep against staging rather than by reading it — the migration
-- applied cleanly and the code typechecked, and it was still completely
-- broken.
--
-- The reason for the coalesce was real: a plain unique index treats NULLs as
-- distinct, so two findings with no `related_id` would both be inserted and
-- the sweep would pile up copies of the same proposal every night.
--
-- `NULLS NOT DISTINCT` (Postgres 15+) gets both: a plain column list the API
-- can name, and NULLs that collide with each other.
-- ============================================================================

drop index if exists public.hygiene_finding_uniq;

create unique index hygiene_finding_uniq
  on public.hygiene_finding (workspace_id, kind, subject_id, related_id)
  nulls not distinct;
