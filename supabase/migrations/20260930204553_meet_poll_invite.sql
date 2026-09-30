-- Who was asked to a poll.
--
-- Sjoerd, 2026-09-30: invite people to a meeting poll, picked with the same
-- search-or-add field Connections uses, with a message and an email that goes
-- out on its own.
--
-- The row is worth keeping after the mail is sent, and that is the point of a
-- table rather than a fire-and-forget send. A poll's real question is not
-- "who voted" but "who have I heard from" — and silence only means something
-- once you know who was asked. The votes matrix can show invited-and-waiting
-- next to voted, which is the difference between a poll you can close and one
-- you are still waiting on.
--
-- `person_id` is nullable on purpose: you can invite an email address that
-- belongs to nobody in the workspace yet, exactly as the booking page accepts
-- a stranger. When a person IS picked, the link is kept, so the invite shows
-- up against that contact.

create table if not exists public.meet_poll_invite (
  id                uuid primary key default gen_random_uuid(),
  meeting_type_id   uuid not null references public.meet_meeting_type(id) on delete cascade,
  workspace_id      uuid not null references public.workspace(id) on delete cascade,
  person_id         uuid references public.person(id),
  email             citext not null,
  name              text not null,
  /** What the host wrote in the invitation, kept so a resend says the same. */
  message           text,
  invited_by_user_id uuid references public."user"(id),
  invited_at        timestamptz not null default now(),
  -- Inviting the same person twice is a re-send, not a second invitation.
  unique (meeting_type_id, email)
);

comment on table public.meet_poll_invite is
  'People the host asked to a meeting poll. Kept after sending so the votes matrix can tell "has not answered" from "was never asked".';

alter table public.meet_poll_invite enable row level security;

-- Visible and mutable if you can see the meeting type it belongs to — the
-- same shape as meet_poll_slot and meet_poll_vote next door. The meeting
-- type's own policy is what actually decides, so this table cannot drift away
-- from the thing it hangs off.
create policy meet_poll_invite_select on public.meet_poll_invite
  for select using (
    exists (
      select 1 from public.meet_meeting_type mt
      where mt.id = meet_poll_invite.meeting_type_id
    )
  );

create policy meet_poll_invite_write on public.meet_poll_invite
  for all using (
    exists (
      select 1 from public.meet_meeting_type mt
      where mt.id = meet_poll_invite.meeting_type_id
    )
  )
  with check (
    exists (
      select 1 from public.meet_meeting_type mt
      where mt.id = meet_poll_invite.meeting_type_id
    )
  );

create index if not exists meet_poll_invite_mt_idx
  on public.meet_poll_invite (meeting_type_id);
