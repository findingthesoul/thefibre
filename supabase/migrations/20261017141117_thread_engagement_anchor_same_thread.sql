-- A relative message is timed from an engagement on ITS OWN thread.
--
-- `thread_engagement.trigger_engagement_id` names the engagement a "relative"
-- message is timed from. It had only `references thread_engagement(id)`, so
-- any engagement id was accepted — another thread's, or another WORKSPACE's.
-- Found 2026-10-17 by the security builder while converting
-- routes/app-thread.ts to tenantDb: four write paths take the id from the
-- request body (two on /api/v1/apps/*, two on /api/v1/thread/*) and none
-- checked it, and the scheduler read the anchor's date with no workspace
-- filter. The effect was small (a caller who knew another workspace's
-- engagement UUID could time their OWN message from that session's date; no
-- title, link or content crossed), but it is a row pointing across the wall
-- between customers, which the database should not hold at all.
--
-- So the database refuses it, for every path at once, present and future:
-- the anchor must be an engagement of the same thread. Checked on INSERT and
-- on an UPDATE that CHANGES the anchor only, so a row that somehow already
-- holds a cross-thread anchor can still be edited in every other way (and
-- the scheduler ignores such an anchor, routes/thread.ts).
--
-- SECURITY DEFINER because the user routes write through RLS: an invoker
-- function would not see an anchor the caller's role cannot read and would
-- refuse for the wrong reason. It reads one column of one row and decides; it
-- is not reachable over REST (it returns `trigger`), and execute is revoked
-- from everyone regardless.

create or replace function public.thread_engagement_anchor_same_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anchor_thread uuid;
begin
  if new.trigger_engagement_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.trigger_engagement_id is not distinct from old.trigger_engagement_id
     and new.thread_id is not distinct from old.thread_id then
    return new;
  end if;

  select thread_id into v_anchor_thread
    from public.thread_engagement
   where id = new.trigger_engagement_id;

  if v_anchor_thread is distinct from new.thread_id then
    -- P0001 (the default), like every trigger here: lib/pg-error.ts passes a
    -- P0001's text through to the person as the sentence, and answers 409.
    raise exception
      'a message can only be timed from a session on its own thread — choose one of this thread''s sessions'
      using hint = 'trigger_engagement_id must name an engagement of the same thread';
  end if;
  return new;
end;
$$;

revoke all on function public.thread_engagement_anchor_same_thread() from public, anon, authenticated;

drop trigger if exists thread_engagement_anchor_same_thread on public.thread_engagement;
create trigger thread_engagement_anchor_same_thread
  before insert or update of trigger_engagement_id, thread_id on public.thread_engagement
  for each row execute function public.thread_engagement_anchor_same_thread();

comment on function public.thread_engagement_anchor_same_thread() is
  'Refuses a trigger_engagement_id that names an engagement of another thread (and so possibly another workspace). Fires on insert and when the anchor or thread changes.';

-- What exists today, for the record of this migration's run. A NOTICE, not a
-- failure: such rows keep working for every other edit, and the scheduler
-- no longer times anything from them.
do $$
declare
  v_other_thread integer;
  v_other_ws     integer;
begin
  select count(*) filter (where a.thread_id <> e.thread_id),
         count(*) filter (where a.workspace_id <> e.workspace_id)
    into v_other_thread, v_other_ws
    from public.thread_engagement e
    join public.thread_engagement a on a.id = e.trigger_engagement_id;
  raise notice 'thread_engagement anchors on another thread: %, of which in another workspace: %',
    v_other_thread, v_other_ws;
end;
$$;
