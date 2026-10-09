-- A person chooses whether their public page exists.
--
-- Sjoerd, 2026-10-08, after reading what the public organiser page does
-- today: it publishes a person's name, bio and photo at
-- app.thethread.app/{slug} without that person ever having chosen to have a
-- page. Nobody opted in. For most of them nobody even asked — see
-- `routes/app-thread.ts`, which CREATES an organiser row, with a slug, the
-- first time an external app publishes a thread for their workspace. The
-- page is a side effect of somebody else's API call.
--
-- ---------------------------------------------------------------------------
-- NULLABLE, and no default. That is the whole grandfathering.
-- ---------------------------------------------------------------------------
-- Three states, and the third is the one that makes this safe to ship:
--
--   true   — they said yes.
--   false  — they said no, or the row is new (the API inserts false).
--   NULL   — the row predates the question. Treated as PUBLISHED, because it
--            is published right now and taking somebody's page down without
--            telling them is its own kind of harm.
--
-- So nothing changes on the day this lands: every page that works today
-- keeps working. There is no window in which real pages 404, which a
-- `default false` would have created between the migration and any backfill.
--
-- And there is no bulk write at all. NULL doubles as "not yet told": the
-- person is shown the notice the next time they open their settings — your
-- page is public, here is the switch — and their answer replaces the NULL.
-- Consent collected one person at a time, by asking, rather than a script
-- deciding on their behalf.
--
-- ---------------------------------------------------------------------------
-- What it does NOT control
-- ---------------------------------------------------------------------------
-- Thread pages. `resolvePublicOwner` is shared by /{slug} and every
-- /{slug}/{threadSlug} beneath it, so gating the resolver would 404 every
-- enrolment link an organiser has ever sent. The gate is on the organiser
-- PAGE route alone: switching your page off does not unpublish your events,
-- and a thread page still names the person running it, because running a
-- public event in your own name is a thing you already chose.
alter table public.thread_organiser
  add column if not exists is_published boolean;

comment on column public.thread_organiser.is_published is
  'Does this person want a public page at /{slug}? true = yes, false = no (and the default for rows created from 2026-10-08), NULL = the row predates the question and is grandfathered as published until they are asked. Read by the public organiser page only — thread pages under the same slug are never gated by it.';
