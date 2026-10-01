-- mcp_grant_pinned_session_and_resource
--
-- One Claude, several workspaces. A connected assistant's grant is for ONE
-- workspace, but its dedicated session was stamped by custom_access_token_hook
-- from the person's ACTIVE workspace (user_active_workspace) — so the moment
-- they switched workspace in a browser, every other connected workspace's
-- session refreshed into the wrong tenant and the grant refused it
-- (workspace_switched). Only the workspace matching the current tab ever
-- worked for longer than its hourly cache. Sjoerd, 2026-10-01: per-workspace
-- connector addresses (https://mcp.thefibre.app/<workspace-slug>); that needs
-- the session pinned to the GRANT's workspace, not the person's current one.
--
-- Two columns on mcp_grant and one precedence rule in the hook:
--   resource    the canonical connector address the grant was made for — the
--               access token's audience, so a token for one workspace address
--               never opens another. Null = plain address, host-derived as before.
--   session_id  the dedicated session's id (the `session_id` JWT claim). The
--               hook pins a session found here to that grant's workspace.
--
-- For every session that is NOT an MCP grant's, the hook's result is
-- byte-identical to before: the grant lookup is one indexed select that finds
-- nothing, and the existing active-workspace/earliest-row ordering follows.
-- Rollback: supabase/rollbacks/20261001073558_mcp_grant_pinned_session_and_resource.rollback.sql
-- restores the previous function body verbatim (the columns are harmless to keep).

alter table public.mcp_grant
  add column if not exists resource   text,
  add column if not exists session_id uuid;

comment on column public.mcp_grant.resource is
  'Canonical connector address this grant was made for (access-token audience), e.g. https://mcp.thefibre.app/<workspace-slug>. Null = plain address, audience derived from the request host.';
comment on column public.mcp_grant.session_id is
  'The dedicated Supabase session''s id (JWT session_id claim). custom_access_token_hook pins this session to the grant''s workspace, whatever the person has active elsewhere.';

-- The hook runs on every token mint for every signed-in person; the lookup
-- must be an index hit. Partial: revoked grants never pin anything.
create index if not exists mcp_grant_session_idx
  on public.mcp_grant (session_id)
  where session_id is not null and revoked_at is null;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := (event ->> 'user_id')::uuid;
  v_claims       jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  v_session_id   uuid;
  v_pinned_ws    uuid;
  v_app_user_id  uuid;
  v_workspace_id uuid;
  v_app_slugs    text[];
begin
  -- A session that belongs to an MCP grant is pinned to that grant's
  -- workspace. Supabase puts the session's id in the claims it hands us;
  -- a malformed or absent value simply means "not pinned".
  begin
    v_session_id := nullif(v_claims ->> 'session_id', '')::uuid;
  exception when others then
    v_session_id := null;
  end;
  if v_session_id is not null then
    select g.workspace_id
      into v_pinned_ws
      from public.mcp_grant g
     where g.session_id = v_session_id
       and g.revoked_at is null
     limit 1;
  end if;

  select u.id, u.workspace_id
    into v_app_user_id, v_workspace_id
    from public."user" u
    join auth.users au on au.email = u.email
    left join public.user_active_workspace aw on aw.auth_user_id = au.id
   where au.id = v_auth_user_id
     and u.deleted_at is null
   order by
     -- a grant's pinned workspace first, when this session is a grant's
     (v_pinned_ws is not null and u.workspace_id = v_pinned_ws) desc,
     -- then the chosen workspace, when there is one and it still exists
     (aw.workspace_id is not null and u.workspace_id = aw.workspace_id) desc,
     -- otherwise the oldest membership, so it never moves on its own
     u.created_at asc
   limit 1;

  if v_app_user_id is not null then
    v_claims := v_claims || jsonb_build_object('app_user_id', v_app_user_id);
  end if;

  if v_workspace_id is not null then
    v_claims := v_claims || jsonb_build_object('workspace_id', v_workspace_id);
  end if;

  -- App memberships belong to the user ROW, so they follow the active
  -- workspace rather than spanning them. Being an admin of one workspace's
  -- apps says nothing about another's.
  select array_agg(distinct a.slug)
    into v_app_slugs
    from public.app_membership am
    join public.app a on a.id = am.app_id
   where am.user_id = v_app_user_id;

  if v_app_slugs is not null then
    v_claims := v_claims || jsonb_build_object('app_memberships', v_app_slugs);
  end if;

  return jsonb_build_object('claims', v_claims);
end;
$$;
