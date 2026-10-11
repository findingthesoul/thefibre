-- organiser_org_page_listing
--
-- Does this person want to be listed on their organisation's public page?
--
-- A DIFFERENT QUESTION from `is_published` next door, which is why it is a
-- different column. "I have a page of my own" and "I appear on my employer's
-- page" are two acts of publication, and somebody can reasonably want the
-- first without the second.
--
-- NULL MEANS NOT LISTED — the opposite of `is_published`, deliberately, and
-- this is the line to read twice before changing anything here.
--
--   `thread_settings.site_is_published` and `thread_organiser.is_published`
--   grandfather NULL as PUBLISHED, because those pages were already serving
--   and switching them off without asking would take live pages down.
--
--   This listing has never existed. Nobody is on it. Grandfathering NULL as
--   listed would PUBLISH A STAFF DIRECTORY on the day it ships, out of rows
--   that `routes/app-thread.ts` creates automatically the first time an
--   external app publishes a thread for a workspace — people who never asked
--   for an account, let alone to be on a company page.
--
-- So: true = list me, false = do not, NULL = never asked, treated as false.
-- The column is nullable rather than `not null default false` so the UI can
-- tell "said no" from "never asked" and offer the question once.
alter table public.thread_organiser
  add column if not exists listed_on_org_page boolean;

comment on column public.thread_organiser.listed_on_org_page is
  'Does this person want to appear on their organisation''s public page at /{workspaceSlug}? true = yes, false = no, NULL = never asked and treated as NOT listed. Deliberately the opposite default from is_published on this same table: that column protects pages that already existed, this one must not publish a staff directory nobody agreed to.';
