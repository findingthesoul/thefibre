-- ============================================================================
-- Custom Access Token Hook
-- Injects workspace_id (and a few flags) into the Supabase Auth JWT.
-- The API middleware reads workspace_id from the JWT; RLS reads it via
-- public.current_workspace_id().
--
-- After applying this migration, enable the hook in:
--   Supabase Dashboard → Authentication → Hooks → Customize Access Token
--   → set to: public.custom_access_token_hook
-- ============================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id      uuid := (event ->> 'user_id')::uuid;
  v_claims       jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  v_workspace_id uuid;
  v_app_slugs    text[];
begin
  -- Match the Supabase Auth user to the platform user by email.
  -- (auth.users.id and public.user.id are independent — we link by email.)
  select u.workspace_id
    into v_workspace_id
    from public."user" u
    join auth.users au on au.email = u.email
   where au.id = v_user_id
     and u.deleted_at is null
   limit 1;

  if v_workspace_id is not null then
    v_claims := v_claims || jsonb_build_object('workspace_id', v_workspace_id);
  end if;

  -- App memberships → list of slugs in the JWT for fast app gating.
  select array_agg(distinct a.slug)
    into v_app_slugs
    from public.app_membership am
    join public.app a on a.id = am.app_id
    join public."user" u on u.id = am.user_id
    join auth.users au on au.email = u.email
   where au.id = v_user_id;

  if v_app_slugs is not null then
    v_claims := v_claims || jsonb_build_object('app_memberships', v_app_slugs);
  end if;

  return jsonb_build_object('claims', v_claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
