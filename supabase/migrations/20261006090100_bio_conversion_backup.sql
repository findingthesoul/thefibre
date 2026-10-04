-- Where a bio was before the conversion rewrote it.
--
-- The bio is moving from plain text to rich text (docs/bio-rich-text-conversion.md).
-- Step D shipped first, so a bio converts when its owner next saves; this table
-- is for steps B and C, the bulk pass that reaches everyone else.
--
-- A table rather than four backup columns, because the value lives in four
-- places (identity_profile, user_profile, thread_organiser, meet_host) and
-- four schema changes would each need undoing. A row is written BEFORE the
-- update that it backs up, so a conversion that dies halfway leaves a
-- complete record of everything it had already touched.
--
-- Renumbered from 20261004070749 on 2026-10-06. It was written while this
-- branch was parked and never applied anywhere, and by the time it came up
-- three later migrations had already landed on staging and production. A
-- plain `supabase db push` refuses a file dated before the remote's newest,
-- so an unapplied migration that sits still goes stale: its NUMBER is a claim
-- about when it runs, and waiting makes that claim false.
--
-- TRANSITIONAL: it exists to be read if the conversion was wrong, and to be
-- dropped with `bio-html.ts` at step E. If you are reading this long after
-- that, it has outlived its reason.

create table if not exists public.bio_conversion_backup (
  id           bigserial primary key,
  -- Which table the bio came from, and the key that finds it again. Text
  -- because the four tables key on different things: identity_profile on
  -- email, user_profile on user_id, the other two on id.
  source_table text        not null,
  row_key      text        not null,
  bio_before   text,
  converted_at timestamptz not null default now()
);

create index if not exists bio_conversion_backup_source_idx
  on public.bio_conversion_backup (source_table, row_key);

-- Nobody reads this through the API. It holds other people's bios, so it is
-- service-role only: RLS on, and no policy at all (brief §13 — a table born
-- closed, like every definer function since 2026-09-14).
alter table public.bio_conversion_backup enable row level security;

comment on table public.bio_conversion_backup is
  'Pre-conversion bios (plain text -> HTML). Service-role only. Dropped at step E; see docs/bio-rich-text-conversion.md.';
