// Shared plumbing for the staging integration suite. Clients are built
// here from the env injected by vitest.integration.config.ts — tests never
// import src/db.ts directly for their own clients (import order would
// matter); lib functions under test (e.g. recordPurchase) are dynamically
// imported so db.ts constructs its adminClient AFTER the env exists.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
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

// ---------------------------------------------------------------------------
// Auth-fixture harness (v0.57.0, the two-user RLS matrix). A fixture user is
// a real staging auth identity + a public."user" row in ONE workspace; its
// session is minted the supported way (admin.generateLink → verifyOtp — no
// email is sent) so the custom_access_token_hook stamps real workspace
// claims. @example.com addresses on purpose: the live 5-minute scheduler
// sweeps staging, and anything it might touch must never email a person.
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';

export type FixtureUser = {
  email: string;
  authUserId: string;
  userId: string;
  /** The session's access token (JWT with hook-stamped claims). */
  accessToken: string;
  /** Authenticated client — RLS applies exactly as for a real session. */
  client: SupabaseClient;
};

export async function createThrowawayWorkspace(tag: string): Promise<string> {
  const slug = `int-test-${tag}-${randomUUID().slice(0, 8)}`;
  const { data, error } = await service
    .from('workspace')
    .insert({ slug, name: `Integration test ${tag}` })
    .select('id')
    .single();
  if (error) throw new Error(`workspace fixture failed: ${error.message}`);
  return data.id as string;
}

export async function createFixtureUser(workspaceId: string, tag: string): Promise<FixtureUser> {
  // Lowercased on purpose: GoTrue lowercases auth emails, and the hook's
  // `au.email = u.email` join resolved case-SENSITIVELY in practice (a
  // mixed-case fixture email produced a token with NO custom claims —
  // observed 2026-09-07). Real signups never hit this (public.user rows are
  // written from the already-lowercased auth email), but fixtures must
  // match that invariant.
  const email = `int-${tag.toLowerCase()}-${randomUUID().slice(0, 8)}@example.com`;
  const { data: created, error: cErr } = await service.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (cErr || !created.user) throw new Error(`auth user fixture failed: ${cErr?.message}`);

  const { data: row, error: uErr } = await service
    .from('user')
    .insert({ workspace_id: workspaceId, email })
    .select('id')
    .single();
  if (uErr) throw new Error(`public.user fixture failed: ${uErr.message}`);

  const { data: link, error: lErr } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (lErr || !tokenHash) throw new Error(`generateLink failed: ${lErr?.message}`);

  // verifyOtp on a scratch client just to obtain the session; with
  // persistSession:false supabase-js won't retain it, so the RLS client is
  // built the userClient way (src/db.ts): anon apikey + the user JWT as a
  // pinned Authorization header. Every query then runs as that session.
  const scratch = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let v = await scratch.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
  if (v.error) v = await scratch.auth.verifyOtp({ type: 'email', token_hash: tokenHash });
  const accessToken = v.data?.session?.access_token;
  if (v.error || !accessToken) throw new Error(`verifyOtp failed: ${v.error?.message}`);

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { email, authUserId: created.user.id, userId: row.id as string, accessToken, client };
}

export async function deleteFixtureUser(u: FixtureUser): Promise<void> {
  await service.from('user').delete().eq('id', u.userId);
  await service.auth.admin.deleteUser(u.authUserId).catch(() => undefined);
}

export async function deleteThrowawayWorkspace(id: string): Promise<void> {
  await service.from('workspace').delete().eq('id', id);
}

/** Decode a fixture session's JWT claims (no verification — staging is the oracle). */
export function jwtClaims(u: FixtureUser): Record<string, unknown> {
  const payload = u.accessToken.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(payload, 'base64url').toString() || '{}');
}
