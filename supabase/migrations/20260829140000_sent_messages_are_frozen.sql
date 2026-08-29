-- ============================================================================
-- A message that has been sent cannot be altered.
--
-- Sjoerd, 2026-08-29, in as many words — and the reason he gave is the whole
-- argument: a message sends to whoever is enrolled at the time, and the
-- scheduler keeps sending it to people who enrol later (dedup is per
-- (engagement_id, person_id), so a later registrant is a fresh send). Edit the
-- text after the first send and two people receive different words under one
-- title, with nothing recording that they differ.
--
-- THIS IS NOT AN APP-SURFACE RULE. The hole is in The Thread's own editor:
-- PATCH /thread/engagements/:id and DELETE have no such guard today, so a human
-- can do exactly this right now. Putting the check only on the app surface
-- would leave the actual bug in place and make the app stricter than the people.
-- So it goes in the database, once, and both surfaces obey it.
--
-- WHAT IS FROZEN: title, description, content — what a recipient receives.
--
-- WHAT IS NOT: status, position, show_in_agenda and the trigger/timing columns.
-- You must still be able to STOP a message going to future registrants
-- (status -> draft), reorder a timeline, or re-time what has not gone yet.
-- Freezing those would make "sent to one person" mean "this thread can no
-- longer be managed", which is not what was asked for.
--
-- DELETE is refused outright. thread_message_send.engagement_id cascades
-- (20260701090000:224), so deleting a sent message takes the dedup log with it
-- — and a planner that re-creates it from its own copy would then send to
-- everyone a second time.
--
-- The sender only READS engagements (sendTriggeredMessages /
-- runThreadMessageScheduler), so nothing here can block a send in progress.
-- ============================================================================

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

drop trigger if exists thread_engagement_frozen_upd on public.thread_engagement;
create trigger thread_engagement_frozen_upd
  before update on public.thread_engagement
  for each row execute function public.thread_engagement_frozen_once_sent();

drop trigger if exists thread_engagement_frozen_del on public.thread_engagement;
create trigger thread_engagement_frozen_del
  before delete on public.thread_engagement
  for each row execute function public.thread_engagement_frozen_once_sent();

comment on function public.thread_engagement_frozen_once_sent() is
  'Once any thread_message_send row exists for an engagement, its title/description/content are immutable and it cannot be deleted. status, position, show_in_agenda and the trigger columns stay editable so a message can still be stopped or re-timed. Applies to The Thread''s editor and the app surface alike.';
