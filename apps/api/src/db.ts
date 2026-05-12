import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/**
 * Per-request client that forwards the user JWT so RLS applies.
 * NEVER use the service-role client for requests on behalf of a user.
 */
export function userClient(jwt: string): SupabaseClient {
  return createClient(url, serviceKey, {
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
