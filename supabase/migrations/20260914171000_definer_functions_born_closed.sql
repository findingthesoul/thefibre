-- ============================================================================
-- SECURITY, part two of 20260914170000: revoke from PUBLIC as well, and make
-- every future function born closed.
--
-- The previous migration revoked EXECUTE from `anon` on every SECURITY
-- DEFINER function and the staging probe still found four open:
--
--   meet_is_team_lead, pulse_can_read_workspace, pulse_can_write_workspace,
--   workspace_meet_fee
--
-- These four had never been "locked" at all, so they still carried the grant
-- Postgres gives every new function to the PUBLIC pseudo-role — and anon is a
-- member of PUBLIC. Revoking from `anon` removes anon's OWN grant and leaves
-- the one it inherits. (Handbook §11.3b describes the mirror-image mistake:
-- revoking from PUBLIC and leaving anon's own grant. Both revokes are needed;
-- the identity-function migration got the second, this one gets the first.)
--
-- So, for every SECURITY DEFINER function in public:
--   1. revoke EXECUTE from PUBLIC and from anon;
--   2. grant EXECUTE to service_role (the API's only path to any of them);
--   3. grant EXECUTE to authenticated ONLY for the reviewed RLS helpers,
--      which row policies evaluate as the signed-in role. Until now several
--      of these reached authenticated through PUBLIC; after step 1 they need
--      their own grant or every policy that calls them fails and the app
--      goes blank. The list is the same allowlist the guard test asserts
--      (apps/api/scripts/lib/definer-probe.mjs, AUTHENTICATED_ALLOWED).
--
-- And the default privileges for functions the `postgres` role creates from
-- now on: no EXECUTE for PUBLIC and none for anon. A function born after this
-- migration is executable by service_role and authenticated (Supabase's own
-- default grants to those two stay) and by nobody else. A new RLS helper
-- needs nothing extra; a new service-only function needs
-- `revoke execute on function ... from authenticated` — one line, and the
-- guard test says so by name when it is missing.
-- ============================================================================

do $$
declare
  fn record;
  helpers text[] := array[
    'can_see_person',
    'can_see_organisation',
    'can_see_activity',
    'meet_is_team_lead',
    'is_workspace_admin',
    'current_workspace_role',
    'pulse_can_read_workspace',
    'pulse_can_write_workspace',
    'workspace_meet_fee'
  ];
begin
  for fn in
    select p.oid::regprocedure as sig, p.proname as name
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon', fn.sig);
    execute format('grant execute on function %s to service_role', fn.sig);
    if fn.name = any (helpers) then
      execute format('grant execute on function %s to authenticated', fn.sig);
    end if;
  end loop;
end
$$;

alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
