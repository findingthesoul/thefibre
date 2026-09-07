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

/** Like signedInLandUrl, but for a SPECIFIC auth user (e.g. a participant
 *  the enrol flow just auto-created). */
export async function signedInLandUrlFor(
  host: string,
  targetApp: string,
  user: { id: string; email: string },
  next = '/dashboard',
): Promise<string> {
  const service = stagingService();
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

/** Find a staging auth user by email (e.g. the account the enrol flow
 *  auto-created). */
export async function authUserByEmail(email: string): Promise<{ id: string; email: string }> {
  const service = stagingService();
  const { data } = await service.auth.admin.listUsers({ perPage: 100 });
  const u = data?.users.find((a) => a.email?.toLowerCase() === email.toLowerCase());
  if (!u) throw new Error(`e2e: no auth user for ${email}`);
  return { id: u.id, email: u.email! };
}

// ---------------------------------------------------------------------------
// Public-thread fixture — the E2E twin of the integration harness in
// apps/api/src/integration/staging.ts (duplicated: that module reads env
// injected by the vitest config, which Playwright doesn't provide).
// Minimum viable PUBLISHED thread: throwaway workspace, organiser user row,
// ACTIVE program, public-listed thread, NO tickets (free enrol path).
// ---------------------------------------------------------------------------

export type E2eThreadFixture = {
  organiserSlug: string;
  threadSlug: string;
  title: string;
  intention: string;
  workspaceId: string;
  programId: string;
  threadId: string;
  cleanup: (participantEmails?: string[]) => Promise<void>;
};

export async function createPublicThread(tag: string): Promise<E2eThreadFixture> {
  const service = stagingService();
  const rand = randomBytes(4).toString('hex');
  const t = tag.toLowerCase();

  const { data: ws, error: wErr } = await service
    .from('workspace')
    .insert({ slug: `e2e-${t}-${rand}`, name: `E2E ${t}` })
    .select('id')
    .single();
  if (wErr) throw new Error(`e2e workspace: ${wErr.message}`);

  const { data: urow, error: uErr } = await service
    .from('user')
    .insert({ workspace_id: ws.id, email: `e2e-${t}-org-${rand}@example.com` })
    .select('id')
    .single();
  if (uErr) throw new Error(`e2e user: ${uErr.message}`);

  const { data: app } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  const title = `E2E journey ${rand}`;
  const intention = 'Walk the free enrolment path in a real browser.';

  const { data: program, error: pErr } = await service
    .from('program')
    .insert({ workspace_id: ws.id, app_id: app!.id, title, format: 'journey', status: 'active' })
    .select('id')
    .single();
  if (pErr) throw new Error(`e2e program: ${pErr.message}`);

  const organiserSlug = `e2e-org-${rand}`;
  const { data: org, error: oErr } = await service
    .from('thread_organiser')
    .insert({ user_id: urow.id, workspace_id: ws.id, slug: organiserSlug, display_name: 'E2E Organiser' })
    .select('id')
    .single();
  if (oErr) throw new Error(`e2e organiser: ${oErr.message}`);

  const threadSlug = `e2e-thread-${rand}`;
  const { data: thread, error: tErr } = await service
    .from('thread_thread')
    .insert({
      workspace_id: ws.id,
      program_id: program.id,
      organiser_id: org.id,
      slug: threadSlug,
      intention,
      is_public_listed: true,
    })
    .select('id')
    .single();
  if (tErr) throw new Error(`e2e thread: ${tErr.message}`);

  const cleanup = async (participantEmails: string[] = []) => {
    await service.from('thread_enrolment').delete().eq('thread_id', thread.id);
    await service.from('enrolment').delete().eq('program_id', program.id);
    for (const email of participantEmails) {
      const { data: persons } = await service
        .from('person')
        .select('id')
        .eq('workspace_id', ws.id)
        .eq('email', email);
      for (const p of persons ?? []) {
        await service.from('activity').delete().eq('person_id', p.id);
        await service.from('person').delete().eq('id', p.id);
      }
      await service.from('user').delete().eq('workspace_id', ws.id).eq('email', email);
      const { data: listed } = await service.auth.admin.listUsers({ perPage: 100 });
      const au = listed?.users.find((a) => a.email?.toLowerCase() === email.toLowerCase());
      if (au) await service.auth.admin.deleteUser(au.id).catch(() => undefined);
    }
    await service.from('thread_thread').delete().eq('id', thread.id);
    await service.from('thread_organiser').delete().eq('id', org.id);
    await service.from('program').delete().eq('id', program.id);
    await service.from('user').delete().eq('id', urow.id);
    await service.from('workspace').delete().eq('id', ws.id);
  };

  return {
    organiserSlug,
    threadSlug,
    title,
    intention,
    workspaceId: ws.id as string,
    programId: program.id as string,
    threadId: thread.id as string,
    cleanup,
  };
}
