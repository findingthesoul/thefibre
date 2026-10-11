-- Which workspace does NOT get told that Zoom is still waiting on Zoom.
--
-- One reader: the Zoom Marketplace reviewer. He is testing the integration
-- that the notice calls unapproved, and telling him it is "still under
-- request, use Google instead" would undermine the review being waited on.
-- His account is named nowhere in this codebase; his workspace carries this
-- flag, and the flag is what is read.
--
-- ── Why a column, after trying not to add one ─────────────────────────────
--
-- v1.153.0 put this on `workspace_app.settings` for the `fibre-platform` app
-- row, to avoid a migration for something temporary. That was wrong, and
-- measuring it is how it was found rather than reasoning about it: on staging
-- ZERO of 130 workspaces have a fibre-platform workspace_app row, because the
-- platform is not an app a workspace activates — only the-thread, fibre-meet,
-- membership and the rest ever get rows. The `settings` jsonb is unused
-- across every one of the 89 rows that do exist.
--
-- So the flag had nowhere to live, and the integration test passed only
-- because its own helper CREATED the row it then read. A fixture that invents
-- the shape under test proves the test, not the product.
--
-- `workspace` is the one table with exactly one row per workspace, so the flag
-- goes here. Narrowly named rather than a general settings bag: a settings
-- column is a design decision that deserves its own thought, and inventing one
-- in passing for a temporary notice is how general-purpose bags get filled
-- with things nobody can later attribute.
--
-- ── REMOVE WHEN THE ZOOM MARKETPLACE APP IS PUBLISHED ─────────────────────
--
--     alter table public.workspace drop column zoom_notice_hidden;
--
-- together with apps/api/src/lib/zoom-pending.ts, the shared wording file and
-- the `notice` prop on ui/provider-connection.tsx.

alter table public.workspace
  add column if not exists zoom_notice_hidden boolean not null default false;

comment on column public.workspace.zoom_notice_hidden is
  'Suppresses the "Zoom is still awaiting Marketplace approval" notice for this workspace. Set for the Zoom reviewer''s workspace only. DROP THIS COLUMN when the Zoom Marketplace app is published — see 20261011230252.';

-- No RLS change. `workspace` already has its policies, and this is read by the
-- API with the service-role client inside the request that renders the card,
-- never by a browser.
