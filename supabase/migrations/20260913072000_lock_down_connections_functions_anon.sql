-- ============================================================================
-- Security, part two: the previous revoke missed the `anon` role.
--
-- 20260913071000 revoked EXECUTE from `public` and `authenticated`, and the
-- anon key STILL read another workspace's landscape. The reason is a Supabase
-- default: the project ships
--
--     alter default privileges in schema public
--       grant execute on functions to anon, authenticated, service_role;
--
-- so every function created in `public` is granted to the `anon` ROLE
-- DIRECTLY, as well as to PUBLIC. Revoking from `public` and `authenticated`
-- leaves that explicit `anon` grant in place, and PostgREST runs an
-- unauthenticated request as exactly that role.
--
-- So revoke from `anon` too. All three revokes are repeated here so this one
-- migration is the complete, self-contained statement of the rule, and it is
-- idempotent.
--
-- The NOTICE prints each function's ACL after the change, so the push log is
-- the proof rather than a later probe.
-- ============================================================================

do $$
declare
  fn text;
  acl text;
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
    execute format('revoke all on function %s from anon', fn);
    execute format('revoke all on function %s from authenticated', fn);
    execute format('revoke all on function %s from public', fn);
    execute format('grant execute on function %s to service_role', fn);
    execute format('select pg_catalog.array_to_string(proacl, %L) from pg_proc where oid = %L::regprocedure', ' | ', fn) into acl;
    raise notice 'ACL % => %', fn, coalesce(acl, '(default: owner only)');
  end loop;
end
$$;
