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

export async function createPublicThreadFixture(tag: string): Promise<PublicThreadFixture> {
  const t = tag.toLowerCase();
  const rand = randomUUID().slice(0, 8);
  const workspaceId = await createThrowawayWorkspace(t);

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

/** Tear the fixture down, including whatever the enrol flow auto-created
 *  (thread enrolments, platform enrolments, persons, users, auth accounts
 *  for the given participant emails). */
export async function cleanupPublicThreadFixture(
  f: PublicThreadFixture,
  participantEmails: string[] = [],
): Promise<void> {
  await service.from('thread_enrolment').delete().eq('thread_id', f.threadId);
  await service.from('enrolment').delete().eq('program_id', f.programId);
  for (const email of participantEmails) {
    const { data: persons } = await service
      .from('person')
      .select('id')
      .eq('workspace_id', f.workspaceId)
      .eq('email', email);
    for (const p of persons ?? []) {
      await service.from('activity').delete().eq('person_id', p.id);
      await service.from('person').delete().eq('id', p.id);
    }
    await service.from('user').delete().eq('workspace_id', f.workspaceId).eq('email', email);
    const { data: listed } = await service.auth.admin.listUsers({ perPage: 100 });
    const au = listed?.users.find((a) => a.email?.toLowerCase() === email.toLowerCase());
    if (au) await service.auth.admin.deleteUser(au.id).catch(() => undefined);
  }
  await service.from('thread_thread').delete().eq('id', f.threadId);
  await service.from('thread_organiser').delete().eq('id', f.organiserId);
  await service.from('program').delete().eq('id', f.programId);
  await service.from('user').delete().eq('id', f.userRowId);
  await deleteThrowawayWorkspace(f.workspaceId);
}
