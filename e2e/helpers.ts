// E2E plumbing: staging hosts + the session mint.
//
// Signed-in tests ride the SSO-handoff landing route: we insert a
// single-use code into the staging DB (service role) for an EXISTING
// staging user, then point the browser at /sso/land?code=… — the app
// redeems it server-side and sets its own session cookies, exactly as a
// real cross-apex hop does. No password, no OTP inbox, no cookie forgery.

import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const HOSTS = {
  fibre: 'https://thefibre.tech',
  meet: 'https://meet.thefibre.tech',
  thread: 'https://thread.thefibre.tech',
  flow: 'https://flow.thefibre.tech',
  pulse: 'https://pulse.thefibre.tech',
  membership: 'https://membership.thefibre.tech',
};

let cached: SupabaseClient | null = null;
export function stagingService(): SupabaseClient {
  if (cached) return cached;
  // Run from the repo root (`pnpm test:e2e`); Playwright transpiles this
  // file to CJS, so no import.meta here.
  const raw = readFileSync(resolve(process.cwd(), 'apps/api/.env.staging'), 'utf8');
  const env = Object.fromEntries(
    raw
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (!url.includes('lukhyylwhhjyihqtghvw')) {
    throw new Error(`e2e: refusing non-staging Supabase URL (${url})`);
  }
  cached = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** An existing staging user who holds a platform user row (so the
 *  auth-callback access-check passes). */
async function fixtureUser(): Promise<{ id: string; email: string }> {
  const service = stagingService();
  const { data: users } = await service
    .from('user')
    .select('email')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(5);
  const { data: auth } = await service.auth.admin.listUsers({ perPage: 50 });
  for (const u of users ?? []) {
    const match = auth?.users.find(
      (a) => a.email?.toLowerCase() === String(u.email).toLowerCase() && a.email_confirmed_at,
    );
    if (match) return { id: match.id, email: match.email! };
  }
  throw new Error('e2e: no staging user found with both an auth account and a platform row');
}

/** Mint a single-use handoff code and return the land URL that signs the
 *  browser in on `host` (60s TTL — navigate promptly). */
export async function signedInLandUrl(
  host: string,
  targetApp: string,
  next = '/dashboard',
): Promise<string> {
  const service = stagingService();
  const user = await fixtureUser();
  const code = `e2e-${randomBytes(24).toString('base64url')}`;
  const { error } = await service.from('sso_handoff').insert({
    code,
    user_id: user.id,
    email: user.email,
    target_app: targetApp,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  });
  if (error) throw new Error(`e2e: could not mint handoff code: ${error.message}`);
  return `${host}/sso/land?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`;
}
