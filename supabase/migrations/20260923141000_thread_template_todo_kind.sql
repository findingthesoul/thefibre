-- ============================================================================
-- Templates get a third group: to-do lists.
--
-- Sjoerd, 2026-09-23: *"people can insert a to do template. So templates
-- needs a third group: to do's, with a list."*
--
-- Two kinds of template existed — a certificate design
-- (thread_certificate_template) and a whole thread (thread_template). The
-- third is a named list of to-dos you lay onto a thread, the way a thread
-- template lays on engagements.
--
-- WHY A COLUMN AND NOT A TABLE
-- ---------------------------------------------------------------------------
-- A to-do template is a title, an owner, a scope and a jsonb body — which is
-- thread_template exactly. A second table would have meant a second copy of
-- the scoping (personal | team | workspace), the sharing, the ownership
-- columns and every route that reads them, and the copy that drifted would be
-- whichever one nobody was looking at. So: one `kind` column, and the rows
-- that were there are what they always were.
--
-- `thread_template_share` already keys grants by (template_kind, template_id)
-- and is the reason that check constraint exists at all; it gains 'todo' so a
-- to-do list can be shared with a person or a team like anything else.
--
-- SHAPE OF `structure` FOR kind = 'todo'
-- ---------------------------------------------------------------------------
--   { "version": 1,
--     "tasks": [ { "title": "Book the room",
--                  "notes": null,
--                  "day_offset": -14,   -- days from the thread's start; null = no date
--                  "position": 0 } ] }
--
-- day_offset, not a date: a template is reusable, so its items are relative
-- to the thread they are laid onto — the same choice the engagement templates
-- made, and rebased by the same arithmetic.
-- ============================================================================

-- READ THIS BEFORE ADDING A FOURTH KIND (comment added after the fact, once
-- the mistake below had actually been made):
--
-- Adding a discriminator to a table that already has queries means every one
-- of those queries acquires an IMPLICIT filter it does not state. Five
-- `thread_template` queries in routes/thread.ts had been correct by accident
-- since 2026-07-02 — there was only one kind — and stopped being correct the
-- instant this column existed. Nothing failed: a to-do checklist simply
-- appeared in the New-thread template picker and laid down zero engagements,
-- which reads as a template that is merely empty.
--
-- All five now say `.eq('kind', 'thread')`. A fourth kind must walk every
-- query on this table again; the column cannot do it for you.
alter table public.thread_template
  add column if not exists kind text not null default 'thread'
    check (kind in ('thread', 'todo'));

comment on column public.thread_template.kind is
  'thread = a whole thread to create from; todo = a named list of to-dos to lay onto one. See 20260923141000.';

-- Every existing row is a thread template; the default has already said so.
create index if not exists thread_template_kind_idx
  on public.thread_template (workspace_id, kind);

-- Grants: a to-do list is shareable like the other two kinds.
alter table public.thread_template_share
  drop constraint if exists thread_template_share_template_kind_check;

alter table public.thread_template_share
  add constraint thread_template_share_template_kind_check
    check (template_kind in ('certificate', 'thread', 'todo'));
