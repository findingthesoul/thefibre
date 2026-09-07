// Shared plumbing for the staging integration suite. Clients are built
// here from the env injected by vitest.integration.config.ts — tests never
// import src/db.ts directly for their own clients (import order would
// matter); lib functions under test (e.g. recordPurchase) are dynamically
// imported so db.ts constructs its adminClient AFTER the env exists.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!url || !anonKey || !serviceKey) {
  throw new Error('integration suite: staging credentials missing from env');
}
if (!url.includes('lukhyylwhhjyihqtghvw')) {
  // Refuse to run against anything but the staging project — a mispointed
  // env file must fail loudly, not write fixtures into production.
  throw new Error(`integration suite: refusing non-staging Supabase URL (${url})`);
}

/** Service-role client — bypasses RLS (fixture setup/teardown + oracle). */
export const service: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Anonymous client — no session at all. RLS must show it NOTHING. */
export const anon: SupabaseClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** The load-bearing rehearsal workspace (Stripe test rig, priced tiers,
 *  real fixture member). NEVER select it as a test target, never clean it. */
export const REHEARSAL_WS_PREFIX = 'ca0569d5';

/** An existing workspace that is safe to attach throwaway rows to (never
 *  the rehearsal rig). Rows are cleaned by their own ids/refs. */
export async function anyWorkspaceId(): Promise<string> {
  const { data, error } = await service.from('workspace').select('id').limit(10);
  if (error || !data?.length) throw new Error(`no workspaces on staging: ${error?.message}`);
  const ws = data.find((w) => !String(w.id).startsWith(REHEARSAL_WS_PREFIX));
  if (!ws) throw new Error('only the rehearsal workspace exists — refusing to touch it');
  return ws.id as string;
}
