-- ============================================================================
-- SECURITY: no SECURITY DEFINER function is executable by `anon`, and none
-- written after today will be either.
--
-- Closes the build-plan item opened 2026-09-13 after the identity-function
-- sweep (20260913073000). Nine definer functions were still executable with
-- the public anon key, which ships in every web bundle:
--
--   can_see_person, can_see_organisation, can_see_activity, meet_is_team_lead,
--   is_workspace_admin, current_workspace_role,
--   pulse_can_read_workspace, pulse_can_write_workspace,
--   workspace_meet_fee
--
-- Reviewed one by one (bodies in their own migrations). The first eight read
-- the CALLER from the JWT claims (`current_user_id()`, `current_workspace_id()`,
-- `is_workspace_admin()`) and return a boolean or a role about that caller.
-- As anon the claims are null, so every one answers false or null: the
-- exposure was nil, but the door was open and a future edit that takes a
-- target parameter would have walked straight through it. The ninth,
-- `workspace_meet_fee(ws_id)`, returns any workspace's plan fee to anyone who
-- names the workspace — low value, and nothing anonymous ever needs it.
--
-- WHY `authenticated` KEEPS ITS GRANT on those nine: they are the RLS helpers
-- evaluated inside row policies as the signed-in role. Revoking them from
-- authenticated blanks the app for every user. Every policy in this schema
-- is `to authenticated`; the one anon policy (signup_request insert) calls no
-- function; and the API reaches every definer function through the service
-- role. So `anon` needs none of them, and this migration revokes anon from
-- EVERY SECURITY DEFINER function in public rather than naming nine — the
-- naming is what let the earlier lockdowns miss functions.
--
-- THE STRUCTURAL HALF. Supabase's project default is
--     alter default privileges in schema public
--       grant execute on functions to anon, authenticated, service_role;
-- which is why every function since May was born open to anon regardless of
-- how carefully its author wrote `revoke ... from public`. The default is
-- changed here so functions created from now on are NOT granted to anon.
-- Grants to authenticated and service_role stay as they were.
--
-- VERIFIED BY: apps/api/scripts/audit-definer-functions.mjs (any project,
-- read-only) and src/integration/definer-functions.int.test.ts (staging,
-- every run). Both use the calibrated probe — malformed uuid as the role,
-- 42501 closed / 22P02 open — so no body ever runs.
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
       and p.prosecdef
  loop
    execute format('revoke execute on function %s from anon', fn.sig);
    execute format('grant execute on function %s to service_role', fn.sig);
  end loop;
end
$$;

-- Functions created from now on: not granted to anon by default. The role
-- that owns migrations (and therefore creates functions) is `postgres`; the
-- default privileges are per grantor, so name it explicitly.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
