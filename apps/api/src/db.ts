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
 * Admin client — bypasses RLS. Use only for: webhook handlers,
 * migrations, and platform-internal tasks. Never for end-user requests.
 */
export const adminClient: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
