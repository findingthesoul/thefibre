-- member_notification: a fourth kind, 'session_added'.
--
-- Until now a NEW session on a thread reached its participants only as the
-- calendar invitation from the organiser's SEND, and reached nobody's bell;
-- a move or a cancellation reached both (Sjoerd, 2026-10-16: "yes build it",
-- on the gap report "participants hear about every change"). The new kind
-- rides the same SEND as the other two — nothing here watches the edit.
--
-- The check is replaced by NAME looked up from the catalogue rather than
-- assumed: the original was an inline `check (kind in (...))`, whose name
-- Postgres chose. Exactly one check on `kind` is expected; anything else
-- stops the migration instead of leaving two checks or none.

do $$
declare
  found text[];
begin
  select array_agg(c.conname) into found
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'member_notification'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%kind%';
  if coalesce(array_length(found, 1), 0) <> 1 then
    raise exception 'expected one kind check on member_notification, found %', found;
  end if;
  execute format('alter table public.member_notification drop constraint %I', found[1]);
end $$;

alter table public.member_notification
  add constraint member_notification_kind_check
  check (kind in ('new_thread', 'session_added', 'session_moved', 'session_cancelled'));
