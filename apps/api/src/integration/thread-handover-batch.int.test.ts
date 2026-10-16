// Handover v2: all the threads of an organiser who has LEFT, in one request
// (admin door; coordinator, plan approved 2026-10-16).
//
// Real routes, in process, against staging's database. A throwaway workspace:
// Dora (an organiser who has left — she owns threads, and is no longer a
// member), Anna (an organiser who is still here), Ben (the new organiser, no
// Stripe account), Cleo (a workspace admin), Eve (an organiser, not admin).
// Dora's threads: a free running one, a paid one (Ben cannot take its money),
// a locked one, a completed one with a STALE pending request on it, and an
// archived one.
//
// What it pins, before → after (there was no batch before):
//   - the admin's list: archived left out; locked shown with its reason; the
//     paid one flagged for Ben; the running one suggested, the completed not;
//   - one request: locked left out with its reason, the rest in, sharing a
//     batch_id, keep-as-host OFF (the departed door's default);
//   - a stale pending row past its expiry does not block: it is closed;
//   - Accept all: the free and completed threads move, the paid one is
//     refused payments_not_ready and STAYS pending; Decline all then closes it.
// The single accept is unchanged: thread-handover.int.test.ts, untouched.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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

const sent: { to: string; subject: string; text: string }[] = [];
vi.mock('../lib/email/client.js', async (orig) => ({
  ...(await orig<typeof import('../lib/email/client.js')>()),
  sendEmail: vi.fn(async (m: { to: string; subject: string; text: string }) => {
    sent.push({ to: m.to, subject: m.subject, text: m.text });
  }),
}));

let app: Hono;
let ws = '';
let dora: FixtureUser;
let anna: FixtureUser;
let ben: FixtureUser;
let cleo: FixtureUser;
let eve: FixtureUser;
let doraOrg = '';
let annaOrg = '';
let benOrg = '';
const th = { free: '', paid: '', locked: '', done: '', archived: '' };
let staleId = '';
let batchId = '';

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

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function makeThread(organiser: string, title: string, program: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const { data: a } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  const p = await ins('program', { workspace_id: ws, app_id: a!.id, title, format: 'journey', status: 'active', ...program });
  return ins('thread_thread', {
    workspace_id: ws, program_id: p, organiser_id: organiser, slug: `int-hob-${randomUUID().slice(0, 8)}`,
    is_public_listed: true, public_scope: 'personal', payment_destination: 'personal', ...extra,
  });
}

const organiserOf = async (threadId: string) =>
  (await service.from('thread_thread').select('organiser_id').eq('id', threadId).single()).data!.organiser_id as string;
const statusOf = async (handoverId: string) =>
  (await service.from('thread_organiser_handover').select('status').eq('id', handoverId).single()).data!.status as string;

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadHandoverRoutes } = await import('../routes/thread-handover.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadHandoverRoutes);
  app.route('/api/v1', v1);

  ws = await createThrowawayWorkspace('hobatch');
  const { data: a } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: a!.id }, { onConflict: 'workspace_id,app_id' });
  dora = await createFixtureUser(ws, 'hobdora');
  anna = await createFixtureUser(ws, 'hobanna');
  ben = await createFixtureUser(ws, 'hobben');
  cleo = await createFixtureUser(ws, 'hobcleo');
  eve = await createFixtureUser(ws, 'hobeve');
  // Dora is NOT seated: she has left.
  await seat(anna, 'organiser');
  await seat(ben, 'organiser');
  await seat(cleo, 'admin');
  await seat(eve, 'organiser');

  doraOrg = await ins('thread_organiser', { user_id: dora.userId, workspace_id: ws, slug: `int-hob-dora-${randomUUID().slice(0, 6)}`, display_name: 'Dora Departed' });
  annaOrg = await ins('thread_organiser', { user_id: anna.userId, workspace_id: ws, slug: `int-hob-anna-${randomUUID().slice(0, 6)}`, display_name: 'Anna Stays' });
  benOrg = await ins('thread_organiser', { user_id: ben.userId, workspace_id: ws, slug: `int-hob-ben-${randomUUID().slice(0, 6)}`, display_name: 'Ben New' });

  th.free = await makeThread(doraOrg, 'Free running', { starts_on: day(-3), ends_on: day(30) });
  th.paid = await makeThread(doraOrg, 'Paid running', { starts_on: day(5), ends_on: day(40) }, {
    price_cents: 5000, price_currency: 'eur', payment_methods: ['stripe'], public_enrolment_open: true,
  });
  th.locked = await makeThread(doraOrg, 'Locked running', { starts_on: day(5) }, { locked_at: new Date().toISOString() });
  th.done = await makeThread(doraOrg, 'Completed', { status: 'completed', starts_on: day(-60), ends_on: day(-30) });
  th.archived = await makeThread(doraOrg, 'Archived', { status: 'archived' });
  await makeThread(annaOrg, 'Anna’s own', { starts_on: day(5) });

  // A request on the completed thread that expired last week but is still
  // stored 'pending' (expiry is checked, not swept).
  staleId = await ins('thread_organiser_handover', {
    workspace_id: ws, thread_id: th.done, from_organiser_id: doraOrg, to_organiser_id: benOrg, proposed_by_user_id: cleo.userId,
    door: 'admin_departed', reason: 'old', keep_as_host: false, expires_at: new Date(Date.now() - 7 * 86_400_000).toISOString(),
  });
}, 180_000);

afterAll(async () => {
  if (ws) {
    await service.from('thread_organiser_handover').delete().eq('workspace_id', ws);
    await service.from('thread_owner_history').delete().eq('workspace_id', ws);
  }
  for (const u of [dora, anna, ben, cleo, eve].filter(Boolean)) {
    await service.from('app_membership').delete().eq('user_id', u.userId);
    await service.from('workspace_member').delete().eq('user_id', u.userId);
  }
  for (const u of [dora, anna, ben, cleo, eve].filter(Boolean)) await deleteFixtureUser(u);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 180_000);

describe('the admin’s list', () => {
  it('is for admins only', async () => {
    expect((await call(eve, 'GET', '/handovers/departed')).status).toBe(403);
    expect((await call(eve, 'GET', `/handovers/departed/${doraOrg}`)).status).toBe(403);
  });

  it('names who has left and still owns threads — not who is still here; archived not counted', async () => {
    const r = await call(cleo, 'GET', '/handovers/departed');
    expect(r.status).toBe(200);
    const { items } = (await r.json()) as { items: { organiser_id: string; name: string; thread_count: number }[] };
    expect(items).toEqual([{ organiser_id: doraOrg, name: 'Dora Departed', thread_count: 4 }]);
  });

  it('an organiser who is still a member hands over themselves', async () => {
    const r = await call(cleo, 'GET', `/handovers/departed/${annaOrg}?to=${ben.userId}`);
    expect(r.status).toBe(409);
    expect(((await r.json()) as { code: string }).code).toBe('organiser_still_here');
  });

  it('lists each thread with the single handover’s checks, judged as the NEW organiser', async () => {
    const r = await call(cleo, 'GET', `/handovers/departed/${doraOrg}?to=${ben.userId}`);
    expect(r.status).toBe(200);
    const { items } = (await r.json()) as {
      items: { thread_id: string; suggested: boolean; excluded: { code: string } | null; payment_problem: string | null }[];
    };
    const by = Object.fromEntries(items.map((i) => [i.thread_id, i]));
    expect(Object.keys(by).sort()).toEqual([th.free, th.paid, th.locked, th.done].sort()); // archived left out
    expect(by[th.free]).toMatchObject({ suggested: true, excluded: null, payment_problem: null });
    expect(by[th.paid]!.suggested).toBe(true);
    expect(by[th.paid]!.excluded).toBeNull();
    expect(by[th.paid]!.payment_problem).toBeTruthy(); // flagged, not excluded
    expect(by[th.locked]).toMatchObject({ suggested: false, excluded: { code: 'thread_locked' }, payment_problem: null });
    // Completed: listed, not suggested; its stale pending row does not block.
    expect(by[th.done]).toMatchObject({ suggested: false, excluded: null });
  });
});

describe('one request', () => {
  it('is refused for a non-admin, and without a reason', async () => {
    const body = { from_organiser_id: doraOrg, to_user_id: ben.userId, reason: 'Dora left', threads: [{ id: th.free }] };
    expect((await call(eve, 'POST', '/handovers/batch', body)).status).toBe(403);
    expect((await call(cleo, 'POST', '/handovers/batch', { ...body, reason: '' })).status).toBe(400);
  });

  it('leaves the locked thread out with its reason; the rest share one batch, keep-as-host off', async () => {
    sent.length = 0;
    const r = await call(cleo, 'POST', '/handovers/batch', {
      from_organiser_id: doraOrg,
      to_user_id: ben.userId,
      reason: 'Dora left in September',
      threads: [{ id: th.free }, { id: th.paid }, { id: th.locked }, { id: th.done }],
    });
    expect(r.status, await r.clone().text()).toBe(201);
    const j = (await r.json()) as {
      batch_id: string;
      handovers: { thread_id: string; batch_id: string; door: string; keep_as_host: boolean; status: string }[];
      excluded: { thread_id: string; code: string; reason: string }[];
      payment_problems: Record<string, string>;
    };
    batchId = j.batch_id;
    expect(j.handovers.map((h) => h.thread_id).sort()).toEqual([th.free, th.paid, th.done].sort());
    for (const h of j.handovers) expect(h).toMatchObject({ batch_id: batchId, door: 'admin_departed', keep_as_host: false, status: 'pending' });
    expect(j.excluded).toEqual([expect.objectContaining({ thread_id: th.locked, code: 'thread_locked' })]);
    expect(Object.keys(j.payment_problems)).toEqual([th.paid]);
    // The stale row was closed, not left to block.
    expect(await statusOf(staleId)).toBe('expired');
    // ONE mail to the new organiser, naming the three.
    const toBen = sent.filter((m) => m.to === ben.email);
    expect(toBen).toHaveLength(1);
    expect(toBen[0]!.subject).toContain('3 threads');
    for (const t of ['Free running', 'Paid running', 'Completed']) expect(toBen[0]!.text).toContain(t);
  });

  it('a second request for a thread already in one leaves it out (nothing eligible → 409)', async () => {
    const r = await call(cleo, 'POST', '/handovers/batch', {
      from_organiser_id: doraOrg, to_user_id: ben.userId, reason: 'again', threads: [{ id: th.free }],
    });
    expect(r.status).toBe(409);
    const j = (await r.json()) as { code: string; excluded: { code: string }[] };
    expect(j.code).toBe('nothing_eligible');
    expect(j.excluded[0]!.code).toBe('handover_pending');
  });

  it('the list Ben reads carries the batch_id on each row', async () => {
    const r = await call(ben, 'GET', '/handovers');
    const { items } = (await r.json()) as { items: { batch_id: string | null; incoming: boolean; status: string }[] };
    const mine = items.filter((i) => i.batch_id === batchId);
    expect(mine).toHaveLength(3);
    for (const i of mine) expect(i).toMatchObject({ incoming: true, status: 'pending' });
  });
});

describe('answering', () => {
  it('only the new organiser answers', async () => {
    expect((await call(cleo, 'POST', `/handovers/batch/${batchId}/accept`)).status).toBe(403);
    expect((await call(ben, 'POST', `/handovers/batch/${randomUUID()}/accept`)).status).toBe(404);
  });

  it('Accept all: free and completed move; the paid one is refused and stays pending', async () => {
    sent.length = 0;
    const r = await call(ben, 'POST', `/handovers/batch/${batchId}/accept`);
    expect(r.status, await r.clone().text()).toBe(200);
    const j = (await r.json()) as { accepted: number; refused: number; results: { thread_id: string; ok: boolean; code?: string }[] };
    expect({ accepted: j.accepted, refused: j.refused }).toEqual({ accepted: 2, refused: 1 });
    expect(j.results.find((x) => x.thread_id === th.paid)).toMatchObject({ ok: false, code: 'payments_not_ready' });
    expect(await organiserOf(th.free)).toBe(benOrg);
    expect(await organiserOf(th.done)).toBe(benOrg);
    expect(await organiserOf(th.paid)).toBe(doraOrg);
    expect(await organiserOf(th.locked)).toBe(doraOrg);
    // keep_as_host off: Dora is not added back as a host.
    const { data: hosts } = await service.from('thread_thread_organiser').select('organiser_id').eq('thread_id', th.free);
    expect((hosts ?? []).map((h) => h.organiser_id)).not.toContain(doraOrg);
    // One summary to the admin, one to Dora — not one per thread.
    expect(sent.filter((m) => m.to === cleo.email)).toHaveLength(1);
    expect(sent.filter((m) => m.to === cleo.email)[0]!.text).toContain('Still waiting');
    expect(sent.filter((m) => m.to === dora.email)).toHaveLength(1);
  });

  it('Decline all then closes what is left (the paid one), and nothing else changes', async () => {
    const r = await call(ben, 'POST', `/handovers/batch/${batchId}/decline`);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { declined: number }).declined).toBe(1);
    expect(await organiserOf(th.paid)).toBe(doraOrg);
    expect(await organiserOf(th.free)).toBe(benOrg);
    const { data: rows } = await service.from('thread_organiser_handover').select('thread_id, status').eq('batch_id', batchId);
    expect(Object.fromEntries((rows ?? []).map((x) => [x.thread_id, x.status]))).toEqual({
      [th.free]: 'accepted', [th.done]: 'accepted', [th.paid]: 'declined',
    });
  });
});
