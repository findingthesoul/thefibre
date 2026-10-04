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

/**
 * A staging auth user by email, paging through the WHOLE list.
 *
 * Until 2026-09-27 this read one page of fifty (a hundred in authUserByEmail)
 * and searched it. Staging had grown past fifty accounts, so the oldest
 * platform user — the super admin every signed-in spec relies on — was no
 * longer on the page, the picker fell through to the next candidate, and the
 * fixture silently became a test MEMBER with three seats. Three specs then
 * failed on screens that need an admin, and the failures read as product
 * regressions for an hour. A truncated lookup that answers with a plausible
 * account is the same class as testing approach §1.9 — the lookup must find
 * the account or say it cannot, never pick another one.
 */
async function authUserByEmailPaged(email: string): Promise<{ id: string; email: string; confirmed: boolean } | null> {
  const service = stagingService();
  const want = email.toLowerCase();
  for (let page = 1; page < 50; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`e2e: listUsers page ${page}: ${error.message}`);
    const hit = data.users.find((a) => a.email?.toLowerCase() === want);
    if (hit) return { id: hit.id, email: hit.email!, confirmed: !!hit.email_confirmed_at };
    if (data.users.length < 200) return null;
  }
  return null;
}

/** An existing staging user who holds a platform user row (so the
 *  auth-callback access-check passes): the OLDEST such account, which on
 *  staging is the super admin. Fails loudly if that account cannot be
 *  found rather than picking a different one. */
async function fixtureUser(): Promise<{ id: string; email: string }> {
  const service = stagingService();
  const { data: users, error } = await service
    .from('user')
    .select('email')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw new Error(`e2e: fixture user lookup: ${error.message}`);
  const email = String(users?.[0]?.email ?? '');
  if (!email) throw new Error('e2e: no platform user row on staging');
  const auth = await authUserByEmailPaged(email);
  if (!auth || !auth.confirmed) {
    throw new Error(`e2e: the oldest platform user (${email}) has no confirmed auth account`);
  }
  return { id: auth.id, email: auth.email };
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

/**
 * Wait until React has actually attached to the page.
 *
 * `waitForURL` means the document arrived, not that the app is alive. Until
 * hydration runs, what you are looking at is server HTML: state-driven
 * content is missing and nothing responds. On 2026-10-04 that cost most of a
 * day — a contenteditable bio editor read as EMPTY because React renders no
 * children into it on the server, and the measurement was taken before the
 * client filled it. It was reported as a data-loss bug, a release was jumped
 * to fix it, and there was nothing wrong.
 *
 * So every signed-in spec waits for this. The signal is a React fiber on a
 * real element, not a sleep: a timeout is a guess that passes on a fast day
 * and fails on a slow one.
 *
 * PASS A SELECTOR when you are about to measure one particular thing. In the
 * App Router each client tree hydrates on its own, so "something on this page
 * has a fiber" can be true while the component you care about has not
 * attached yet — the page chrome is alive long before a settings form is.
 * Waiting on the element you are going to read is the only wait that means
 * what you want it to mean.
 */
export async function waitForHydration(
  page: import('@playwright/test').Page,
  selector = 'input, button, a, [contenteditable]',
  timeout = 20_000,
): Promise<void> {
  await page.waitForFunction(
    (sel) => {
      for (const el of document.querySelectorAll(sel)) {
        for (const k in el) if (k.startsWith('__react')) return true;
      }
      return false;
    },
    selector,
    { timeout },
  );
}

/**
 * Sign in and arrive at `next`, retrying ONCE when the landing did not take.
 * Found 2026-09-15: with two spec files signing the same fixture user in at
 * the same moment, one land occasionally ended signed out on the marketing
 * page — alone, the same spec passed three runs out of three. The retry is
 * logged, so a land that fails for a real reason still fails, loudly, twice.
 */
export async function landSignedIn(
  page: import('@playwright/test').Page,
  host: string,
  targetApp: string,
  next: string,
  arrived: RegExp,
): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(await signedInLandUrl(host, targetApp, next));
    try {
      await page.waitForURL(arrived, { timeout: 30_000 });
      // Arriving is not being alive. Every caller of this helper assumes it
      // can look at the page and believe what it sees.
      await waitForHydration(page);
      return;
    } catch (e) {
      if (attempt === 2) throw e;
      console.warn(`e2e: sign-in landed on ${page.url()} instead of ${next}; retrying once`);
    }
  }
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
  const u = await authUserByEmailPaged(email);
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

  // ONE permanent workspace, reused per run: the enrol flow writes activity,
  // activity is append-only (DB trigger, service role included), so a
  // workspace that hosted an enrolment can never be hard-deleted. Content
  // is cleaned per run; persons are soft-deleted.
  let wsId: string;
  const { data: existingWs } = await service
    .from('workspace')
    .select('id')
    .eq('slug', 'e2e-enrol-fixtures')
    .maybeSingle();
  if (existingWs) {
    wsId = existingWs.id as string;
  } else {
    const { data: created, error: wErr } = await service
      .from('workspace')
      .insert({ slug: 'e2e-enrol-fixtures', name: 'Permanent E2E fixtures (activity is append-only)' })
      .select('id')
      .single();
    if (wErr) throw new Error(`e2e workspace: ${wErr.message}`);
    wsId = created.id as string;
  }
  const ws = { id: wsId };

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
    const must = (label: string) => (r: { error: { message: string } | null }) => {
      if (r.error) console.error(`[e2e cleanup] ${label}: ${r.error.message}`);
    };
    must('thread_enrolment')(await service.from('thread_enrolment').delete().eq('thread_id', thread.id));
    must('enrolment')(await service.from('enrolment').delete().eq('program_id', program.id));
    for (const email of participantEmails) {
      // Soft-delete: their activity rows are append-only and pin them.
      must('person soft-delete')(
        await service
          .from('person')
          .update({ deleted_at: new Date().toISOString() })
          .eq('workspace_id', ws.id)
          .eq('email', email),
      );
      must('user')(await service.from('user').delete().eq('workspace_id', ws.id).eq('email', email));
      const { data: listed } = await service.auth.admin.listUsers({ perPage: 100 });
      const au = listed?.users.find((a) => a.email?.toLowerCase() === email.toLowerCase());
      if (au) await service.auth.admin.deleteUser(au.id).catch(() => undefined);
    }
    must('thread_thread')(await service.from('thread_thread').delete().eq('id', thread.id));
    must('thread_organiser')(await service.from('thread_organiser').delete().eq('id', org.id));
    must('program')(await service.from('program').delete().eq('id', program.id));
    must('user')(await service.from('user').delete().eq('id', urow.id));
    // The workspace stays — permanent by design (append-only activity).
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
