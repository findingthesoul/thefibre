-- ============================================================================
-- The app catalogue calls it Connect.
--
-- Sjoerd, 2026-09-21: *"I want to rename connections to connect."*
--
-- The SLUG does not move and never will — `fibre-sales` tags every curator row
-- on person_relationship_context and org_relationship, it is what
-- has_app_membership() and the RLS policies name, and it is in the published
-- /api/v1/apps/* contract that an app outside this repo is written against.
-- The directory apps/connections stays too, for the same reason. This is the
-- DISPLAY name, which is the only part of an app's identity that is allowed
-- to move (the rule that let fibre-sales become "Connections" in the first
-- place, and membership become "Hyve").
--
-- Why a migration rather than a value in branding.ts: `app.name` is read by
-- surfaces that go through the catalogue rather than through the app registry
-- — /admin/apps, the workspace's app list, and anything an external app sees
-- through the published contract. Two names for one app is exactly the
-- confusion this rename is undoing.
--
-- Idempotent and narrow: one row, matched by slug, and it says what it is
-- replacing so re-running after a future rename cannot silently undo one.
-- ============================================================================

update public.app
   set name = 'Connect'
 where slug = 'fibre-sales'
   and name = 'Connections';
