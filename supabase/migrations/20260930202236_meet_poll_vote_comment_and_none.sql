-- "None of these work for me", and a place to say why.
--
-- Sjoerd, 2026-09-30: "Graag ook nog een knopje: ik kan geen van deze en een
-- commentaar veld." A poll that only accepts ticks can only hear from people
-- who can make it. Everyone else closes the tab, and the host sees silence —
-- indistinguishable from not having been asked.
--
-- TWO CHANGES, and the shape of the first is the careful one:
--
-- `slot_starts_at` becomes NULLABLE. A "none of these" vote is a real vote
-- about the poll, not about a slot, so it is one row with no slot — rather
-- than a magic timestamp, or a separate table that every reader would have to
-- remember to consult. The unique constraint keeps working: (meeting_type_id,
-- voter_email, NULL) does not collide in Postgres, so a partial unique index
-- carries that half explicitly.
--
-- A comment belongs to the VOTER, not to a slot: "I can do Tuesdays after
-- three" is one sentence about the whole poll. So it is written onto every
-- row that voter has, and read from any of them.

alter table public.meet_poll_vote
  alter column slot_starts_at drop not null;

alter table public.meet_poll_vote
  add column if not exists comment text;

-- One "none of these" per voter per poll. The table's own unique constraint
-- cannot express this: in SQL, NULL is not equal to NULL, so two such rows
-- would both be allowed.
create unique index if not exists meet_poll_vote_none_unique
  on public.meet_poll_vote (meeting_type_id, voter_email)
  where slot_starts_at is null;

comment on column public.meet_poll_vote.slot_starts_at is
  'The candidate slot this voter can attend. NULL = they answered "none of these work for me" — a vote about the poll rather than about a slot.';
comment on column public.meet_poll_vote.comment is
  'Free text from the voter about the poll as a whole. Repeated on each of that voter''s rows; read from any one of them.';
