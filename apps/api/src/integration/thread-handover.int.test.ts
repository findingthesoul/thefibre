// Handing a thread to another organiser — the tests the design owes
// (docs/organiser-handover-design.md, "Tests the build owes").
//
// Real routes, in process, against staging's database: three seated fixture
// users in a throwaway workspace — Anna (the organiser), Ben (the new one)
// and Cleo (a workspace admin). One free personal-scope thread with a future
// session in Anna's personal room and one past card sale that does not
// record its Stripe account; one paid thread for the payment check.
//
// Nothing here writes `activity`, so the workspace can be deleted whole.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import {
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  service,
  type FixtureUser,
} from './staging.js';

let app: Hono;
let ws = '';
let anna: FixtureUser;
let ben: FixtureUser;
let cleo: FixtureUser;
let annaOrg = '';
let annaSlug = '';
let threadId = '';
let threadSlug = '';
let paidThreadId = '';
let engagementId = '';
let purchaseId = '';
const ANNA_ROOM = `https://example.zoom.us/j/anna${Date.now()}`;
const BEN_ROOM = `https://example.zoom.us/j/ben${Date.now()}`;
const OLD_ACCOUNT = `acct_int_anna_${randomUUID().slice(0, 6)}`;

const call = (who: FixtureUser, method: string, path: string, body?: unknown) =>
  app.request(`/api/v1/thread${path}`, {
    method,
    headers: { Authorization: `Bearer ${who.accessToken}`, 'X-App-ID': 'the-thread', 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

async function seat(u: FixtureUser, role: 'admin' | 'organiser') {
  const { error } = await service.from('workspace_member').insert({ workspace_id: ws, user_id: u.userId, workspace_role: role });
  if (error) throw new Error(`workspace_member: ${error.message}`);
  const { data: a } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  const r = await service
    .from('app_membership')
    .upsert({ user_id: u.userId, app_id: a!.id, role: 'admin', is_direct: true }, { onConflict: 'user_id,app_id' });
  if (r.error) throw new Error(`app_membership: ${r.error.message}`);
}

async function ins(table: string, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.id as string;
}

async function makeThread(slug: string, extra: Record<string, unknown> = {}): Promise<string> {
  const { data: a } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  const program = await ins('program', { workspace_id: ws, app_id: a!.id, title: `Handover ${slug}`, format: 'journey', status: 'active' });
  return ins('thread_thread', {
    workspace_id: ws, program_id: program, organiser_id: annaOrg, slug, is_public_listed: true, public_scope: 'personal', ...extra,
  });
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  const { threadHandoverRoutes } = await import('../routes/thread-handover.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  v1.route('/thread', threadHandoverRoutes);
  app.route('/api/v1', v1);

  ws = await createThrowawayWorkspace('handover');
  const { data: a } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: a!.id }, { onConflict: 'workspace_id,app_id' });
  anna = await createFixtureUser(ws, 'hoanna');
  ben = await createFixtureUser(ws, 'hoben');
  cleo = await createFixtureUser(ws, 'hocleo');
  await seat(anna, 'organiser');
  await seat(ben, 'organiser');
  await seat(cleo, 'admin');

  annaSlug = `int-ho-anna-${randomUUID().slice(0, 6)}`;
  annaOrg = await ins('thread_organiser', { user_id: anna.userId, workspace_id: ws, slug: annaSlug, display_name: 'Anna Handover' });
  await ins('thread_organiser', { user_id: ben.userId, workspace_id: ws, slug: `int-ho-ben-${randomUUID().slice(0, 6)}`, display_name: 'Ben Handover' });
  for (const [u, room] of [[anna, ANNA_ROOM], [ben, BEN_ROOM]] as const) {
    const r = await service.from('user_connection').upsert({ user_id: u.userId, personal_room_url: room }, { onConflict: 'user_id' });
    if (r.error) throw new Error(`user_connection: ${r.error.message}`);
  }
  // Anna takes card money on her own account; Ben has none.
  const up = await service.from('user_profile').upsert({ user_id: anna.userId, stripe_account_id: OLD_ACCOUNT }, { onConflict: 'user_id' });
  if (up.error) throw new Error(`user_profile: ${up.error.message}`);

  threadSlug = `int-ho-${randomUUID().slice(0, 6)}`;
  threadId = await makeThread(threadSlug, { payment_destination: 'personal' });
  engagementId = await ins('thread_engagement', {
    workspace_id: ws, thread_id: threadId, type: 'event', title: 'Session in Anna’s room', status: 'published',
    starts_at: new Date(Date.now() + 10 * 86400_000).toISOString(), meeting_provider: 'personal_room', meeting_url: ANNA_ROOM,
  });
  // A past card sale that does not record its account.
  const person = await ins('person', { workspace_id: ws, first_name: 'Paid', last_name: 'Guest', email: `int-ho-guest-${randomUUID().slice(0, 6)}@example.com` });
  const { data: prog } = await service.from('thread_thread').select('program_id').eq('id', threadId).single();
  const enrolment = await ins('enrolment', { program_id: prog!.program_id, person_id: person, status: 'enrolled' });
  const te = await ins('thread_enrolment', { workspace_id: ws, thread_id: threadId, enrolment_id: enrolment, person_id: person, request_id: randomUUID() });
  purchaseId = await ins('purchase', {
    workspace_id: ws, app_id: a!.id, item_label: 'Handover sale', item_ref: te, amount_cents: 5000,
    method: 'stripe', status: 'paid', organiser_user_id: anna.userId, stripe_account_id: null,
  });

  paidThreadId = await makeThread(`int-ho-paid-${randomUUID().slice(0, 6)}`, {
    payment_destination: 'personal', price_cents: 5000, price_currency: 'eur', payment_methods: ['stripe'], public_enrolment_open: true,
  });
}, 120_000);

afterAll(async () => {
  await service.from('thread_organiser_handover').delete().eq('workspace_id', ws);
  await service.from('thread_owner_history').delete().eq('workspace_id', ws);
  await service.from('purchase').delete().eq('workspace_id', ws);
  for (const u of [anna, ben, cleo].filter(Boolean)) {
    await service.from('user_connection').delete().eq('user_id', u.userId);
    await service.from('user_profile').delete().eq('user_id', u.userId);
    await service.from('app_membership').delete().eq('user_id', u.userId);
    await service.from('workspace_member').delete().eq('user_id', u.userId);
  }
  for (const u of [anna, ben, cleo].filter(Boolean)) await deleteFixtureUser(u);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 120_000);

describe('proposing', () => {
  it('only the organiser hands their own thread over', async () => {
    const r = await call(ben, 'POST', `/threads/${threadId}/handover`, { to_user_id: cleo.userId });
    expect(r.status).toBe(403);
  });

  it('a second open request on the same thread is refused', async () => {
    const r1 = await call(anna, 'POST', `/threads/${threadId}/handover`, { to_user_id: ben.userId });
    expect(r1.status, await r1.clone().text()).toBe(201);
    const r2 = await call(anna, 'POST', `/threads/${threadId}/handover`, { to_user_id: cleo.userId });
    expect(r2.status).toBe(409);
    // Withdraw it; the next case starts clean.
    const id = ((await r1.json()) as { handover: { id: string } }).handover.id;
    expect((await call(anna, 'POST', `/handovers/${id}/cancel`)).status).toBe(200);
  });
});

describe('accepting', () => {
  it('refuses anybody but the proposed organiser, and an expired request', async () => {
    const r = await call(anna, 'POST', `/threads/${threadId}/handover`, { to_user_id: ben.userId });
    const id = ((await r.json()) as { handover: { id: string } }).handover.id;
    expect((await call(anna, 'POST', `/handovers/${id}/accept`)).status).toBe(403);
    await service.from('thread_organiser_handover').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', id);
    const exp = await call(ben, 'POST', `/handovers/${id}/accept`);
    expect(exp.status).toBe(409);
    const list = (await (await call(ben, 'GET', '/handovers')).json()) as { items: { id: string; status: string }[] };
    expect(list.items.find((h) => h.id === id)?.status).toBe('expired');
    // Nothing moved.
    const { data: t } = await service.from('thread_thread').select('organiser_id').eq('id', threadId).single();
    expect(t?.organiser_id).toBe(annaOrg);
    await service.from('thread_organiser_handover').update({ status: 'expired' }).eq('id', id);
  });

  it('hands the thread over: organiser, host, old address, past sale, room', async () => {
    const r = await call(anna, 'POST', `/threads/${threadId}/handover`, { to_user_id: ben.userId, keep_as_host: true });
    expect(r.status).toBe(201);
    const id = ((await r.json()) as { handover: { id: string } }).handover.id;
    const acc = await call(ben, 'POST', `/handovers/${id}/accept`);
    expect(acc.status, await acc.clone().text()).toBe(200);

    const { data: benOrg } = await service.from('thread_organiser').select('id, slug').eq('user_id', ben.userId).single();
    const { data: t } = await service.from('thread_thread').select('organiser_id').eq('id', threadId).single();
    expect(t?.organiser_id).toBe(benOrg!.id);

    // Anna stays as a host; Ben is not a host of his own thread.
    const { data: hosts } = await service.from('thread_thread_organiser').select('organiser_id, role').eq('thread_id', threadId);
    expect(hosts).toEqual([{ organiser_id: annaOrg, role: 'host' }]);

    // The past sale keeps the account it was taken on — a refund debits Anna.
    const { data: p } = await service.from('purchase').select('stripe_account_id, organiser_user_id').eq('id', purchaseId).single();
    expect(p).toEqual({ stripe_account_id: OLD_ACCOUNT, organiser_user_id: anna.userId });

    // A sale from now on lands on the NEW organiser's account (Ben has none).
    const { threadDestinationAccount } = await import('../lib/payment-accounts.js');
    expect(await threadDestinationAccount({ workspace_id: ws, payment_destination: 'personal', organiser_user_id: ben.userId })).toBeNull();

    // The future session moved from Anna's room to Ben's.
    const { data: e } = await service.from('thread_engagement').select('meeting_url').eq('id', engagementId).single();
    expect(e?.meeting_url).toBe(BEN_ROOM);

    // The old address answers where the thread lives now.
    const pub = await app.request(`/api/v1/thread/public/organiser/${annaSlug}/thread/${threadSlug}`);
    expect(pub.status).toBe(404);
    expect(((await pub.json()) as { moved_to?: unknown }).moved_to).toEqual({ owner_slug: benOrg!.slug, thread_slug: threadSlug });
  });

  it('refuses a request whose thread changed organiser in between, and records it cancelled', async () => {
    // Ben (now the organiser) proposes it to Cleo; then the organiser changes
    // behind the request's back.
    const r = await call(ben, 'POST', `/threads/${threadId}/handover`, { to_user_id: cleo.userId });
    const id = ((await r.json()) as { handover: { id: string } }).handover.id;
    await service.from('thread_thread').update({ organiser_id: annaOrg }).eq('id', threadId);
    const acc = await call(cleo, 'POST', `/handovers/${id}/accept`);
    expect(acc.status).toBe(409);
    const { data: h } = await service.from('thread_organiser_handover').select('status').eq('id', id).single();
    expect(h?.status).toBe('cancelled');
  });
});

describe('the payment check', () => {
  it('a paid live thread is not accepted by an organiser who cannot take the money', async () => {
    const r = await call(anna, 'POST', `/threads/${paidThreadId}/handover`, { to_user_id: ben.userId });
    expect(r.status).toBe(201);
    const body = (await r.json()) as { handover: { id: string }; payment_problem: string | null };
    expect(body.payment_problem, 'the proposer is told before sending').toBeTruthy();
    const acc = await call(ben, 'POST', `/handovers/${body.handover.id}/accept`);
    expect(acc.status).toBe(409);
    expect(((await acc.json()) as { code?: string }).code).toBe('payments_not_ready');
    await call(anna, 'POST', `/handovers/${body.handover.id}/cancel`);
  });
});

describe('the second door', () => {
  it('an admin may hand over only for an organiser who has left, with a reason', async () => {
    const still = await call(cleo, 'POST', `/threads/${paidThreadId}/handover`, { to_user_id: ben.userId, door: 'admin_departed', reason: 'Anna left' });
    expect(still.status).toBe(409);
    expect(((await still.json()) as { code?: string }).code).toBe('organiser_still_here');

    expect((await call(ben, 'POST', `/threads/${paidThreadId}/handover`, { to_user_id: ben.userId, door: 'admin_departed', reason: 'x' })).status).toBe(403);

    await service.from('workspace_member').delete().eq('workspace_id', ws).eq('user_id', anna.userId);
    const noReason = await call(cleo, 'POST', `/threads/${paidThreadId}/handover`, { to_user_id: ben.userId, door: 'admin_departed' });
    expect(noReason.status).toBe(400);
    const ok = await call(cleo, 'POST', `/threads/${paidThreadId}/handover`, { to_user_id: ben.userId, door: 'admin_departed', reason: 'Anna left in September' });
    expect(ok.status, await ok.clone().text()).toBe(201);
    const h = ((await ok.json()) as { handover: { keep_as_host: boolean; door: string } }).handover;
    expect(h).toMatchObject({ door: 'admin_departed', keep_as_host: false });
  });
});
