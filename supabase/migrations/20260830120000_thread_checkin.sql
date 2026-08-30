-- Check-in (Sjoerd 2026-08-30): every registration carries a door code. The
-- confirmation email renders it as a QR (and as a wallet pass where the
-- issuer credentials are configured); scanning it opens The Thread's
-- check-in page for that person; a door list with search covers everyone
-- who didn't bring the email.
--
-- The code is a capability: unguessable, per-enrolment, and it only ever
-- OPENS the check-in page — checking in requires a signed-in organiser.
-- 32 hex chars from gen_random_uuid (volatile default → evaluated per row,
-- so the backfill gives every existing enrolment its own code).
alter table public.thread_enrolment
  add column checkin_code text not null default replace(gen_random_uuid()::text, '-', ''),
  add column checked_in_at timestamptz,
  add column checked_in_by uuid references public."user"(id);

create unique index thread_enrolment_checkin_code_key
  on public.thread_enrolment (checkin_code);
