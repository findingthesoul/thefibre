-- "Price includes VAT" for Thread tickets and Meet meeting types — the same
-- switch Members has had since v1.231.0 (plan approved by the coordinator,
-- 2026-10-16). Default FALSE: every existing price stays EXCL. VAT
-- ("Everything excl. VAT now"), so nothing changes for any ticket, meeting
-- type or booking until a row is switched on.
--
-- When TRUE (and only for a VAT-registered seller — in Thread and Meet that
-- is the organiser or host first, then the team or workspace), the entered
-- price is what a buyer at the home rate pays; the server derives the net
-- once (netFromInclusive) and charges through the one excl. pipeline.
--
-- Not on thread_thread.price_cents: that legacy price has no editor in
-- Thread; a thread without tickets keeps today's excl. meaning.
--
-- Migration only; no code reads these until the next release.

alter table public.thread_ticket
  add column if not exists price_includes_vat boolean not null default false;

alter table public.meet_meeting_type
  add column if not exists price_includes_vat boolean not null default false;
