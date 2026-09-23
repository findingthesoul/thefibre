-- A to-do can point at where the work actually is.
--
-- Sjoerd, 2026-09-23: *"Add link to do (for worklists in other tools like
-- google docs)."*
--
-- The Thread does not try to be the place every piece of work lives. A
-- rehearsal schedule is a Google Doc, a floor plan is a PDF, a budget is a
-- spreadsheet somewhere — the checklist's job is to say what has to happen
-- and to get you to the thing, not to swallow it. So: one link per to-do,
-- beside the title, and nothing else about the other tool is stored here.
--
-- A URL, not rich text and not a file. `http(s)` only, enforced in the API
-- (lib/safe-url.ts) rather than by a CHECK, because the rule is "what is
-- safe to put in an href" and that belongs with the other sanitising — a
-- `javascript:` href stored here would be the same stored-XSS shape the
-- rich-text sanitiser exists for, arriving through a field nobody thinks of
-- as content.
--
-- Templates carry it too, inside `thread_template.structure.tasks[].link`,
-- which needs no migration — that column is jsonb.

alter table public.thread_task
  add column if not exists link_url text;

comment on column public.thread_task.link_url is
  'Where the work actually is — a Google Doc, a sheet, a PDF. http(s) only, validated in the API (lib/safe-url.ts). See 20260923171422.';
