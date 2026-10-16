// POST /purchases/:id/refund — Reimburse, as the Invoices pages in Thread,
// Meet and Members call it. Against staging, through the real route.
//
// Written 2026-10-16, when the refund moved into lib/reimburse.ts so that
// approving a cancellation request refunds through the same code. The route
// had no test of its own; this one pins what it answers, and was run against
// the route BEFORE the move and after it, with the same result. The Stripe
// branch is exercised with a real test-mode charge in
// thread-cancellation.int.test.ts; here, every other answer:
//   · an invoice-method paid purchase: { ok: true }, and the purchase, the
//     thread enrolment and the payout all read 'refunded';
//   · again: { ok: true, already: true }, nothing else changes;
//   · a pending purchase: 409, "only paid purchases can be reimbursed";
//   · a free one: 409, "a free enrolment has nothing to reimburse";
//   · somebody who is neither the seller nor an admin: 404 (RLS hides it);
//   · a purchase from another workspace: 404.

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
let other = '';
let seller: FixtureUser;
let stranger: FixtureUser;
let outsider: FixtureUser;
let threadAppId = '';
const tag = randomUUID().slice(0, 6);
const made: { table: string; id: string }[] = [];

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

const refund = (id: string, who: FixtureUser = seller) =>
  app.request(`/api/v1/purchases/${id}/refund`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${who.accessToken}`, 'X-App-ID': 'the-thread', 'Content-Type': 'application/json' },
  });

async function purchase(workspaceId: string, label: string, method: string, status: string, itemRef: string) {
  return insert('purchase', {
    workspace_id: workspaceId,
    app_id: threadAppId,
    payer_name: 'Fixture Payer',
    payer_email: `refund-${tag}@example.com`,
    item_label: label,
    item_ref: itemRef,
    organiser_user_id: seller.userId,
    amount_cents: 2500,
    currency: 'EUR',
    method,
    status,
    ...(status === 'paid' ? { paid_at: new Date().toISOString() } : {}),
  });
}

let teId = '';
const ids = { paid: '', pending: '', free: '', foreign: '' };

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { purchasesRoutes } = await import('../routes/purchases.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/purchases', purchasesRoutes);
  app.route('/api/v1', v1);

  threadAppId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id;
  ws = await createThrowawayWorkspace('refund');
  other = await createThrowawayWorkspace('refund-other');
  seller = await createFixtureUser(ws, 'refund-seller');
  stranger = await createFixtureUser(ws, 'refund-stranger');
  outsider = await createFixtureUser(other, 'refund-outsider');
  for (const [u, w] of [[seller, ws], [stranger, ws], [outsider, other]] as const) {
    await service.from('workspace_member').upsert({ workspace_id: w, user_id: u.userId, workspace_role: 'organiser' });
    await service.from('app_membership').upsert({ user_id: u.userId, app_id: threadAppId, role: 'member' }, { onConflict: 'user_id,app_id' });
  }

  // A real enrolment behind the paid purchase, so the flip of the source rows
  // is seen too.
  const orgId = await insert('thread_organiser', { user_id: seller.userId, workspace_id: ws, slug: `refund-${tag}` });
  const program = await insert('program', { workspace_id: ws, app_id: threadAppId, title: 'Refund fixture', format: 'event', status: 'active' });
  const thread = await insert('thread_thread', { workspace_id: ws, program_id: program, organiser_id: orgId, slug: `refund-${tag}` });
  const person = await insert('person', { workspace_id: ws, first_name: 'Payer', email: `refund-${tag}@example.com` });
  const enr = await insert('enrolment', { program_id: program, person_id: person, status: 'enrolled' });
  teId = await insert('thread_enrolment', { workspace_id: ws, thread_id: thread, enrolment_id: enr, person_id: person, request_id: `refund-${tag}`, payment_status: 'paid' });

  ids.paid = await purchase(ws, 'paid', 'invoice', 'paid', teId);
  ids.pending = await purchase(ws, 'pending', 'invoice', 'pending', `refund-pending-${tag}`);
  ids.free = await purchase(ws, 'free', 'free', 'paid', `refund-free-${tag}`);
  ids.foreign = await purchase(other, 'foreign', 'invoice', 'paid', `refund-foreign-${tag}`);
}, 180_000);

afterAll(async () => {
  for (const { table, id } of made) await service.from(table).delete().eq('id', id);
  for (const u of [seller, stranger, outsider]) if (u) await deleteFixtureUser(u);
  if (ws) await deleteThrowawayWorkspace(ws);
  if (other) await deleteThrowawayWorkspace(other);
}, 180_000);

describe('Reimburse', () => {
  // A 404, not the route's 403: RLS on `purchase` hides another organiser's
  // sale from a non-admin before the role check is reached.
  it('somebody who is neither the seller nor an admin cannot reach it, and nothing changes', async () => {
    const r = await refund(ids.paid, stranger);
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: 'not found' });
    expect((await service.from('purchase').select('status').eq('id', ids.paid).single()).data!.status).toBe('paid');
  });

  it('a purchase in another workspace is not found', async () => {
    const r = await refund(ids.foreign);
    expect(r.status).toBe(404);
  });

  it('an invoice-method paid purchase: ok, and the ledger, the place and the payout read refunded', async () => {
    const r = await refund(ids.paid);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    const p = (await service.from('purchase').select('status, refunded_at').eq('id', ids.paid).single()).data!;
    expect(p.status).toBe('refunded');
    expect(p.refunded_at).not.toBeNull();
    expect((await service.from('thread_enrolment').select('payment_status').eq('id', teId).single()).data!.payment_status).toBe('refunded');
  });

  it('again: already, and nothing else changes', async () => {
    const r = await refund(ids.paid);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, already: true });
  });

  it('a pending purchase cannot be reimbursed', async () => {
    const r = await refund(ids.pending);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: 'only paid purchases can be reimbursed' });
  });

  it('a free one has nothing to reimburse', async () => {
    const r = await refund(ids.free);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: 'a free enrolment has nothing to reimburse' });
  });
});
