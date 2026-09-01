-- ============================================================================
-- The enrolment emails move INTO the thread.
--
-- Sjoerd, 2026-09-01: "Enrolment emails — should that not be part of a thread?
-- With a default text that can be altered?" Yes, and the thread already had
-- everything needed: messages that fire on enrolment and on approval, token
-- substitution, per-person dedup, five languages, an editor people already
-- know. The platform was sending its own email past all of it, and last night
-- I bolted an editable NOTE onto that email — a paragraph inserted into
-- something you could not see. This is the better shape: the email IS a
-- message in the timeline, seeded with the default text, editable like any
-- other.
--
-- THE FREEZE, AND THE EXEMPTION.
-- 20260829140000 made a sent message immutable, because two people receiving
-- different words under one title is a lie the system tells for you. A ticket
-- email meets that rule on the first enrolment and would be frozen with any
-- typo in it for the life of the thread.
--
-- Sjoerd chose the exemption (2026-09-01), and the reasoning holds: the
-- transactional emails are not a broadcast whose sameness is a promise —
-- each one is addressed to the person who just enrolled, and the next person
-- has not enrolled yet. The editor says so out loud: changes reach whoever
-- enrols from now on, and nobody who already did.
--
-- Deleting one stays allowed: with no system message, the send falls back to
-- the platform's compiled email, so nobody loses their ticket by tidying up.
-- ============================================================================

alter table public.thread_engagement
  add column if not exists system_role text
    check (system_role in ('enrolment_received', 'enrolment_confirmed'));

comment on column public.thread_engagement.system_role is
  'Marks a message the platform sends on the organiser''s behalf. enrolment_confirmed carries the ticket — the QR is attached by the sender, never by the text, so it cannot be edited away by accident. Null for every ordinary message.';

-- One of each per thread. A partial unique index, since ordinary messages all
-- carry null and null is not equal to null.
create unique index if not exists thread_engagement_system_role_uniq
  on public.thread_engagement (thread_id, system_role)
  where system_role is not null;

-- "Somebody applied" — the moment an approval-gated thread receives a request.
-- The trigger vocabulary had on_enrolment and on_approval; the application
-- itself had no name, which is why that email could only ever be the
-- platform's.
alter table public.thread_engagement
  drop constraint if exists thread_engagement_trigger_kind_check;
alter table public.thread_engagement
  add constraint thread_engagement_trigger_kind_check
  check (trigger_kind in ('fixed','on_enrolment','on_approval','on_completion','relative','on_application'));

-- The freeze skips the system messages. Everything else about it stands.
create or replace function public.thread_engagement_frozen_once_sent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_sent  integer;
begin
  if tg_op = 'DELETE' then
    v_id := old.id;
  else
    v_id := new.id;
  end if;

  -- Transactional messages are exempt (20260901180000). They are addressed to
  -- one person at the moment they enrol, not broadcast to a cohort, so editing
  -- the wording changes what the NEXT person receives and nothing that already
  -- happened. The editor states that plainly.
  if tg_op <> 'DELETE' and new.system_role is not null then
    return new;
  end if;
  if tg_op = 'DELETE' and old.system_role is not null then
    return old;
  end if;

  select count(*) into v_sent
    from public.thread_message_send
   where engagement_id = v_id;

  if v_sent = 0 then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'DELETE' then
    raise exception
      'this message has already been sent to % people and cannot be deleted — deleting it would drop the record of who received it, and re-creating it would send to them again',
      v_sent
      using errcode = 'raise_exception';
  end if;

  if new.title       is distinct from old.title
     or new.description is distinct from old.description
     or new.content     is distinct from old.content then
    raise exception
      'this message has already been sent to % people and its wording cannot be changed — anyone enrolling later would receive different words under the same title. Write a new message instead.',
      v_sent
      using errcode = 'raise_exception';
  end if;

  return new;
end;
$$;
