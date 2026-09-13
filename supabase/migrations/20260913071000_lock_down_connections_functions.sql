-- ============================================================================
-- Security: the Connections read functions were callable by ANYONE.
--
-- Found 2026-09-13 by pointing the PUBLIC anon key — the one baked into every
-- browser bundle — straight at Supabase PostgREST, with no user session:
--
--     POST /rest/v1/rpc/connections_landscape { "p_workspace": "<any id>" }
--         → 200, 30 rows of another workspace's ladder
--     POST /rest/v1/rpc/connections_attention { "p_workspace": "<any id>" }
--         → 200, rows carrying person_id — WHO needs attention, by id
--
-- A direct table read is refused (RLS): `GET /rest/v1/person?workspace_id=eq…`
-- returns []. The functions leak what the tables protect, for two reasons that
-- only bite together:
--
--   1. They are SECURITY DEFINER, so they run as the owner and RLS never sees
--      the query. That is deliberate and correct — the API calls them through
--      the service-role client and filters workspace itself.
--   2. Postgres grants EXECUTE on a new function to PUBLIC by default. The
--      `grant execute … to authenticated, service_role` lines in each
--      migration READ like the access list and are not — PUBLIC already had
--      it, so anon did too. The workspace is just a parameter, checked by
--      nobody, so anyone could ask about any tenant.
--
-- The same shape as the PUT /notes and Thread findings this week: a
-- service-role/definer path that trusts a caller-supplied id. Here the caller
-- is not even authenticated.
--
-- ── The fix ─────────────────────────────────────────────────────────────────
--
-- Every one of these functions is called EXCLUSIVELY by the API through the
-- service-role client (grep: all `adminClient.rpc(...)`, no `userClient`, no
-- policy, no trigger). So REVOKE execute from PUBLIC and from `authenticated`,
-- leaving only `service_role`. That closes the anon hole AND the quieter
-- authenticated one — a signed-in user of workspace A passing workspace B's id
-- would have leaked exactly the same way.
--
-- Nested calls are unaffected: connections_entries calls connections_person_label
-- and connections_edge_decay inside its own definer body, where the effective
-- role is the owner, which keeps execute.
--
-- REVOKE is idempotent, so this is safe to re-run.
-- ============================================================================

do $$
declare
  fn text;
  sigs text[] := array[
    'public.connections_landscape(uuid, timestamptz)',
    'public.connections_landscape_axis(uuid, text, timestamptz)',
    'public.connections_attention(uuid, int)',
    'public.connections_neighbourhood(uuid, uuid, int)',
    'public.connections_entries(uuid, uuid, uuid, int)',
    'public.connections_person_label(text, text, text)',
    'public.connections_edge_decay(timestamptz)',
    'public.pulse_commitment_rot(uuid, int)',
    'public.last_spoken_at(uuid)'
  ];
begin
  foreach fn in array sigs loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke all on function %s from authenticated', fn);
    -- The service-role client is the only legitimate caller; make sure it kept it.
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end
$$;
