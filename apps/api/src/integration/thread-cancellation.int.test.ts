// Cancellation requests — against staging, through the real routes, with a
// real Stripe TEST charge for the refund. Email captured, never sent.
//
// Sjoerd's 2iv (plan approved 2026-10-16). The promises:
//   · only the place's own person may ask, or withdraw; a stranger gets 404;
//   · one open request per place: a second is refused (409);
//   · withdrawing closes it, and a new request may follow;
//   · APPROVE with refund on a card place drops the place and refunds
//     through the real Reimburse: Stripe says refunded, the ledger reads
//     refunded, the request stores refunded_cents;
//   · two approvals at once: ONE succeeds, ONE refund (the claim);
//   · APPROVE without refund drops the place and moves no money;
//   · REJECT keeps the place and carries the note to the participant;
//   · the three emails render (request → organiser, approved with the
//     refunded amount, rejected with the note); a withdrawal mails nobody;
//   · my.thread's payload carries the request and whether to offer the button.
//
// In the PERMANENT fixture workspace (activity is append-only, so a
// throwaway workspace could not be removed afterwards). Every row it makes is
// removed by id; the activity rows stay, by design.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { createFixtureUser, deleteFixtureUser, getPermanentFixtureWorkspace, service, type FixtureUser } from './staging.js';

const sent: { to: string; subject: string; text: string }[] = [];
vi.mock('../lib/email/client.js', async (orig) => ({
  ...(await orig<typeof import('../lib/email/client.js')>()),
  sendEmail: vi.fn(async (m: { to: string; subject: string; text: string }) => {
    sent.push(m);
  }),
}));

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-04-22.dahlia' as Stripe.LatestApiVersion });

// THE MONEY IS refund-part.int.test.ts's (a throwaway workspace, real Stripe
// TEST): the refund, the fee, the credit note, the purchase turning
// refunded. Here the route's half is pinned — that approving calls refundPart
// ONCE, for this purchase, this request and the amount — through a recorder.
// A real refund here would leave an issued credit note, which can never be
// deleted, and so a purchase per run in this PERMANENT workspace (the
// coordinator, 2026-10-17: keep it clean).
const refundCalls: { purchaseId: string; amountCents: number; cancellationRequestId: string | null }[] = [];
vi.mock('../lib/partial-refund.js', async (orig) => ({
  ...(await orig<typeof import('../lib/partial-refund.js')>()),
  refundPart: vi.fn(async (a: { purchaseId: string; amountCents: number; cancellationRequestId: string | null }) => {
    refundCalls.push({ purchaseId: a.purchaseId, amountCents: a.amountCents, cancellationRequestId: a.cancellationRequestId });
    return { ok: true, refunded_cents: a.amountCents, note: { id: 'n1', number: 'TEST-CN-01' }, purchase_refunded: true, platform_fee_refunded_cents: 100 };
  }),
}));
const tag = randomUUID().slice(0, 6);
let app: Hono;
let ws = '';
let account = '';
let threadAppId = '';
let threadId = '';
let programId = '';
let organiser: FixtureUser;
let alice: FixtureUser; // a card place
let bob: FixtureUser; // an invoice place
let stranger: FixtureUser;
const made: { table: string; id: string }[] = [];
const places: Record<'alice' | 'bob', { te: string; enr: string; person: string; purchase?: string; pi?: string }> = {} as never;

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

const call = (path: string, who: FixtureUser, init: { method?: string; body?: unknown } = {}) =>
  app.request(`/api/v1${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${who.accessToken}`, 'X-App-ID': 'the-thread', 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
const enrolmentStatus = async (enr: string) => (await service.from('enrolment').select('status').eq('id', enr).single()).data!.status;
const requestsFor = async (te: string) =>
  ((await service.from('thread_cancellation_request').select('id, status, refunded_cents, refund_error, decision_note').eq('enrolment_id', te).order('created_at')).data ?? []);

beforeAll(async () => {
  expect(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'), 'Stripe TEST key only').toBe(true);
  const { appContext } = await import('../middleware/app-context.js');
  const { cancellationMeRoutes, cancellationStaffRoutes } = await import('../routes/thread-cancellation.js');
  const { portalRoutes } = await import('../routes/portal.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/me', portalRoutes);
  v1.route('/me', cancellationMeRoutes);
  v1.route('/thread', cancellationStaffRoutes);
  app.route('/api/v1', v1);

  threadAppId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id;
  account = (await service.from('workspace').select('stripe_account_id').eq('slug', 'fixture-upcoming-choir').single()).data!.stripe_account_id as string;
  ws = await getPermanentFixtureWorkspace('int-cancellation-fixtures');
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: threadAppId }, { onConflict: 'workspace_id,app_id' });

  organiser = await createFixtureUser(ws, 'cx-org');
  alice = await createFixtureUser(ws, 'cx-alice');
  bob = await createFixtureUser(ws, 'cx-bob');
  stranger = await createFixtureUser(ws, 'cx-stranger');
  await service.from('workspace_member').upsert({ workspace_id: ws, user_id: organiser.userId, workspace_role: 'organiser' });
  await service.from('app_membership').upsert({ user_id: organiser.userId, app_id: threadAppId, role: 'member' }, { onConflict: 'user_id,app_id' });

  const orgRow = await insert('thread_organiser', { user_id: organiser.userId, workspace_id: ws, slug: `cx-${tag}`, display_name: 'Olga Organiser' });
  programId = await insert('program', {
    workspace_id: ws,
    app_id: threadAppId,
    title: `Cancellation fixture ${tag}`,
    format: 'event',
    status: 'active',
    starts_on: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    // No org_wide here (it was, until 20261017133142): the organiser sees the
    // people on their thread because they ORGANISE it — thread_thread.
    // organiser_id below — which is how a real organiser sees them
    // (can_see_person, "contacts follow the hierarchy"). Without that role
    // they would see no participant, and Decline — whose loader this reuses —
    // would answer 404 just the same.
  });
  threadId = await insert('thread_thread', { workspace_id: ws, program_id: programId, organiser_id: orgRow, slug: `cx-${tag}`, language: 'en' });

  for (const [k, u] of [['alice', alice], ['bob', bob]] as const) {
    const person = await insert('person', { workspace_id: ws, first_name: k === 'alice' ? 'Alice' : 'Bob', email: u.email });
    const enr = await insert('enrolment', { program_id: programId, person_id: person, status: 'enrolled' });
    const te = await insert('thread_enrolment', {
      workspace_id: ws,
      thread_id: threadId,
      enrolment_id: enr,
      person_id: person,
      request_id: `cx-${k}-${tag}`,
      payment_status: 'paid',
    });
    places[k] = { te, enr, person };
  }

  // Alice paid by card: a real TEST charge on the fixtures' connected account.
  const pi = await stripe.paymentIntents.create(
    { amount: 3500, currency: 'eur', payment_method: 'pm_card_visa', confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: 'never' }, application_fee_amount: 100 },
    { stripeAccount: account },
  );
  expect(pi.status).toBe('succeeded');
  places.alice.pi = pi.id;
  const base = { workspace_id: ws, app_id: threadAppId, payer_name: 'Payer', item_label: `Cancellation fixture ${tag}`, organiser_user_id: organiser.userId, amount_cents: 3500, currency: 'EUR', status: 'paid', paid_at: new Date().toISOString() };
  places.alice.purchase = await insert('purchase', { ...base, payer_email: alice.email, item_ref: places.alice.te, method: 'stripe', stripe_payment_intent: pi.id, stripe_account_id: account });
  places.bob.purchase = await insert('purchase', { ...base, payer_email: bob.email, item_ref: places.bob.te, method: 'invoice' });
}, 180_000);

afterAll(async () => {
  await service.from('thread_cancellation_request').delete().eq('thread_id', threadId);
  for (const { table, id } of made) {
    if (table === 'program') await service.from('enrolment').delete().eq('program_id', id);
    await service.from(table).delete().eq('id', id);
  }
  for (const u of [organiser, alice, bob, stranger]) if (u) await deleteFixtureUser(u);
  const left = {
    requests: ((await service.from('thread_cancellation_request').select('id').eq('thread_id', threadId)).data ?? []).length,
    thread: ((await service.from('thread_thread').select('id').eq('id', threadId)).data ?? []).length,
    purchases: ((await service.from('purchase').select('id').in('id', [places.alice?.purchase, places.bob?.purchase].filter(Boolean) as string[])).data ?? []).length,
  };
  expect(left).toEqual({ requests: 0, thread: 0, purchases: 0 });
}, 180_000);

describe('the participant asks', () => {
  it('a stranger cannot ask for somebody else’s place', async () => {
    const r = await call(`/me/enrolments/${places.alice.te}/cancellation-request`, stranger, { method: 'POST', body: {} });
    expect(r.status).toBe(404);
    expect(await requestsFor(places.alice.te)).toEqual([]);
  });

  it('my.thread offers the button on a place that still holds', async () => {
    const r = await call('/me/portal', alice);
    expect(r.status).toBe(200);
    const thread = ((await r.json()) as { groups: { threads: Record<string, unknown>[] }[] }).groups.flatMap((g) => g.threads).find((t) => t.thread_id === threadId)!;
    expect(thread).toMatchObject({ enrolment_id: places.alice.te, cancellation_request: null, can_request_cancellation: true });
  });

  it('asks, with a reason; the organiser is mailed it; a second request is refused', async () => {
    sent.length = 0;
    const r = await call(`/me/enrolments/${places.alice.te}/cancellation-request`, alice, { method: 'POST', body: { reason: 'Moving abroad' } });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(sent).toEqual([expect.objectContaining({ to: organiser.email.toLowerCase(), subject: `Cancellation request: Cancellation fixture ${tag}` })]);
    expect(sent[0]!.text).toContain('Moving abroad');
    expect(sent[0]!.text).toContain('Alice asks to cancel');
    const again = await call(`/me/enrolments/${places.alice.te}/cancellation-request`, alice, { method: 'POST', body: {} });
    expect(again.status).toBe(409);
  });

  it('my.thread shows it pending and no longer offers the button', async () => {
    const r = await call('/me/portal', alice);
    const thread = ((await r.json()) as { groups: { threads: Record<string, unknown>[] }[] }).groups.flatMap((g) => g.threads).find((t) => t.thread_id === threadId)!;
    expect(thread.cancellation_request).toMatchObject({ status: 'pending' });
    expect(thread.can_request_cancellation).toBe(false);
  });

  it('withdraws (no email), and may ask again', async () => {
    sent.length = 0;
    const w = await call(`/me/enrolments/${places.alice.te}/cancellation-request`, alice, { method: 'DELETE' });
    expect(w.status).toBe(200);
    expect(sent).toHaveLength(0);
    expect((await requestsFor(places.alice.te)).map((r) => r.status)).toEqual(['withdrawn']);
    const r = await call(`/me/enrolments/${places.alice.te}/cancellation-request`, alice, { method: 'POST', body: { reason: 'Really moving' } });
    expect(r.status).toBe(201);
  });
});

describe('the organiser decides', () => {
  it('lists the requests with what an approval could refund', async () => {
    const r = await call(`/thread/threads/${threadId}/cancellation-requests`, organiser);
    expect(r.status, await r.clone().text()).toBe(200);
    const items = ((await r.json()) as { items: Record<string, unknown>[] }).items;
    const open = items.find((i) => i.status === 'pending')!;
    expect(open).toMatchObject({ enrolment_id: places.alice.te, reason: 'Really moving', person_name: 'Alice', refundable: { amount_cents: 3500, currency: 'EUR' } });
  });

  it('a stranger may not decide', async () => {
    const pending = (await requestsFor(places.alice.te)).find((r) => r.status === 'pending')!;
    const r = await call(`/thread/cancellation-requests/${pending.id}/approve`, stranger, { method: 'POST', body: { refund: true } });
    expect([403, 404]).toContain(r.status);
    expect(await enrolmentStatus(places.alice.enr)).toBe('enrolled');
  });

  it('two approvals at once: one wins, the place is dropped, and the card is refunded ONCE (refundPart)', async () => {
    const pending = (await requestsFor(places.alice.te)).find((r) => r.status === 'pending')!;
    sent.length = 0;
    refundCalls.length = 0;
    const [a, b] = await Promise.all([
      call(`/thread/cancellation-requests/${pending.id}/approve`, organiser, { method: 'POST', body: { refund: true } }),
      call(`/thread/cancellation-requests/${pending.id}/approve`, organiser, { method: 'POST', body: { refund: true } }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const winner = (await (a.status === 200 ? a : b).json()) as { refunded_cents: number | null; refund_error: string | null };
    expect(winner).toMatchObject({ refunded_cents: 3500, refund_error: null });

    expect(await enrolmentStatus(places.alice.enr)).toBe('dropped');
    // ONE refund, for this purchase, this request, everything that was paid.
    expect(refundCalls).toEqual([{ purchaseId: places.alice.purchase!, amountCents: 3500, cancellationRequestId: pending.id }]);
    expect((await requestsFor(places.alice.te)).find((r) => r.id === pending.id)).toMatchObject({ status: 'approved', refunded_cents: 3500 });

    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(alice.email.toLowerCase());
    expect(sent[0]!.subject).toBe(`Your place in Cancellation fixture ${tag} is cancelled`);
    expect(sent[0]!.text).toMatch(/€\s?35.*refunded to your card/);
  });

  it('my.thread then shows it approved and does not offer the button on a dropped place', async () => {
    const r = await call('/me/portal', alice);
    const thread = ((await r.json()) as { groups: { threads: Record<string, unknown>[] }[] }).groups.flatMap((g) => g.threads).find((t) => t.thread_id === threadId);
    expect(thread?.cancellation_request).toMatchObject({ status: 'approved' });
    expect(thread?.can_request_cancellation).toBe(false);
  });

  it('reject keeps the place and tells the participant why', async () => {
    const ask = await call(`/me/enrolments/${places.bob.te}/cancellation-request`, bob, { method: 'POST', body: {} });
    expect(ask.status).toBe(201);
    const pending = (await requestsFor(places.bob.te)).find((r) => r.status === 'pending')!;
    sent.length = 0;
    const r = await call(`/thread/cancellation-requests/${pending.id}/reject`, organiser, { method: 'POST', body: { note: 'The deadline has passed.' } });
    expect(r.status).toBe(200);
    expect(await enrolmentStatus(places.bob.enr)).toBe('enrolled');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toBe(`About your cancellation request: Cancellation fixture ${tag}`);
    expect(sent[0]!.text).toContain('The deadline has passed.');
    expect(sent[0]!.text).toContain('You keep your place.');
    const portal = await call('/me/portal', bob);
    const thread = ((await portal.json()) as { groups: { threads: Record<string, unknown>[] }[] }).groups.flatMap((g) => g.threads).find((t) => t.thread_id === threadId)!;
    expect(thread.cancellation_request).toMatchObject({ status: 'rejected', decision_note: 'The deadline has passed.' });
  });

  it('approve WITHOUT refund on an invoice place drops it and moves no money', async () => {
    const ask = await call(`/me/enrolments/${places.bob.te}/cancellation-request`, bob, { method: 'POST', body: {} });
    expect(ask.status).toBe(201);
    const pending = (await requestsFor(places.bob.te)).find((r) => r.status === 'pending')!;
    sent.length = 0;
    const r = await call(`/thread/cancellation-requests/${pending.id}/approve`, organiser, { method: 'POST', body: { refund: false } });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, credit_note: null, refunded_cents: null, refund_error: null });
    expect(await enrolmentStatus(places.bob.enr)).toBe('dropped');
    expect((await service.from('purchase').select('status').eq('id', places.bob.purchase!).single()).data!.status).toBe('paid');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.text).not.toMatch(/refunded/);
  });

  it('a dropped place cannot ask again', async () => {
    const r = await call(`/me/enrolments/${places.bob.te}/cancellation-request`, bob, { method: 'POST', body: {} });
    expect(r.status).toBe(409);
  });
});
