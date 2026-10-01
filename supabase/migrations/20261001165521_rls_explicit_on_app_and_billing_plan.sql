-- ============================================================================
-- Row level security, said out loud, on the two tables that never said it.
--
-- Hard rule 3 is "RLS on every table". 139 of the 141 tables in public carry
-- an explicit `enable row level security` in the migration that created them.
-- `app` (phase 0) and `billing_plan` (20260519100000) do not. Both ARE
-- protected on the two live databases — an anonymous client reads zero rows
-- from either, probed on staging and production on 2026-10-01 — because the
-- projects were created with Supabase switching it on for new public tables.
-- That is a property of those two projects, not of this repository: a
-- database rebuilt from these migrations alone (a third stack, a restore into
-- a fresh project, a local Postgres) would have left both tables open to
-- anyone holding the anon key, which ships in every browser.
--
-- So this is a NO-OP on staging and on production, and the whole of the
-- protection on a database that does not exist yet.
--
--   app           read policies exist (app_read_visible, 20260822120000);
--                 writes go through the API as service role.
--   billing_plan  no policy on purpose: only the API reads it (lib/plan.ts,
--                 the public catalogue route) and only /admin/plans writes
--                 it, both as service role. RLS on with no policy = service
--                 role only, which is what it has been all along.
--
-- apps/api/src/lib/rls-declared.test.ts now refuses a table that does not say
-- it, so this cannot come back.
-- ============================================================================

alter table public.app enable row level security;
alter table public.billing_plan enable row level security;
