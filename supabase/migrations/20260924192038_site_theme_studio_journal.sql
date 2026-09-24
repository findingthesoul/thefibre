-- Two more public site designs: 'studio' and 'journal'.
--
-- Sjoerd, 2026-09-24: *"can you make the design (in settings) for the event
-- pages more diverse. (rhyming with the design of the template)"*
--
-- The four that existed — plain, festival, corporate, community — differ in
-- where the weight sits: a hero, a table, a face, a list. All four wear the
-- same neutral palette and no drawn marks at all, so choosing between them
-- was choosing a LAYOUT rather than a character. And two of the four are
-- unusable without a good photograph.
--
--   studio    the brand's own hand: the fallen thread and the cut-outs from
--             thethread.app, on a white ground. The first design that needs
--             no photograph.
--   journal   typography doing the whole job: an oversized headline, a
--             hairline rule, dated entries. A body of work listed, not sold.
--
-- WHY A MIGRATION FOR WHAT IS ESSENTIALLY CSS
-- ---------------------------------------------------------------------------
-- The theme name is validated in FOUR places that must agree, and this is the
-- one that refuses a bad write outright:
--   1. this check constraint
--   2. the Zod enum on PATCH /thread/settings
--   3. SiteTheme in apps/api/src/lib/public-site.ts
--   4. SiteTheme in apps/thread/lib/public-site.ts
-- Widening 2-4 without this one produces a 400 from PostgREST at save time
-- and a settings page that silently will not stick. There is a test that
-- reads all four and fails when they diverge.
--
-- Nothing changes for an existing workspace: this only ADDS permitted values.
-- The renderer falls back to plain for an unknown theme, so even a row
-- written by a future migration this code has not seen degrades to the
-- listing rather than to an error.

alter table public.thread_settings
  drop constraint if exists thread_settings_site_theme_check;

alter table public.thread_settings
  add constraint thread_settings_site_theme_check
  check (site_theme in ('plain', 'festival', 'corporate', 'community', 'studio', 'journal'));

comment on column public.thread_settings.site_theme is
  'Which public site design this workspace wears. Renderers: apps/thread/app/[organiserSlug]/themes.tsx — a theme is code, and the layout IS the theme. Six values as of 20260924192038.';
