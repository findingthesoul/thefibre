-- A thread can be locked (Sjoerd, 2026-09-09).
--
-- Locking freezes the thread AS A DESIGN: its settings, timeline, tickets,
-- coupons, categories and co-organisers stop being editable, and it can't be
-- deleted. What PARTICIPANTS do keeps flowing — enrolments, payments,
-- check-in, certificates and the message scheduler all ignore the lock. A
-- locked thread that has run can still be marked completed or archived; the
-- status pill is lifecycle, not design.
--
-- The lock is a guard against an accident, not a permission level: whoever
-- may edit the thread may unlock it again. `locked_by` records who set it so
-- the UI can say whose lock it is.
alter table thread_thread
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references public."user"(id) on delete set null;

comment on column thread_thread.locked_at is
  'When set, the thread is frozen as a design: no edits to it or its timeline, tickets, coupons, categories or co-organisers, and no delete. Participant activity is unaffected.';
comment on column thread_thread.locked_by is
  'Who locked it. Null when the thread is unlocked.';
