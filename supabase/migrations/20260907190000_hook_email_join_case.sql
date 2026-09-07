-- Harden the access-token hook's email join against case (v0.57.2).
--
-- Found by the RLS-matrix integration work (2026-09-07): the join
-- `au.email = u.email` resolved case-SENSITIVELY in practice (auth.users
-- .email is varchar; the comparison cast defeated citext's case folding),
-- so a mixed-case email in public."user" produced a token with NO custom
-- claims — a silent, claim-less sign-in where every RLS query answers
-- empty. Real flows write lowercase (GoTrue lowercases auth emails and
-- public.user rows are created from them), so nobody was bitten — but a
-- hand-edited or imported row was a landmine. lower() on both sides makes
-- the join total.
--
-- Full function body restated (the hook is replaced whole each time —
-- previous definition: 20260830100000_one_account_many_workspaces.sql).
-- Regression: apps/api/src/integration/hook-case.int.test.ts.

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
