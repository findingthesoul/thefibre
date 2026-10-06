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
import { afterAll } from 'vitest';

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
  trackThrowawayWorkspace(data.id as string, slug);
  return data.id as string;
}

// ---------------------------------------------------------------------------
// Every throwaway workspace a test file makes must be gone when the file
// ends. This is the check that was missing: registered here, at import, so it
// is the FIRST afterAll of every file that uses this harness and therefore
// the LAST to run (vitest unwinds hooks as a stack) — after the file's own
// cleanup has had its turn. It asks the database, and a workspace that is
// still there fails the file by name.
//
// It tracks ids, not a slug pattern, on purpose: several sessions run this
// suite against the same staging database at once, and a count of
// `int-test-%` would blame one run for another's fixtures in flight.
// ---------------------------------------------------------------------------
const throwaway = new Map<string, string>();

/** For a test that inserts its own workspace instead of using the helper. */
export function trackThrowawayWorkspace(id: string, slug: string): void {
  throwaway.set(id, slug);
}

afterAll(async () => {
  if (throwaway.size === 0) return;
  const { data, error } = await service.from('workspace').select('id, slug').in('id', [...throwaway.keys()]);
  if (error) throw new Error(`fixture check: could not ask staging what is left: ${error.message}`);
  if (data && data.length > 0) {
    throw new Error(
      `this file left ${data.length} throwaway workspace(s) on staging: ` +
        `${data.map((w) => w.slug).join(', ')}. Its cleanup ran and did not remove them — ` +
        `something still references the workspace. Run the file alone and read the ` +
        `[fixtures] lines above for the constraint.`,
    );
  }
});

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

// Cleanup that SAYS when it did not clean.
//
// Both helpers below discarded their result until 2026-10-01, and the suite
// was green the whole time. Meanwhile, since 2026-09-15 — the day migration
// 20260915060000 gave every workspace its own organisation, behind a foreign
// key that does not cascade — `delete from workspace` had been refused for
// EVERY throwaway workspace of EVERY run: 406 of them stood on staging, the
// five-minute schedulers walked all of them, and the workspace-admins audit
// took 331 s there against 4.6 s on production. Nothing reported it, because
// the one statement that could was `await …delete()` with nobody reading the
// answer. So: remove what pins the row, then read the answer.

export async function deleteFixtureUser(u: FixtureUser): Promise<void> {
  const row = await service.from('user').delete().eq('id', u.userId);
  if (row.error) console.warn(`[fixtures] user ${u.email} was NOT removed: ${row.error.message}`);
  const auth = await service.auth.admin.deleteUser(u.authUserId);
  if (auth.error) console.warn(`[fixtures] auth user ${u.email} was NOT removed: ${auth.error.message}`);
}

/**
 * Remove a throwaway workspace and report whether it went.
 *
 * Says why when it could not; the file-level check above is what fails the
 * run. (A workspace an enrolment touched is pinned for good by its
 * append-only `activity` rows — such a test belongs in the permanent fixture
 * workspace below, not in a throwaway one.)
 */
export async function deleteThrowawayWorkspace(id: string): Promise<boolean> {
  const name = throwaway.get(id) ?? id;
  const say = (what: string, r: { error: { message: string } | null }) => {
    if (r.error) console.warn(`[fixtures] workspace ${name}: ${what}: ${r.error.message}`);
  };
  // What a workspace can still hold after a test's own cleanup, in the order
  // the foreign keys allow. All of it belongs to a workspace that is about to
  // be removed whole, so none of it is anybody's data.
  //
  // user ⇄ person point at each other (user.person_id, person.user_id), so
  // neither can be deleted first: cut one side, then remove both.
  say('unlinking users from persons', await service.from('user').update({ person_id: null }).eq('workspace_id', id));
  say('persons NOT removed', await service.from('person').delete().eq('workspace_id', id));
  say('users NOT removed', await service.from('user').delete().eq('workspace_id', id));
  // The workspace's own organisation, created by trigger with the workspace.
  // workspace.organisation_id is ON DELETE SET NULL, so the row lets go.
  say('organisations NOT removed', await service.from('organisation').delete().eq('workspace_id', id));
  const ws = await service.from('workspace').delete().eq('id', id).select('id');
  if (ws.error) {
    console.warn(`[fixtures] workspace ${name} was NOT removed: ${ws.error.message}`);
    return false;
  }
  return (ws.data?.length ?? 0) === 1;
}

/** Throwaway workspaces still standing, oldest first — by the suite's own prefix. */
export async function leakedThrowawayWorkspaces(): Promise<{ id: string; slug: string; created_at: string }[]> {
  const { data, error } = await service
    .from('workspace')
    .select('id, slug, created_at')
    .like('slug', 'int-test-%')
    .order('created_at');
  if (error) throw new Error(`leaked workspaces: ${error.message}`);
  return (data ?? []) as { id: string; slug: string; created_at: string }[];
}

/** Decode a fixture session's JWT claims (no verification — staging is the oracle). */
export function jwtClaims(u: FixtureUser): Record<string, unknown> {
  const payload = u.accessToken.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(payload, 'base64url').toString() || '{}');
}

// ---------------------------------------------------------------------------
// Public-thread fixture (v0.58.0): the minimum viable PUBLISHED thread — a
// throwaway workspace, an organiser (user row only; no session needed), an
// ACTIVE program and a public-listed thread with NO tickets, so the public
// enrol route takes the free path. Unlocks the enrolment golden paths
// without touching the rehearsal workspace's Stripe rig.
// ---------------------------------------------------------------------------

export type PublicThreadFixture = {
  workspaceId: string;
  userRowId: string;
  organiserId: string;
  organiserSlug: string;
  programId: string;
  threadId: string;
  threadSlug: string;
  title: string;
};

/**
 * Enrolment fixtures live in ONE permanent workspace, reused per run.
 * The enrol flow writes `activity` rows, and activity is append-only —
 * enforced by a DB trigger even against the service role — so a workspace
 * that ever hosted an enrolment can NEVER be hard-deleted (learned
 * 2026-09-07: seven throwaway shells had to be retired in place). Content
 * is cleaned per run; persons are soft-deleted (their activity pins them).
 */
export const ENROL_FIXTURE_WS_SLUG = 'int-enrol-fixtures';

export async function getPermanentFixtureWorkspace(slug: string): Promise<string> {
  const { data: existing } = await service
    .from('workspace')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await service
    .from('workspace')
    .insert({ slug, name: 'Permanent test fixtures (activity is append-only)' })
    .select('id')
    .single();
  if (error) throw new Error(`permanent fixture workspace: ${error.message}`);
  return data.id as string;
}

export async function createPublicThreadFixture(tag: string): Promise<PublicThreadFixture> {
  const t = tag.toLowerCase();
  const rand = randomUUID().slice(0, 8);
  const workspaceId = await getPermanentFixtureWorkspace(ENROL_FIXTURE_WS_SLUG);

  const { data: urow, error: uErr } = await service
    .from('user')
    .insert({ workspace_id: workspaceId, email: `int-${t}-org-${rand}@example.com` })
    .select('id')
    .single();
  if (uErr) throw new Error(`fixture user: ${uErr.message}`);

  const { data: app } = await service.from('app').select('id').eq('slug', 'the-thread').single();

  const { data: program, error: pErr } = await service
    .from('program')
    .insert({
      workspace_id: workspaceId,
      app_id: app!.id,
      title: `Integration journey ${rand}`,
      format: 'journey',
      status: 'active',
    })
    .select('id, title')
    .single();
  if (pErr) throw new Error(`fixture program: ${pErr.message}`);

  const organiserSlug = `int-org-${rand}`;
  const { data: org, error: oErr } = await service
    .from('thread_organiser')
    .insert({
      user_id: urow.id,
      workspace_id: workspaceId,
      slug: organiserSlug,
      display_name: 'Integration Organiser',
    })
    .select('id')
    .single();
  if (oErr) throw new Error(`fixture organiser: ${oErr.message}`);

  const threadSlug = `int-thread-${rand}`;
  const { data: thread, error: tErr } = await service
    .from('thread_thread')
    .insert({
      workspace_id: workspaceId,
      program_id: program.id,
      organiser_id: org.id,
      slug: threadSlug,
      intention: 'Prove the free enrolment path end to end.',
      is_public_listed: true,
    })
    .select('id')
    .single();
  if (tErr) throw new Error(`fixture thread: ${tErr.message}`);

  return {
    workspaceId,
    userRowId: urow.id as string,
    organiserId: org.id as string,
    organiserSlug,
    programId: program.id as string,
    threadId: thread.id as string,
    threadSlug,
    title: program.title as string,
  };
}

/**
 * Retire the people an enrolment made in a PERMANENT fixture workspace: the
 * person is soft-deleted (its `activity` rows pin it for good), the account
 * that enrolling auto-created is removed, and so is its sign-in identity.
 *
 * Any test that enrols somebody belongs in a permanent workspace and ends
 * with this. Two files used a throwaway workspace instead and left it behind
 * on every run — 64 of the 406 that stood on staging on 2026-10-01.
 */
export async function retireParticipants(workspaceId: string, emails: string[]): Promise<void> {
  const must = (label: string) => (r: { error: { message: string } | null }) => {
    if (r.error) console.error(`[fixture cleanup] ${label}: ${r.error.message}`);
  };
  for (const email of emails) {
    must('person soft-delete')(
      await service
        .from('person')
        .update({ deleted_at: new Date().toISOString() })
        .eq('workspace_id', workspaceId)
        .eq('email', email),
    );
    must('user')(await service.from('user').delete().eq('workspace_id', workspaceId).eq('email', email));
    const { data: listed } = await service.auth.admin.listUsers({ perPage: 1000 });
    const au = listed?.users.find((a) => a.email?.toLowerCase() === email.toLowerCase());
    if (au) await service.auth.admin.deleteUser(au.id).catch(() => undefined);
  }
}

/** Clean the fixture's CONTENT out of the permanent workspace. Persons are
 *  soft-deleted (activity is append-only and pins them — hard delete is
 *  impossible by design); everything else goes. Errors are surfaced, not
 *  swallowed — a silent teardown failure is how seven shells leaked. */
export async function cleanupPublicThreadFixture(
  f: PublicThreadFixture,
  participantEmails: string[] = [],
): Promise<void> {
  const must = (label: string) => (r: { error: { message: string } | null }) => {
    if (r.error) console.error(`[fixture cleanup] ${label}: ${r.error.message}`);
  };
  must('thread_enrolment')(await service.from('thread_enrolment').delete().eq('thread_id', f.threadId));
  must('enrolment')(await service.from('enrolment').delete().eq('program_id', f.programId));
  await retireParticipants(f.workspaceId, participantEmails);
  must('thread_thread')(await service.from('thread_thread').delete().eq('id', f.threadId));
  must('thread_organiser')(await service.from('thread_organiser').delete().eq('id', f.organiserId));
  must('program')(await service.from('program').delete().eq('id', f.programId));
  must('organiser user')(await service.from('user').delete().eq('id', f.userRowId));
  // The workspace stays — permanent by design (append-only activity).
}

// ---------------------------------------------------------------------------
// A Meet host with one meeting type (2026-10-06).
//
// Meet had no fixture at all, which is why the reschedule fix in v1.110.2
// shipped with unit tests and no end-to-end proof. The approval rules are not
// something to ship that way twice: whether a request awaiting a host's
// answer holds its slot is a question only a real booking against a real
// endpoint can answer.
//
// The meeting type is a ONE-OFF on purpose. A one-off is its own single slot,
// so a booking against it needs no working hours, no Google token and no
// availability generation — the only thing standing between two invitees and
// the same seat is the capacity count, which is exactly the filter under
// test. Nothing here is a real person; the addresses are @example.com.
//
// It lives in a PERMANENT workspace, like the thread fixtures, and for the
// same reason: booking somebody writes an `activity` row, activity is
// append-only (hard rule 5, enforced by a trigger), the row pins the person,
// and the person pins the workspace. A throwaway workspace here cannot be
// thrown away — the first version of this fixture used one and leaked it,
// which the harness caught by name.
// ---------------------------------------------------------------------------

export const MEET_FIXTURE_WS_SLUG = 'int-meet-fixtures';

export type MeetFixture = {
  workspaceId: string;
  userRowId: string;
  hostId: string;
  hostSlug: string;
  hostEmail: string;
  meetingTypeId: string;
  /** The one-off's single slot, as ISO — a booking must match it exactly. */
  startsAt: string;
  endsAt: string;
};

export async function createMeetFixture(
  tag: string,
  opts: { requiresApproval?: boolean; capacity?: number } = {},
): Promise<MeetFixture> {
  const workspaceId = await getPermanentFixtureWorkspace(MEET_FIXTURE_WS_SLUG);
  const hostEmail = `int-meet-${tag.toLowerCase()}-${randomUUID().slice(0, 8)}@example.com`;
  const { data: userRow, error: uErr } = await service
    .from('user')
    .insert({ workspace_id: workspaceId, email: hostEmail, full_name: 'Int Meet Host' })
    .select('id')
    .single();
  if (uErr || !userRow) throw new Error(`meet fixture user: ${uErr?.message}`);

  const hostSlug = `int-meet-${randomUUID().slice(0, 8)}`;
  const { data: host, error: hErr } = await service
    .from('meet_host')
    .insert({
      user_id: userRow.id,
      workspace_id: workspaceId,
      slug: hostSlug,
      timezone: 'Europe/Amsterdam',
      requires_approval: false,
    })
    .select('id')
    .single();
  if (hErr || !host) throw new Error(`meet fixture host: ${hErr?.message}`);

  // Far enough out that min_notice can never be the reason a booking is
  // refused, and on a fixed minute so the equality check is exact.
  const startsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  startsAt.setUTCSeconds(0, 0);
  startsAt.setUTCMinutes(0);
  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

  const { data: mt, error: mErr } = await service
    .from('meet_meeting_type')
    .insert({
      workspace_id: workspaceId,
      host_id: host.id,
      slug: 'int-one-off',
      name: 'Integration one-off (do not edit)',
      duration_minutes: 30,
      event_type: 'one_off',
      capacity: opts.capacity ?? 1,
      fixed_starts_at: startsAt.toISOString(),
      fixed_ends_at: endsAt.toISOString(),
      requires_approval: opts.requiresApproval ?? false,
      conferencing_provider: 'none',
      min_notice_minutes: 0,
    })
    .select('id')
    .single();
  if (mErr || !mt) throw new Error(`meet fixture meeting type: ${mErr?.message}`);

  return {
    workspaceId,
    userRowId: userRow.id as string,
    hostId: host.id as string,
    hostSlug,
    hostEmail,
    meetingTypeId: mt.id as string,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}

export async function cleanupMeetFixture(
  f: MeetFixture,
  inviteeEmails: string[] = [],
): Promise<void> {
  const must = (label: string) => (r: { error: { message: string } | null }) => {
    if (r.error) console.error(`[fixture cleanup] ${label}: ${r.error.message}`);
  };
  must('meet_booking')(
    await service.from('meet_booking').delete().eq('meeting_type_id', f.meetingTypeId),
  );
  must('meet_meeting_type')(
    await service.from('meet_meeting_type').delete().eq('id', f.meetingTypeId),
  );
  must('meet_host')(await service.from('meet_host').delete().eq('id', f.hostId));
  // The invitees the booking endpoint created on the way in. Soft-deleted,
  // not removed: their activity rows cannot be deleted, so neither can they.
  await retireParticipants(f.workspaceId, inviteeEmails);
  must('host user')(await service.from('user').delete().eq('id', f.userRowId));
  // The workspace stays — permanent by design, for the reason above.
}

// ---------------------------------------------------------------------------
// The PERMANENT public organiser fixture (2026-10-02).
//
// Staging held no organiser a browser or a probe could look at: every public
// address there resolved to a workspace, so a change to the public organiser
// page could not be checked on staging at all, and a release that could not
// be probed was about to be filed as "no visible change". This is one
// organiser that is always there:
//
//   https://thread.thefibre.tech/fixture-organiser
//   https://thefibre-api-staging.fly.dev/api/v1/thread/public/organiser/fixture-organiser
//   …/api/v1/thread/public/organiser/fixture-organiser/thread/fixture-thread
//
// IT IS SHAPED LIKE THE BUG IT EXISTS TO CATCH. The name and the bio live on
// the PROFILE (`identity_profile`, keyed on email) and the `thread_organiser`
// row's own display_name / bio / photo_url are NULL — and are put back to
// NULL on every run. That is how a real organiser's data is stored since
// 20260901160000, and it is what the public page did not read until v1.98.8:
// an image that only reads the organiser row answers this fixture with a
// null name. Fill the organiser row "to be helpful" and the fixture answers
// the same on the old code and the new, and proves nothing.
//
// Idempotent: looked up by its fixed keys, created only when missing, never
// duplicated, never deleted. No real person: the address is @example.com and
// the name says what it is. It lives in its own permanent workspace so that
// no other test's cleanup can reach it.
// ---------------------------------------------------------------------------

export const PUBLIC_FIXTURE = {
  workspaceSlug: 'int-public-fixtures',
  email: 'fixture-organiser@example.com',
  organiserSlug: 'fixture-organiser',
  displayName: 'Fixture Organiser (do not edit)',
  // TWO paragraphs, a blank line between them, on purpose: the paragraph
  // split in bioToHtml is then exercised on a deployed stack, not only in its
  // unit tests. The public payload must show two <p> elements.
  bio: 'A permanent test fixture on staging. Nobody real.\n\nThe name and this text live on the profile, not on the organiser row, on purpose.',
  programTitle: 'Fixture journey (do not edit)',
  threadSlug: 'fixture-thread',
} as const;

export type PublicOrganiserFixture = {
  workspaceId: string;
  userId: string;
  organiserId: string;
  programId: string;
  threadId: string;
};

export async function ensurePublicOrganiserFixture(): Promise<PublicOrganiserFixture> {
  const F = PUBLIC_FIXTURE;
  const need = <T>(what: string, r: { data: T | null; error: { message: string } | null }): T | null => {
    if (r.error) throw new Error(`public fixture: ${what}: ${r.error.message}`);
    return r.data;
  };
  const workspaceId = await getPermanentFixtureWorkspace(F.workspaceSlug);

  // The seat.
  let user = need('user', await service.from('user').select('id').eq('workspace_id', workspaceId).eq('email', F.email).maybeSingle());
  if (!user) {
    user = need('user insert', await service.from('user').insert({ workspace_id: workspaceId, email: F.email }).select('id').single());
  }
  const userId = user!.id as string;

  // The profile: where the name and the bio LIVE.
  need(
    'identity_profile',
    await service
      .from('identity_profile')
      .upsert({ email: F.email, display_name: F.displayName, bio: F.bio, photo_url: null }, { onConflict: 'email' })
      .select('email')
      .single(),
  );

  // The organiser: slug only. Its own name, bio and photo are NULL and stay NULL.
  let organiser = need('organiser', await service.from('thread_organiser').select('id').eq('slug', F.organiserSlug).maybeSingle());
  if (!organiser) {
    organiser = need(
      'organiser insert',
      await service.from('thread_organiser').insert({ user_id: userId, workspace_id: workspaceId, slug: F.organiserSlug }).select('id').single(),
    );
  }
  const organiserId = organiser!.id as string;
  need(
    'organiser reset',
    await service.from('thread_organiser').update({ display_name: null, bio: null, photo_url: null }).eq('id', organiserId).select('id').single(),
  );

  // One public thread, so the page lists something.
  const { data: app } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  let program = need('program', await service.from('program').select('id').eq('workspace_id', workspaceId).eq('title', F.programTitle).maybeSingle());
  if (!program) {
    program = need(
      'program insert',
      await service
        .from('program')
        .insert({ workspace_id: workspaceId, app_id: app!.id, title: F.programTitle, format: 'journey', status: 'active' })
        .select('id')
        .single(),
    );
  }
  const programId = program!.id as string;

  let thread = need('thread', await service.from('thread_thread').select('id').eq('organiser_id', organiserId).eq('slug', F.threadSlug).maybeSingle());
  if (!thread) {
    thread = need(
      'thread insert',
      await service
        .from('thread_thread')
        .insert({
          workspace_id: workspaceId,
          program_id: programId,
          organiser_id: organiserId,
          slug: F.threadSlug,
          intention: 'A permanent fixture thread, so the fixture organiser has something to list.',
          is_public_listed: true,
          public_scope: 'personal',
        })
        .select('id')
        .single(),
    );
  }
  return { workspaceId, userId, organiserId, programId, threadId: thread!.id as string };
}
