-- ============================================================================
-- Remember WHICH Zoom user a connection is (Zoom Marketplace filing prep,
-- 2026-09-14).
--
-- A Zoom app listed on the Marketplace must delete a user's data when Zoom
-- says they removed the app. Zoom's `app_deauthorized` event names the user
-- by Zoom's own user id — and until now nothing stored that id. The connect
-- flow already fetched it from /users/me and kept only the email, so a
-- deauthorization would have arrived for someone the platform had no way to
-- find, and their refresh token would have outlived their consent.
--
-- No backfill: production has no Zoom connection (Zoom is not configured
-- there yet). Staging holds exactly one, the 2026-09-30 test connection made
-- before this column existed; it carries no id, so it is simply disconnected
-- and reconnected once after this ships. Every connection made from here on is
-- written with the id from the start.
--
-- A plain column on a service-role-only table. No function, so nothing to
-- close (20260914171000); no policy change.
-- ============================================================================

alter table public.user_connection
  add column if not exists zoom_user_id text;

comment on column public.user_connection.zoom_user_id is
  'Zoom''s own user id for the connected Zoom account, from /users/me at connect time. The key app_deauthorized arrives with; cleared together with zoom_refresh_token.';

-- NOT unique. One human can be a user in more than one workspace, and may
-- connect the same Zoom account to each; a unique index would make the second
-- connect fail. The deauthorization therefore clears EVERY row with the id.
create index if not exists user_connection_zoom_user_id_idx
  on public.user_connection (zoom_user_id)
  where zoom_user_id is not null;
