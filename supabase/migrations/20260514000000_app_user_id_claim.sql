-- ============================================================================
-- Add `app_user_id` claim to JWTs and rewire RLS helpers.
--
-- Until now `current_user_id()` returned the JWT `sub`, which is the
-- `auth.users.id` — not the same as `public.user.id`. Any FK reference to
-- `public.user.id` (notes_updated_by, created_by, etc.) writes were failing
-- with 23503 because the auth uuid doesn't exist in public.user.
--
-- Fix: the custom_access_token_hook now injects `app_user_id` (the
-- public.user.id) into JWT claims, and `current_user_id()` reads from there.
-- ============================================================================

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
  -- Match auth.users → public.user by email.
  select u.id, u.workspace_id
    into v_app_user_id, v_workspace_id
    from public."user" u
    join auth.users au on au.email = u.email
   where au.id = v_auth_user_id
     and u.deleted_at is null
   limit 1;

  if v_app_user_id is not null then
    v_claims := v_claims || jsonb_build_object('app_user_id', v_app_user_id);
  end if;

  if v_workspace_id is not null then
    v_claims := v_claims || jsonb_build_object('workspace_id', v_workspace_id);
  end if;

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

-- Update current_user_id() to read app_user_id (public.user.id) instead of sub.
-- All existing RLS policies that use this helper now correctly match against
-- public.user.id.
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(((current_setting('request.jwt.claims', true))::jsonb ->> 'app_user_id'), '')::uuid
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
