-- You could only ever have ONE to-do you typed yourself.
--
-- `user_task_source_uniq` was declared UNIQUE NULLS NOT DISTINCT over
-- (user_id, source_app, source_ref). It exists so that answering an app's task
-- twice is one row. But a to-do you TYPE has no source: both columns are null,
-- and NULLS NOT DISTINCT means null equals null — so the second one you typed
-- collided with the first and the insert was refused.
--
-- It hid for a day because every walkthrough added one item and then removed
-- it, and Remove was a hard DELETE, which freed the slot each time. Making
-- Remove a soft delete (20260923083000) turned a latent bug into a visible
-- one: the row stays, so the slot stays taken.
--
-- The uniqueness only ever meant anything for rows that HAVE a source, so the
-- constraint becomes a partial unique index that says exactly that. Typed
-- rows are now unconstrained, which is what a list is.
--
-- Note for whoever touches the answer route: a partial index cannot be named
-- by a bare ON CONFLICT, so that route no longer uses an upsert. It updates,
-- and inserts when nothing was updated.

alter table public.user_task
  drop constraint if exists user_task_source_uniq;

create unique index if not exists user_task_source_uniq
  on public.user_task (user_id, source_app, source_ref)
  where source_app is not null;
