-- The workspace's public site — the wrapper its public pages live inside.
--
-- Sjoerd, 2026-09-11: "on workspace level.. provide three different design
-- styles... A festival: full page hero image with a title and navbar at the
-- top. A second one more corporate. A third one more community like style."
-- Plus "the ingredients of a website (image, navbar, logo, intro text,
-- footer, privacy (from the fibre), conditions, contact page (with basic
-- form))".
--
-- WHY ON thread_settings, and not a new table: this is one row per
-- workspace, which is exactly what thread_settings already is, and the
-- public renderer already has to load it. A `thread_site` table would be a
-- second one-row-per-workspace table with the same key and the same
-- lifetime — a join for nothing.
--
-- WHAT IS DELIBERATELY NOT HERE: pages. Sjoerd asked for "a basic structure
-- to use templates. Later we will make templates", and named a drag-and-drop
-- designer (the certificate builder's shape) as the future. So this stores
-- the INGREDIENTS a site is assembled from, not a layout — the layout is the
-- theme, and a theme is code. When the designer arrives it stores documents;
-- these columns stay the content it reaches for.

alter table public.thread_settings
  -- Which of the three shapes renders the public pages. 'plain' is what
  -- every existing workspace already gets, so nobody's live page changes
  -- the moment this migration lands.
  add column if not exists site_theme text not null default 'plain'
    check (site_theme in ('plain', 'festival', 'corporate', 'community')),
  add column if not exists site_name text,
  add column if not exists site_logo_url text,
  add column if not exists site_hero_url text,
  add column if not exists site_headline text,
  -- Sanitised HTML (apps/api/src/lib/rich-text.ts), same as a thread's
  -- intention — it renders through dangerouslySetInnerHTML on a public page.
  add column if not exists site_intro text,
  add column if not exists site_footer_note text,
  -- The navbar's own links: [{ label, href }]. Free links, because the
  -- pages a workspace wants to point at (its own site, a manifesto, a
  -- donation page) are not ours to enumerate.
  add column if not exists site_links jsonb not null default '[]'::jsonb,
  -- The contact page. Off by default: a form nobody reads is worse than no
  -- form, so it exists only once somebody names the address it reaches.
  add column if not exists site_contact_enabled boolean not null default false,
  add column if not exists site_contact_email text,
  add column if not exists site_contact_intro text;

comment on column public.thread_settings.site_theme is
  'Public page shape: plain | festival | corporate | community. Renderers live in apps/thread/app/[organiserSlug]/themes.';
comment on column public.thread_settings.site_intro is
  'Sanitised HTML — written through sanitizeRichText, rendered with dangerouslySetInnerHTML.';
