import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/**
 * Per-request client that forwards the user JWT so RLS applies.
 *
 * IMPORTANT: must use the **anon key** as the apikey, then override
 * Authorization to forward the user's JWT. If you use the service key as
 * apikey here, PostgREST elevates to service_role and the user's
 * workspace_id claim is never seen by RLS — updates/upserts then fail with
 * 500 or silently bypass tenant isolation.
 */
export function userClient(jwt: string): SupabaseClient {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Admin client — the service role, which RLS does not see.
 *
 * This comment said "never for end-user requests" until 2026-10-01, and that
 * had not been true for a long time: 48 of the 57 route modules use this
 * client on requests a signed-in person makes (measured that day; handbook
 * §2). So read it the way the code is written: ON THIS CLIENT THE ROUTE IS
 * THE TENANT BOUNDARY. Every query needs its own `.eq('workspace_id',
 * ctx.workspaceId)` — or an id it has first proven belongs to the caller's
 * workspace — because nothing underneath will add it. Both cross-workspace
 * holes found in September 2026 (thread tenancy, person merge) were a
 * missing filter on this client; integration/*-tenancy.int.test.ts is the
 * shape of test that catches the next one.
 *
 * Prefer `userClient(ctx.jwt)` for a read that RLS can answer.
 */
export const adminClient: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
