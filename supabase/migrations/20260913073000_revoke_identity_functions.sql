-- ============================================================================
-- SECURITY: the identity functions are callable by the service role only.
--
-- Found 2026-09-13 by sweeping every SECURITY DEFINER function on production,
-- after the Connections session found its read functions open to the public
-- anon key. The cause is platform-wide, not a Connections mistake:
--
--   Every one of these functions was "locked" with
--       revoke all on function ... from public;
--   and that does NOT close them. Supabase grants EXECUTE on functions in the
--   public schema to the `anon` and `authenticated` roles SEPARATELY, through
--   default privileges. Revoking from PUBLIC removes only the implicit
--   Postgres grant and leaves both of those in place.
--
-- So the public anon key — which ships in every web bundle — could call
-- these three straight through PostgREST, with no session at all:
--
--   resolve_sso_identity(p_workspace_id, p_provider, p_provider_user_id,
--                        p_provider_email, ...)
--     When no identity row matches, it finds an EXISTING user in the given
--     workspace by email and inserts a user_identity_provider row linking the
--     CALLER-SUPPLIED provider and provider_user_id to that account.
--     Otherwise it creates a person, a user and a platform app_membership in
--     that workspace. Anyone could attach their own external identity to any
--     account whose email they knew, or plant accounts in any workspace.
--
--   ensure_workspace_member(p_user_id, p_workspace_id)
--     Inserts a workspace_member row for any user into any workspace — as
--     organiser, or as ADMIN if the workspace has no members yet. Anyone who
--     signed up had a user id, and workspace ids are not secret (the public
--     embed API takes one as ?workspace=).
--
--   ensure_user_person(p_user_id)
--     Re-links person.user_id for any user.
--
-- HOW IT WAS VERIFIED without running any of them: call as anon with a
-- malformed uuid. Postgres checks EXECUTE privilege first (42501), then
-- coerces arguments (22P02), then runs the body — so a 22P02 proves the role
-- may execute while guaranteeing the body never ran. Calibrated on
-- connections_landscape, known revoked on staging (42501) and granted on
-- production (22P02) at the time.
--
-- WHY THIS IS SAFE FOR LEGITIMATE CALLERS:
--   - resolve_sso_identity is called only by the API, via the service-role
--     client (apps/api/src/routes/sso.ts).
--   - ensure_workspace_member and ensure_user_person are called only from
--     inside other SECURITY DEFINER functions, which run as their owner and
--     need no grant to anon or authenticated.
--   None is ever called by a signed-in user's own session, so revoking from
--   `authenticated` as well as `anon` removes nothing anyone uses.
--
-- DELIBERATELY NOT TOUCHED: can_see_person, can_see_activity,
-- can_see_organisation and meet_is_team_lead are also executable by anon,
-- but they are RLS helpers evaluated AS `authenticated` inside row policies.
-- Revoking them from authenticated would make every policy that calls them
-- fail, and every signed-in user would see nothing. They need their own
-- review, not this migration.
--
-- Written by OID across every overload rather than by a hand-typed
-- signature. resolve_sso_identity has been redefined repeatedly, and a
-- REVOKE naming a stale signature raises an error, or, if an overload
-- survives, silently leaves the live one open.
-- ============================================================================

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'resolve_sso_identity',
         'ensure_workspace_member',
         'ensure_user_person'
       )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.sig);
    execute format('grant execute on function %s to service_role', fn.sig);
  end loop;
end
$$;
