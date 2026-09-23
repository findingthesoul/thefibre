-- To do: nothing on this table is destroyed on a timer.
--
-- The first cut swept ticked items with a hard DELETE seven days after they
-- were done. Sjoerd, 2026-09-23, asked which he had meant by "cleaned after
-- 7 days": *"Should be part of the cleaning practice. So I would say: archive
-- - not delete... But there should be a delete discipline."*
--
-- So the timer files, it does not destroy. `archived_at` is the filing: the
-- row leaves the Archive view and stays in the table. And CLAUDE.md hard rule
-- 4 — soft delete only for personal data — applies to this table as much as
-- any other: a to-do's title is free text and its subject_label can carry
-- another person's name, so the person's own Remove becomes `deleted_at`
-- rather than a DELETE.
--
-- The "delete discipline" he asks for — somebody looking at what is old and
-- deciding, rather than a timer firing — is deliberately NOT built here.
-- Nothing in this migration prevents it; everything it would need to act on
-- is now still present to be acted on.

alter table public.user_task
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;

comment on column public.user_task.archived_at is
  'Filed out of the Archive view by the seven-day sweep. The row stays.';
comment on column public.user_task.deleted_at is
  'Soft delete (hard rule 4). Set when the person removes their own item.';

-- Every read filters on these two, always alongside user_id, which the RLS
-- policy already narrows to the signed-in person.
create index if not exists user_task_live_idx
  on public.user_task (user_id, state)
  where deleted_at is null and archived_at is null;

-- The upsert on (user_id, source_app, source_ref) has to be able to reach a
-- row that was soft-deleted or filed, and revive it — otherwise answering an
-- app's task again after removing the answer would hit the unique constraint
-- and fail. The route clears both columns on conflict; this comment is here
-- so the next person changing that constraint knows why.
