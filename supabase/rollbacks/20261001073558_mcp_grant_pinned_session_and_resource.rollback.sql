-- ROLLBACK for the MCP grant-pinning hook change
-- (20261001073558_mcp_grant_pinned_session_and_resource.sql, corrected by
--  20261001163423_hook_pin_keeps_case_insensitive_email_join.sql).
--
-- NOT a migration (this directory is not supabase/migrations, so `db push`
-- never applies it). Run by hand only if the pinned-session hook misbehaves:
--   supabase db execute -f supabase/rollbacks/20261001073558_mcp_grant_pinned_session_and_resource.rollback.sql
-- It restores custom_access_token_hook to the LAST GOOD body before the pin,
-- VERBATIM: 20260907190000_hook_email_join_case.sql — the one with the
-- case-insensitive email join (the first draft of this file wrongly carried
-- the older 20260830 body, which lacks it). The two mcp_grant columns and the
-- index are left in place: unread by this hook, harmless, and dropping them
-- would orphan grants made in between.

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
  v_app_user_id  uuid;
  v_workspace_id uuid;
  v_app_slugs    text[];
begin
  select u.id, u.workspace_id
    into v_app_user_id, v_workspace_id
    from public."user" u
    join auth.users au on lower(au.email) = lower(u.email::text)
    left join public.user_active_workspace aw on aw.auth_user_id = au.id
   where au.id = v_auth_user_id
     and u.deleted_at is null
   order by
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
