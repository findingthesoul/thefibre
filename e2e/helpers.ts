// E2E plumbing: staging hosts + the session mint.
//
// Signed-in tests ride the SSO-handoff landing route: we insert a
// single-use code into the staging DB (service role) for an EXISTING
// staging user, then point the browser at /sso/land?code=… — the app
// redeems it server-side and sets its own session cookies, exactly as a
// real cross-apex hop does. No password, no OTP inbox, no cookie forgery.

import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  E2E_UPCOMING,
  ensureFixtureIdentity,
  ensureFixtureThread,
  ensureMemberIdentity,
  resolveOwnerIdentity,
  type FixtureThread,
  type Identity,
} from './identities.js';

export const HOSTS = {
  fibre: 'https://thefibre.tech',
  meet: 'https://meet.thefibre.tech',
  thread: 'https://thread.thefibre.tech',
  flow: 'https://flow.thefibre.tech',
  pulse: 'https://pulse.thefibre.tech',
  membership: 'https://membership.thefibre.tech',
  /** The participant portal. Not an app with seats — a member signs in here
   *  with an address some community knows, which is why the directory switch
   *  lives here and not in the Members app. */
  my: 'https://my.thefibre.tech',
  models: 'https://models.thefibre.tech',
};

let cached: SupabaseClient | null = null;
/** The project stagingService() connected to; handed to the fixture's guard. */
let stagingUrl = '';
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
  stagingUrl = url;
  cached = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/**
 * The fixture identity, for a spec that needs to SEED against it — a
 * workspace id to hang rows on, or the address a person row must carry.
 *
 * Exists so no spec has to know the project URL the guard checks. That URL is
 * private to this module on purpose: `assertStagingProject` is what stands
 * between a seeding spec and production, and a guard is only as good as the
 * number of places that can supply its argument.
 */
export async function fixtureIdentity(): Promise<Identity> {
  const service = stagingService();
  return ensureFixtureIdentity(service, stagingUrl);
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

// WHO signs in: e2e/identities.ts. The default is the FIXTURE account, which
// is nobody; the owner of the `default` workspace is available by name, for
// the three read-only specs that need that workspace's real data. This used
// to be "the oldest confirmed account on staging", which is a real person.

/** Mint a single-use handoff code and return the land URL that signs the
 *  browser in on `host` (60s TTL — navigate promptly). */
export async function signedInLandUrl(
  host: string,
  targetApp: string,
  next = '/dashboard',
): Promise<string> {
  return signedInLandUrlFor(host, targetApp, await ensureFixtureIdentity(stagingService(), stagingUrl), next);
}

/**
 * The same, as the OWNER of the `default` workspace. READ-ONLY SPECS ONLY,
 * and only the ones on the allow-list in scripts/e2e-identities.test.mjs,
 * which fails the release gate for anybody else. The sign-in itself writes
 * one sso_handoff row and Supabase Auth's session records, nothing more;
 * what the spec does afterwards must write nothing at all.
 */
export async function ownerLandUrl(host: string, targetApp: string, next = '/dashboard'): Promise<string> {
  return signedInLandUrlFor(host, targetApp, await resolveOwnerIdentity(stagingService()), next);
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
 * Wait until nothing on the page says it is still loading.
 *
 * WAIT FOR THE STATE, NOT FOR THE TEXT. A list that fills client-side (every
 * Invoices page: hydrate, server action, API, render) is not ready when the
 * route arrives, so a spec that asserts a row's text is really racing the
 * fetch against Playwright's five-second text budget. That race is what made
 * `admin-screens` flaky — it failed once "waiting on an invoice row", passed
 * on retry, and taught whoever saw it to re-run the suite.
 *
 * A bigger text timeout is the wrong fix twice over: it still fails slowly
 * when the row is genuinely missing (20 seconds to learn the list is empty),
 * and it leaves the test green for the wrong reason when the row arrives at
 * second nineteen of a load that should take one.
 *
 * `aria-busy="true"` is this codebase's own convention for a region that is
 * still loading — `ui/invoices.tsx`, `ui/page-loading.tsx`, Thread's
 * registrations dialog and pricing panel all carry it. When none is left, the
 * fetch is DONE: the row is either there or it is not, and the assertion
 * after this call says which, immediately and truthfully.
 *
 * Measured on staging 2026-10-12: the busy region appears on every run and
 * clears in 280–800ms warm. One landing in six took 5.8 seconds, which is
 * the shape of the cold start a 5s budget loses to.
 */
export async function waitForListLoaded(
  page: import('@playwright/test').Page,
  timeout = 45_000,
): Promise<void> {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout });
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
  return land(page, () => signedInLandUrl(host, targetApp, next), next, arrived);
}

/**
 * The MEMBER fixture: the same workspace and the same seats as the default
 * fixture, at a non-admin workspace role. For the other side of a role
 * branch — a disabled form, a hidden action, a read that is allowed anyway.
 *
 * A fixture, not a person: nothing here needs anybody's permission, and the
 * two accounts differ in exactly one column.
 */
export async function memberLandUrl(host: string, targetApp: string, next = '/dashboard'): Promise<string> {
  return signedInLandUrlFor(host, targetApp, await ensureMemberIdentity(stagingService(), stagingUrl), next);
}

/** landSignedIn as the MEMBER fixture (non-admin). */
export async function landSignedInAsMember(
  page: import('@playwright/test').Page,
  host: string,
  targetApp: string,
  next: string,
  arrived: RegExp,
): Promise<void> {
  return land(page, () => memberLandUrl(host, targetApp, next), next, arrived);
}

/** The fixture's own thread (id, its session, and a person to search for),
 *  so a spec about organiser screens needs nobody's real data. */
export async function fixtureThread(): Promise<FixtureThread> {
  const service = stagingService();
  return ensureFixtureThread(service, stagingUrl);
}

/** landSignedIn as the OWNER — see ownerLandUrl for who may call this. */
export async function landSignedInAsOwner(
  page: import('@playwright/test').Page,
  host: string,
  targetApp: string,
  next: string,
  arrived: RegExp,
): Promise<void> {
  return land(page, () => ownerLandUrl(host, targetApp, next), next, arrived);
}

async function land(
  page: import('@playwright/test').Page,
  url: () => Promise<string>,
  next: string,
  arrived: RegExp,
): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(await url());
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

/**
 * Sign the browser in as the two-community member (E2E_UPCOMING) and open a
 * my.thread page.
 *
 * The portal serves no /sso/land of its own; the session is minted on the
 * Thread host and carried to my.* on the shared auth cookie — the way
 * portal-members-list does it. This account holds no Thread seat, so the
 * land itself ends on whatever Thread shows a participant; only the cookie
 * matters, and the portal page is asserted by the caller.
 */
export async function landPortalAsUpcoming(page: import('@playwright/test').Page, next: string): Promise<void> {
  const user = await authUserByEmail(E2E_UPCOMING.email).catch(() => {
    throw new Error(
      `e2e: ${E2E_UPCOMING.email} has no account — run apps/api/scripts/seed-upcoming-fixture.mjs --email upcoming-fixture@example.com,${E2E_UPCOMING.email}`,
    );
  });
  await page.goto(await signedInLandUrlFor(HOSTS.thread, 'the-thread', user, '/'));
  await page.waitForLoadState('networkidle');
  await page.goto(`${HOSTS.my}${next}`);
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

/**
 * Remove throwaway workspaces a browser spec made, and SAY when it could not.
 *
 * Every spec that signs a fixture in and then deletes its workspace needs the
 * same list of pins, and the list is not guessable. On 2026-10-11 a new spec
 * discarded its delete results and left FIFTEEN workspaces standing on
 * staging; the same cleanup shape was in no-access.spec.ts. Three pins did
 * it, and the first two are the ones nobody expects:
 *
 *   * `sso_match_log` — written when a session lands through /sso/land, which
 *     is how every browser spec here signs in. It references `user(id)`, and
 *     `deleteThrowawayWorkspace` (apps/api/src/integration/staging.ts) does
 *     NOT clear it, because the integration fixtures never sign in that way.
 *     So this pin is specific to the Playwright suite.
 *   * `organisation` — created BY TRIGGER with every workspace since
 *     20260915060000. `workspace.organisation_id` is ON DELETE SET NULL, but
 *     `organisation.workspace_id` points back and holds the workspace.
 *   * `user` ⇄ `person` — they reference each other, so neither can go
 *     first: cut `user.person_id`, remove the persons, then the users.
 *
 * A leak is not cosmetic. The five-minute schedulers walk every workspace on
 * staging; 406 abandoned ones once took the workspace-admins audit from 4.6 s
 * to 331 s.
 *
 * THROWS with everything that was left behind, rather than returning a
 * boolean nobody reads — the mistake that let the leak run. Call it from
 * afterAll in a way that still cleans every fixture before it reports (a
 * sequential `await cleanup(a); await cleanup(b)` skips b when a throws).
 */
export async function removeThrowawayWorkspaces(opts: {
  workspaceIds: string[];
  userIds: string[];
  authUserIds: string[];
}): Promise<void> {
  const service = stagingService();
  const wsIds = opts.workspaceIds.filter(Boolean);
  const userIds = opts.userIds.filter(Boolean);
  if (!wsIds.length) return;
  const left: string[] = [];
  const go = async (what: string, r: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await r;
    if (error) left.push(`${what}: ${error.message}`);
  };

  if (userIds.length) {
    await go('app_membership', service.from('app_membership').delete().in('user_id', userIds));
    await go('workspace_member', service.from('workspace_member').delete().in('user_id', userIds));
    await go('sso_match_log', service.from('sso_match_log').delete().in('user_id', userIds));
    await go('unlink person', service.from('user').update({ person_id: null }).in('id', userIds));
  }
  for (const id of wsIds) {
    await go('person_merge', service.from('person_merge').delete().eq('workspace_id', id));
    await go('person', service.from('person').delete().eq('workspace_id', id));
  }
  if (userIds.length) await go('user', service.from('user').delete().in('id', userIds));
  for (const authId of opts.authUserIds.filter(Boolean)) {
    const r = await service.auth.admin.deleteUser(authId);
    if (r.error) left.push(`auth user: ${r.error.message}`);
  }
  await go('workspace_app', service.from('workspace_app').delete().in('workspace_id', wsIds));
  await go('organisation', service.from('organisation').delete().in('workspace_id', wsIds));
  await go('workspace', service.from('workspace').delete().in('id', wsIds));

  // Read back. "No error" is not "gone": a delete that matches nothing
  // returns no error at all, which is how a silent leak looks from here.
  const { data: still } = await service.from('workspace').select('slug').in('id', wsIds);
  if (still?.length) left.push(`workspaces still standing: ${still.map((w) => w.slug).join(', ')}`);
  if (left.length) {
    throw new Error(`throwaway fixtures were NOT fully removed from staging:\n  ${left.join('\n  ')}`);
  }
}

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
