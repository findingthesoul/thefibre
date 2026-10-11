-- organisation_page_publish_switch
--
-- A workspace can say it wants no public organisation page, the same way a
-- person can already say it about theirs (20261008071507).
--
-- THE SHAPE IS COPIED ON PURPOSE, including the NULL. `true` is yes, `false`
-- is no, and NULL means the row predates the question and is grandfathered as
-- PUBLISHED. Every workspace page that serves today must keep serving the day
-- this ships; a switch that defaults to off would take a dozen live pages
-- down to ask a question nobody had been asked yet.
--
-- (Its sibling in the next slice, thread_organiser.listed_on_org_page, is
-- grandfathered the OTHER way — NULL means not listed. That is not an
-- inconsistency: this column protects pages that already exist, that one must
-- not publish a staff directory nobody agreed to.)
--
-- WHERE THE GATE SITS: on the organisation PAGE route alone, not in
-- resolvePublicOwner. The resolver is shared by /{slug} and every
-- /{slug}/{threadSlug} beneath it, so gating it there would 404 every
-- enrolment link sent under a workspace's address. Switching your
-- organisation page off does not unpublish your threads.
alter table public.thread_settings
  add column if not exists site_is_published boolean;

comment on column public.thread_settings.site_is_published is
  'Does this workspace want a public organisation page at /{workspaceSlug}? true = yes, false = no, NULL = the row predates the question and is grandfathered as published until somebody is asked. Read by the public organisation page route only — thread pages under the same slug are never gated by it.';
