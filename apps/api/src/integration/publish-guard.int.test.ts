// A paid thread cannot go live without a way to take the money.
//
// Sjoerd, 2026-10-14, after "Join for €40.00" dead-ended on staging: "if
// someone is organising a thread that comes with a price... before publish one
// needs to have a stripe or needs to select invoice."
//
// The function (paymentRouteProblem) and the real route (PATCH
// /thread/threads/:id, as the editor saves) against staging, in a throwaway
// workspace — nothing here enrols anybody, so it can be removed again.
// Every refusal has a twin that is allowed, because a guard that refused
// everything would pass the refusal tests and break publishing.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
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
let organiser: FixtureUser;
let organiserId = '';
let threadAppId = '';
let sandboxAccount = '';
// Imported in beforeAll, like the routes: db.ts reads its keys when first
// imported, and a top-level import runs before the staging env is in place.
let paymentRouteProblem: typeof import('../lib/thread-payment-route.js').paymentRouteProblem;
let NO_ROUTE_MESSAGE = '';
const made: { table: string; id: string }[] = [];

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

/** A DRAFT thread with sign-up open, at a price, with these methods. */
async function thread(price: number, methods: string[] | null = null) {
  const program = await insert('program', {
    workspace_id: ws,
    app_id: threadAppId,
    title: `Guard ${price}`,
    format: 'event',
    status: 'draft',
  });
  const id = await insert('thread_thread', {
    workspace_id: ws,
    program_id: program,
    organiser_id: organiserId,
    slug: `guard-${randomUUID().slice(0, 8)}`,
    public_scope: 'workspace',
    public_enrolment_open: true,
    price_cents: price,
    price_currency: 'EUR',
    payment_methods: methods,
  });
  return { id, program };
}

async function publish(threadId: string) {
  // A throwaway workspace is on Free, which keeps ONE event live at a time
  // (402). Earlier tests here publish too, so they step back first — this
  // file tests the payment guard, not the plan limit.
  await service.from('program').update({ status: 'draft' }).eq('workspace_id', ws).eq('status', 'active');
  return app.request(`/api/v1/thread/threads/${threadId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${organiser.accessToken}`,
      'X-App-ID': 'the-thread',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'active' }),
  });
}

async function setAccount(account: string | null) {
  const { error } = await service.from('workspace').update({ stripe_account_id: account }).eq('id', ws);
  if (error) throw new Error(`account: ${error.message}`);
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  ({ paymentRouteProblem, NO_ROUTE_MESSAGE } = await import('../lib/thread-payment-route.js'));
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  threadAppId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id;
  // The sandbox connected account the other paid fixtures use.
  sandboxAccount =
    ((await service.from('workspace').select('stripe_account_id').eq('slug', 'default').single()).data
      ?.stripe_account_id as string | null) ?? '';

  ws = await createThrowawayWorkspace('pubguard');
  organiser = await createFixtureUser(ws, 'pubguard');
  await service.from('workspace_member').upsert({ workspace_id: ws, user_id: organiser.userId, workspace_role: 'admin' });
  await service
    .from('app_membership')
    .upsert({ user_id: organiser.userId, app_id: threadAppId, role: 'admin' }, { onConflict: 'user_id,app_id' });
  await service
    .from('workspace_app')
    .upsert({ workspace_id: ws, app_id: threadAppId }, { onConflict: 'workspace_id,app_id' });
  organiserId = await insert('thread_organiser', {
    user_id: organiser.userId,
    workspace_id: ws,
    slug: `pubguard-${randomUUID().slice(0, 8)}`,
  });
}, 120_000);

afterAll(async () => {
  for (const { table, id } of made) await service.from(table).delete().eq('id', id);
  await service.from('app_membership').delete().eq('user_id', organiser.userId);
  await service.from('workspace_member').delete().eq('user_id', organiser.userId);
  await deleteFixtureUser(organiser);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 120_000);

describe('paymentRouteProblem (the one answer)', () => {
  it('FREE with no payment route: no problem — a free thread needs none', async () => {
    await setAccount(null);
    expect(await paymentRouteProblem((await thread(0)).id)).toBeNull();
  });

  it('PAID with no route (card only, no connected account): refused', async () => {
    await setAccount(null);
    expect(await paymentRouteProblem((await thread(2500, ['stripe'])).id)).toBe(NO_ROUTE_MESSAGE);
  });

  it('PAID with invoice allowed: fine, no Stripe needed', async () => {
    await setAccount(null);
    expect(await paymentRouteProblem((await thread(2500, ['invoice'])).id)).toBeNull();
  });

  it('PAID with a connected Stripe account: fine', async () => {
    expect(sandboxAccount, 'staging default workspace has a sandbox account').not.toBe('');
    await setAccount(sandboxAccount);
    try {
      expect(await paymentRouteProblem((await thread(2500, ['stripe'])).id)).toBeNull();
    } finally {
      await setAccount(null);
    }
  });

  it('a paid TICKET with no route is refused even beside a free one', async () => {
    await setAccount(null);
    const t = await thread(0, ['stripe']);
    await insert('thread_ticket', { workspace_id: ws, thread_id: t.id, name: 'Free', price_cents: 0, is_active: true });
    await insert('thread_ticket', { workspace_id: ws, thread_id: t.id, name: 'Paid', price_cents: 1000, is_active: true });
    expect(await paymentRouteProblem(t.id)).toBe(NO_ROUTE_MESSAGE);
  });

  it('judges a PENDING save as if saved: adding invoice clears it, raising a price creates it', async () => {
    await setAccount(null);
    const paid = await thread(2500, ['stripe']);
    expect(await paymentRouteProblem(paid.id, { payment_methods: ['invoice'] })).toBeNull();
    const free = await thread(0, ['stripe']);
    expect(await paymentRouteProblem(free.id, { price_cents: 900 })).toBe(NO_ROUTE_MESSAGE);
  });
});

describe('the editor save (PATCH /thread/threads/:id), server-side', () => {
  it('refuses to publish a paid thread nobody can pay for, and changes nothing', async () => {
    await setAccount(null);
    const t = await thread(2500, ['stripe']);
    const res = await publish(t.id);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'payment_route_missing', error: NO_ROUTE_MESSAGE });
    const { data } = await service.from('program').select('status').eq('id', t.program).single();
    expect(data!.status).toBe('draft');
  });

  it('publishes the same thread once invoice is allowed', async () => {
    await setAccount(null);
    const t = await thread(2500, ['invoice']);
    expect((await publish(t.id)).status).toBe(200);
  });

  it('publishes a free thread with no payment route at all', async () => {
    await setAccount(null);
    const t = await thread(0);
    expect((await publish(t.id)).status).toBe(200);
  });

  it('GET /threads/:id says why BEFORE the click (publish_blocker)', async () => {
    await setAccount(null);
    const t = await thread(2500, ['stripe']);
    const res = await app.request(`/api/v1/thread/threads/${t.id}`, {
      headers: { Authorization: `Bearer ${organiser.accessToken}`, 'X-App-ID': 'the-thread' },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).publish_blocker).toBe(NO_ROUTE_MESSAGE);
  });
});
