// What POST /thread/public/enrol does with a place the person ALREADY has —
// against staging, through the real route, with the ledger read back.
//
// Answers settled on 2026-10-14 (lib/place-state.ts):
//   · an unpaid INVOICE holds the place — a re-submit never starts a second
//     payment beside a numbered invoice (coordinator review, "It's money");
//   · a DECLINED place stays closed and says so (`place_closed`);
//   · a live paid place is still already_enrolled.
// No answer ever rewrites a ledger row's reference.
//
// Invoice method throughout, so no Stripe account is needed: an invoice
// sign-up still writes the pending purchase row with the amount, which is
// "charged" as far as the ledger is concerned.
//
// The PERMANENT enrol fixture workspace: enrolling writes append-only
// activity, which pins the person and the workspace.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import {
  createFixtureUser,
  deleteFixtureUser,
  ENROL_FIXTURE_WS_SLUG,
  getPermanentFixtureWorkspace,
  retireParticipants,
  service,
  type FixtureUser,
} from './staging.js';

let app: Hono;
let ws: string;
let organiserUser: FixtureUser;
let organiserId = '';
let organiserSlug = '';
let threadId = '';
let programId = '';
let threadSlug = '';
let threadAppId = '';
const emails: string[] = [];

const PRICE = 2000;

async function enrol(email: string) {
  return app.request('/api/v1/thread/public/enrol', {
    method: 'POST',
    headers: { 'X-App-ID': 'the-thread', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organiser_slug: organiserSlug,
      thread_slug: threadSlug,
      name: 'Place Person',
      email,
      payment_method: 'invoice',
      policy_accepted: true,
      request_id: randomUUID(),
    }),
  });
}

/** Every ledger row that was ever this place's, live or moved aside. */
async function ledgerFor(teId: string) {
  const { data, error } = await service
    .from('purchase')
    .select('id, item_ref, status, method, amount_cents')
    .eq('app_id', threadAppId)
    .like('item_ref', `${teId}%`);
  if (error) throw new Error(`ledger: ${error.message}`);
  return data ?? [];
}

/** A fresh person with one invoiced, unpaid place. */
async function invoicedPlace() {
  const email = `int-place-${randomUUID().slice(0, 8)}@example.com`;
  emails.push(email);
  const res = await enrol(email);
  expect(res.status).toBe(201);
  const body = (await res.json()) as { enrolment_id: string; invoice_pending?: boolean };
  expect(body.invoice_pending).toBe(true);
  const { data: te } = await service
    .from('thread_enrolment')
    .select('id, enrolment_id')
    .eq('id', body.enrolment_id)
    .single();
  return { email, teId: te!.id as string, enrolmentId: te!.enrolment_id as string };
}

/** Settle a place as the organiser's mark-paid would, in the two tables. */
async function markPaid(teId: string, enrolmentId: string) {
  await service.from('thread_enrolment').update({ payment_status: 'paid' }).eq('id', teId);
  await service.from('purchase').update({ status: 'paid' }).eq('app_id', threadAppId).eq('item_ref', teId);
  await service.from('enrolment').update({ status: 'enrolled' }).eq('id', enrolmentId);
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  threadAppId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id;
  ws = await getPermanentFixtureWorkspace(ENROL_FIXTURE_WS_SLUG);
  organiserUser = await createFixtureUser(ws, 'enrol-place');
  organiserSlug = `int-place-${randomUUID().slice(0, 8)}`;
  organiserId = (
    await service
      .from('thread_organiser')
      .insert({ user_id: organiserUser.userId, workspace_id: ws, slug: organiserSlug })
      .select('id')
      .single()
  ).data!.id;
  programId = (
    await service
      .from('program')
      .insert({
        workspace_id: ws,
        app_id: threadAppId,
        title: 'Existing places',
        format: 'event',
        status: 'active',
        starts_on: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      })
      .select('id')
      .single()
  ).data!.id;
  threadSlug = `int-place-${randomUUID().slice(0, 8)}`;
  const { data: th, error } = await service
    .from('thread_thread')
    .insert({
      workspace_id: ws,
      program_id: programId,
      organiser_id: organiserId,
      slug: threadSlug,
      is_public_listed: true,
      public_scope: 'personal',
      price_cents: PRICE,
      price_currency: 'EUR',
      payment_methods: ['invoice'],
    })
    .select('id')
    .single();
  if (error) throw new Error(`thread: ${error.message}`);
  threadId = th!.id as string;
}, 120_000);

afterAll(async () => {
  const { data: tes } = await service.from('thread_enrolment').select('id').eq('thread_id', threadId);
  for (const te of tes ?? []) {
    await service.from('purchase').delete().eq('app_id', threadAppId).like('item_ref', `${te.id}%`);
  }
  await service.from('thread_enrolment').delete().eq('thread_id', threadId);
  await service.from('enrolment').delete().eq('program_id', programId);
  await service.from('thread_thread').delete().eq('id', threadId);
  await service.from('program').delete().eq('id', programId);
  await service.from('thread_organiser').delete().eq('id', organiserId);
  await deleteFixtureUser(organiserUser);
  await retireParticipants(ws, emails);
}, 120_000);

describe('an UNPAID INVOICE holds the place', () => {
  it('a re-submit answers already_enrolled + invoice_open, and writes no second ledger row', async () => {
    const p = await invoicedPlace();
    const before = await ledgerFor(p.teId);
    expect(before).toHaveLength(1);

    const res = await enrol(p.email);
    // 200, not an error: an outside form that re-submits must not start
    // failing. Additive on the existing already_enrolled shape.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, already_enrolled: true, invoice_open: true, enrolment_id: p.teId });
    expect(await ledgerFor(p.teId)).toEqual(before);
  });

  it('DECLINED while the invoice is open: closed wins — no invitation to pay for a closed place', async () => {
    const p = await invoicedPlace();
    await service.from('enrolment').update({ status: 'dropped' }).eq('id', p.enrolmentId);
    const body = await (await enrol(p.email)).json();
    expect(body).toMatchObject({ already_enrolled: true, place_closed: true, place_closed_reason: 'organiser' });
    expect(body.invoice_open).toBeUndefined();
    expect(await ledgerFor(p.teId)).toHaveLength(1);
  });
});

describe('a live PAID place', () => {
  it('is still already_enrolled, without invoice_open, and the ledger is untouched', async () => {
    const p = await invoicedPlace();
    await markPaid(p.teId, p.enrolmentId);
    const before = await ledgerFor(p.teId);
    const res = await enrol(p.email);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.already_enrolled).toBe(true);
    expect(body.invoice_open).toBeUndefined();
    expect(await ledgerFor(p.teId)).toEqual(before);
  });
});

describe('a DECLINED place stays closed', () => {
  // Sjoerd's yes to rejoining was about people who cancelled THEMSELVES, and
  // no such path exists yet. An organiser's decline is the only way a place
  // is dropped from the public side today, and reopening it on every re-submit
  // would make the organiser decline the same person again and again.
  for (const [name, refunded] of [
    ['declined after paying', false],
    ['declined and refunded', true],
  ] as const) {
    it(`${name}: answers place_closed, reopens nothing, writes nothing to the ledger`, async () => {
      const p = await invoicedPlace();
      await markPaid(p.teId, p.enrolmentId);
      if (refunded) {
        await service.from('thread_enrolment').update({ payment_status: 'refunded' }).eq('id', p.teId);
        await service.from('purchase').update({ status: 'refunded' }).eq('app_id', threadAppId).eq('item_ref', p.teId);
      }
      await service.from('enrolment').update({ status: 'dropped' }).eq('id', p.enrolmentId);
      const before = await ledgerFor(p.teId);

      const res = await enrol(p.email);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        ok: true,
        already_enrolled: true,
        place_closed: true,
        // No membership involved here: the organiser closed it.
        place_closed_reason: 'organiser',
      });
      // The ledger row keeps its reference: refunds, payouts and invoices all
      // find their rows by it.
      expect(await ledgerFor(p.teId)).toEqual(before);
      const { data: enr } = await service.from('enrolment').select('status').eq('id', p.enrolmentId).single();
      expect(enr!.status).toBe('dropped');
    });
  }
});
