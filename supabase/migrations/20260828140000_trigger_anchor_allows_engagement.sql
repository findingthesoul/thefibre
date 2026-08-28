-- Event-anchored message triggers (20260702190000) added
-- thread_engagement.trigger_engagement_id, and every reader since — the
-- scheduler, the timeline, the public payload — understands
-- trigger_anchor = 'engagement'. The CHECK constraint added a day earlier
-- never learned about it, so "Relative to a date or event" anchored to an
-- activity has always failed the insert:
--   new row for relation "thread_engagement" violates check constraint
--   "thread_engagement_trigger_anchor_check"
--
-- Drop by shape, not by name: the original was an inline column check, so
-- its name is whatever Postgres generated.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'thread_engagement'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%trigger_anchor%'
  loop
    execute format('alter table public.thread_engagement drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.thread_engagement
  add constraint thread_engagement_trigger_anchor_check
    check (trigger_anchor is null
           or trigger_anchor in ('start','end','engagement'));
