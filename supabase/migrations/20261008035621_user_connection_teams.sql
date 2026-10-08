-- ============================================================================
-- Microsoft Teams credentials on the connections SPoT.
--
-- Same shape as Zoom (20260907200000 + 20260930232449): the refresh token is a
-- credential, so it lives on user_connection, which is service-role only and
-- never readable through PostgREST; every reader goes through
-- apps/api/src/lib/connections.ts.
--
-- A plain set of columns on an existing table. No function, so nothing to
-- close (20260914171000); no policy change; no backfill (nobody has connected
-- Teams yet, and nothing can until TEAMS_CLIENT_ID / TEAMS_CLIENT_SECRET are
-- set on the API).
-- ============================================================================

alter table public.user_connection
  add column if not exists teams_refresh_token text,
  add column if not exists teams_account_email text,
  add column if not exists teams_user_id text;

comment on column public.user_connection.teams_refresh_token is
  'Microsoft (Entra ID) OAuth refresh token for creating Teams meetings. Microsoft ROTATES this on every refresh - the refresher must persist the new one. Service-role only, like zoom_refresh_token; never exposed through PostgREST.';
comment on column public.user_connection.teams_account_email is
  'The Microsoft work or school account this connection belongs to (Graph /me mail or userPrincipalName). Shown on the connections card so a user can tell which account is wired up.';
comment on column public.user_connection.teams_user_id is
  'Microsoft Graph''s own object id for the connected account, from /me at connect time. Connect fails without it, as for Zoom, so a stored token can always be traced to a person; cleared together with teams_refresh_token.';

-- NOT unique. One human can be a user in more than one workspace and may
-- connect the same Microsoft account to each.
create index if not exists user_connection_teams_user_id_idx
  on public.user_connection (teams_user_id)
  where teams_user_id is not null;
