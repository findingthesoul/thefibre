-- hook_pin_keeps_case_insensitive_email_join
--
-- Corrects 20261001073558_mcp_grant_pinned_session_and_resource.sql, which
-- re-created custom_access_token_hook from the 20260830 body and so DROPPED
-- the case-insensitive email join that 20260907190000_hook_email_join_case.sql
-- had added: `join auth.users au on au.email = u.email` instead of
-- `lower(au.email) = lower(u.email::text)`. A public.user whose email carries
-- a capital letter then matched no auth.users row, got a token with no
-- app_user_id and no workspace_id, and RLS denied everything — the exact
-- incident the 0907 migration fixed, and its regression test
-- (apps/api/src/integration/hook-case.int.test.ts) went red on staging the
-- moment 073558 was applied. Found by the stress-test session, 2026-10-01.
--
-- The bad version existed on STAGING only, for under an hour; it never
-- reached production. Fixed forward — the applied file is left untouched
-- (editing it is a no-op on the remote) and this one supersedes the function.
--
-- This body is the 20260907190000 function VERBATIM with exactly one change:
-- the grant-pin lookup and its ORDER BY term from 073558. Diffed line by line
-- against 0907 before applying.

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
    join auth.users au on lower(au.email) = lower(u.email::text)
    left join public.user_active_workspace aw on aw.auth_user_id = au.id
   where au.id = v_auth_user_id
     and u.deleted_at is null
   order by
     -- a grant's pinned workspace first, when this session is a grant's
     (v_pinned_ws is not null and u.workspace_id = v_pinned_ws) desc,
     -- the chosen workspace first, when there is one and it still exists
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
