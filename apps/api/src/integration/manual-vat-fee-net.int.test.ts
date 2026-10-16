// Sjoerd, 2026-10-16 ("yes, yes"): an invoice an organiser or host adds by
// hand follows the same VAT as the online price, and the platform fee is on
// the NET everywhere. Against staging and Stripe TEST, through the real
// routes, signed in as a workspace admin of the fixture.
//
// BEFORE → AFTER, a VAT-registered seller (in person; the workspace is not):
//   Thread, organiser adds an invoiced participant:
//     €300 excl. ticket  ledger €300 (VAT carved out: 247.93 + 52.07)
//                     →  ledger €363 = 300 + 63; the place stores 300
//     €363 incl. ticket  €363 (carved) → €363 = 300 + 63, the same total
//     seller not registered: €300 → €300
//   Meet, host books by hand (invoice): the same three.
//   The payment link those paths send: Stripe is asked to charge the GROSS,
//   with application_fee_amount on the NET (read from the call itself — a
//   Checkout session does not show its fee until it is paid).
//
// The seller is the THREAD's organiser / the meeting type's HOST, not the
// admin adding: the admin here has no invoice details at all.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type Stripe from 'stripe';
import {
  cleanupMeetFixture,
  cleanupPublicThreadFixture,
  createFixtureUser,
  createMeetFixture,
  createPublicThreadFixture,
  deleteFixtureUser,
  service,
  type FixtureUser,
  type MeetFixture,
  type PublicThreadFixture,
} from './staging.js';

// Mail captured, never sent (the webhook confirms the place and mails).
vi.mock('../lib/email/client.js', async (orig) => ({
  ...(await orig<typeof import('../lib/email/client.js')>()),
  sendEmail: vi.fn(async () => undefined),
}));
const WEBHOOK_SECRET = 'whsec_int_fee_on_net';
process.env.STRIPE_THREAD_WEBHOOK_SECRET = WEBHOOK_SECRET;

// What each Checkout session was asked for, the real call still made.
const sessionCalls: Record<string, unknown>[] = [];
vi.mock('../lib/stripe/client.js', async (orig) => {
  const real = await orig<typeof import('../lib/stripe/client.js')>();
  return {
    ...real,
    stripeOrNull: () => {
      const s = real.stripeOrNull();
      if (!s) return s;
      return new Proxy(s, {
        get(target, prop, recv) {
          if (prop !== 'checkout') return Reflect.get(target, prop, recv);
          const checkout = target.checkout;
          return {
            ...checkout,
            sessions: new Proxy(checkout.sessions, {
              get(st, sp, sr) {
                if (sp !== 'create') return Reflect.get(st, sp, sr);
                return (params: Record<string, unknown>, opts?: unknown) => {
                  sessionCalls.push(params);
                  return (st.create as (p: unknown, o?: unknown) => Promise<unknown>).call(st, params, opts);
                };
              },
            }),
          };
        },
      }) as Stripe;
    },
  };
});

let app: Hono;
let tf: PublicThreadFixture;
let mf: MeetFixture;
let tAdmin: FixtureUser;
let mAdmin: FixtureUser;
let account = '';
const VAT = { legal_name: 'Vat Seller', vat_registered: true, vat_rate_pct: 21 };
const emails: string[] = [];
let excl = '';
let incl = '';
// Below the €2 cap, so the fee on the net (€1.00 on €50) and on the gross
// (€1.21 on €60.50) differ — at €300 both are capped at €2 and say nothing.
let small = '';

const call = (who: FixtureUser, path: string, appId: string, body: unknown) =>
  app.request(`/api/v1${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${who.accessToken}`, 'X-App-ID': appId, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const ledger = async (itemRef: string) =>
  (await service.from('purchase').select('amount_cents, billing').eq('item_ref', itemRef).single()).data as {
    amount_cents: number;
    billing: Record<string, unknown>;
  };
const fee2pct = (cents: number) => Math.min(Math.floor(cents * 0.02), 200);

async function adminOf(ws: string, tag: string, slugs: string[]) {
  const u = await createFixtureUser(ws, tag);
  await service.from('workspace_member').upsert({ workspace_id: ws, user_id: u.userId, workspace_role: 'admin', relationship_type: 'internal' }, { onConflict: 'user_id,workspace_id' });
  for (const slug of slugs) {
    const appId = (await service.from('app').select('id').eq('slug', slug).single()).data!.id as string;
    await service.from('workspace_app').upsert({ workspace_id: ws, app_id: appId }, { onConflict: 'workspace_id,app_id' });
    await service.from('app_membership').upsert({ user_id: u.userId, app_id: appId, role: 'admin' }, { onConflict: 'user_id,app_id' });
  }
  return u;
}

beforeAll(async () => {
  expect(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'), 'Stripe TEST key only').toBe(true);
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  const { meetRoutes } = await import('../routes/meet.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  v1.route('/meet', meetRoutes);
  app.route('/api/v1', v1);
  account = (await service.from('workspace').select('stripe_account_id').eq('slug', 'fixture-upcoming-choir').single()).data!.stripe_account_id as string;

  tf = await createPublicThreadFixture('mvatt');
  await service.from('user_profile').upsert({ user_id: tf.userRowId, stripe_account_id: account, invoice_details: VAT }, { onConflict: 'user_id' });
  await service.from('thread_thread').update({ payment_methods: ['stripe', 'invoice'], payment_destination: 'personal' }).eq('id', tf.threadId);
  const tk = async (name: string, cents: number, inc: boolean) =>
    (await service.from('thread_ticket').insert({ workspace_id: tf.workspaceId, thread_id: tf.threadId, name, price_cents: cents, price_currency: 'EUR', is_active: true, price_includes_vat: inc, position: inc ? 1 : 0 }).select('id').single()).data!.id as string;
  excl = await tk('Excl', 30000, false);
  incl = await tk('Incl', 36300, true);
  small = await tk('Small', 5000, false);
  tAdmin = await adminOf(tf.workspaceId, 'mvatt-admin', ['the-thread']);

  mf = await createMeetFixture('mvatm', { capacity: 10 });
  await service.from('user_profile').upsert({ user_id: mf.userRowId, stripe_account_id: account, invoice_details: VAT }, { onConflict: 'user_id' });
  await service.from('meet_meeting_type').update({ price_cents: 30000, price_currency: 'eur', payment_methods: ['stripe', 'invoice'] }).eq('id', mf.meetingTypeId);
  const { data: mt } = await service.from('meet_meeting_type').select('workspace_id').eq('id', mf.meetingTypeId).single();
  mAdmin = await adminOf(mt!.workspace_id as string, 'mvatm-admin', ['fibre-meet']);
}, 240_000);

afterAll(async () => {
  if (tf) {
    // A failed webhook case leaves its payout row; never let it pin the fixture.
    await service.from('thread_payout').delete().eq('thread_id', tf.threadId);
    await service.from('thread_ticket').delete().eq('thread_id', tf.threadId);
    await service.from('user_profile').delete().eq('user_id', tf.userRowId);
    await cleanupPublicThreadFixture(tf, emails);
  }
  if (mf) {
    await service.from('meet_booking').delete().eq('meeting_type_id', mf.meetingTypeId);
    await service.from('user_profile').delete().eq('user_id', mf.userRowId);
    await cleanupMeetFixture(mf, emails);
  }
  for (const u of [tAdmin, mAdmin]) if (u) await deleteFixtureUser(u);
}, 240_000);

const addParticipant = async (ticketId: string) => {
  const email = `int-mvat-${randomUUID().slice(0, 8)}@example.com`;
  emails.push(email);
  const r = await call(tAdmin, `/thread/threads/${tf.threadId}/participants`, 'the-thread', { name: 'Hand Added', email, billing: 'invoice', ticket_id: ticketId, notify: false });
  expect(r.status, await r.clone().text()).toBe(201);
  return (await r.json()) as { enrolment_id: string };
};

describe('Thread: an invoice the organiser adds follows the online VAT', () => {
  it('€300 excl. ticket → €363 = 300 + 63; the place stores 300', async () => {
    const { enrolment_id } = await addParticipant(excl);
    expect(await ledger(enrolment_id)).toMatchObject({ amount_cents: 36300, billing: { subtotal_cents: 30000, tax_cents: 6300, tax_label: 'VAT 21%' } });
    expect((await service.from('thread_enrolment').select('amount_cents').eq('id', enrolment_id).single()).data!.amount_cents).toBe(30000);
  });

  it('its payment link: Stripe charges the gross (€60.50) with the fee on the net (€1.00, not €1.21)', async () => {
    sessionCalls.length = 0;
    const { enrolment_id } = await addParticipant(small);
    expect(await ledger(enrolment_id)).toMatchObject({ amount_cents: 6050, billing: { subtotal_cents: 5000, tax_cents: 1050 } });
    const link = sessionCalls.at(-1) as { line_items: { price_data: { unit_amount: number } }[]; payment_intent_data: { application_fee_amount: number } };
    expect(link.line_items[0]!.price_data.unit_amount).toBe(6050);
    expect(link.payment_intent_data.application_fee_amount).toBe(100);
    expect(fee2pct(6050)).toBe(121); // what the gross would have given
  });

  it('the webhook RECORDS the fee on the net: €1.00 in the ledger and the payout, not €1.21', async () => {
    const stripe = (await import('stripe')).default;
    const { enrolment_id } = await addParticipant(small);
    const sessionId = `cs_int_feenet_${randomUUID().slice(0, 8)}`;
    await service.from('thread_enrolment').update({ stripe_session_id: sessionId }).eq('id', enrolment_id);
    const payload = JSON.stringify({
      id: `evt_int_${randomUUID().slice(0, 8)}`,
      object: 'event',
      type: 'checkout.session.completed',
      data: { object: { id: sessionId, object: 'checkout.session', amount_total: 6050, amount_subtotal: 5000, currency: 'eur', payment_intent: null, metadata: { thread_enrolment_id: enrolment_id } } },
    });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    const r = await app.request('/api/v1/thread/stripe-webhook', { method: 'POST', headers: { 'stripe-signature': header, 'Content-Type': 'application/json' }, body: payload });
    expect(r.status, await r.clone().text()).toBe(200);
    const p = (await service.from('purchase').select('amount_cents, platform_fee_cents, status').eq('item_ref', enrolment_id).single()).data!;
    expect(p).toMatchObject({ amount_cents: 6050, platform_fee_cents: 100, status: 'paid' });
    const payout = (await service.from('thread_payout').select('gross_cents, platform_fee_cents').eq('thread_enrolment_id', enrolment_id).single()).data!;
    expect(payout).toEqual({ gross_cents: 6050, platform_fee_cents: 100 });
    await service.from('thread_payout').delete().eq('thread_enrolment_id', enrolment_id);
  });

  it('€363 incl. ticket → €363 = 300 + 63 (the same total, a correct breakdown)', async () => {
    const { enrolment_id } = await addParticipant(incl);
    expect(await ledger(enrolment_id)).toMatchObject({ amount_cents: 36300, billing: { subtotal_cents: 30000, tax_cents: 6300 } });
  });

  it('a seller who is not VAT-registered: €300, no VAT', async () => {
    await service.from('user_profile').update({ invoice_details: { legal_name: 'Vat Seller', vat_registered: false } }).eq('user_id', tf.userRowId);
    try {
      const { enrolment_id } = await addParticipant(excl);
      expect(await ledger(enrolment_id)).toMatchObject({ amount_cents: 30000, billing: { subtotal_cents: 30000, tax_cents: 0 } });
    } finally {
      await service.from('user_profile').update({ invoice_details: VAT }).eq('user_id', tf.userRowId);
    }
  });
});

const hostBooks = async (payment: 'invoice' | 'link') => {
  const email = `int-mvatm-${randomUUID().slice(0, 8)}@example.com`;
  emails.push(email);
  const startsAt = new Date(new Date(mf.startsAt).getTime() + Math.floor(Math.random() * 40) * 86_400_000).toISOString();
  const r = await call(mAdmin, '/meet/bookings', 'fibre-meet', { meeting_type_id: mf.meetingTypeId, starts_at: startsAt, invitee_email: email, invitee_name: 'Hand Booked', payment, notify: false });
  expect(r.status, await r.clone().text()).toBeLessThan(300);
  return ((await r.json()) as { booking: { id: string } }).booking.id;
};

describe('Meet: a booking the host makes by hand follows the online VAT', () => {
  it('€300 excl. → invoice €363 = 300 + 63', async () => {
    const id = await hostBooks('invoice');
    expect(await ledger(id)).toMatchObject({ amount_cents: 36300, billing: { subtotal_cents: 30000, tax_cents: 6300 } });
  });

  it('payment link: Stripe charges the gross (€60.50) with the fee on the net (€1.00, not €1.21)', async () => {
    await service.from('meet_meeting_type').update({ price_cents: 5000 }).eq('id', mf.meetingTypeId);
    try {
      sessionCalls.length = 0;
      const id = await hostBooks('link');
      expect(await ledger(id)).toMatchObject({ amount_cents: 6050, billing: { subtotal_cents: 5000, tax_cents: 1050 } });
      const link = sessionCalls.at(-1) as { line_items: { price_data: { unit_amount: number } }[]; payment_intent_data: { application_fee_amount: number } };
      expect(link.line_items[0]!.price_data.unit_amount).toBe(6050);
      expect(link.payment_intent_data.application_fee_amount).toBe(100);
    } finally {
      await service.from('meet_meeting_type').update({ price_cents: 30000 }).eq('id', mf.meetingTypeId);
    }
  });

  it('€363 incl. → €363 = 300 + 63', async () => {
    await service.from('meet_meeting_type').update({ price_cents: 36300, price_includes_vat: true }).eq('id', mf.meetingTypeId);
    try {
      const id = await hostBooks('invoice');
      expect(await ledger(id)).toMatchObject({ amount_cents: 36300, billing: { subtotal_cents: 30000, tax_cents: 6300 } });
    } finally {
      await service.from('meet_meeting_type').update({ price_cents: 30000, price_includes_vat: false }).eq('id', mf.meetingTypeId);
    }
  });
});

describe('Members: an invoice payment link', () => {
  it('charges the gross (€60.50) with the fee on the net (2% of €50 = €1.00, not €1.21)', async () => {
    const { createMembershipPaymentLink } = await import('../lib/membership-payment-link.js');
    const membershipApp = (await service.from('app').select('id').eq('slug', 'membership').single()).data!.id as string;
    await service.from('workspace').update({ stripe_account_id: account }).eq('id', tf.workspaceId);
    const { data: pur, error } = await service
      .from('purchase')
      .insert({
        workspace_id: tf.workspaceId,
        app_id: membershipApp,
        payer_name: 'Member',
        payer_email: `int-mvatp-${randomUUID().slice(0, 6)}@example.com`,
        item_label: 'Membership (fixture)',
        item_ref: `int-mvatp-${randomUUID()}`,
        amount_cents: 6050,
        currency: 'EUR',
        method: 'invoice',
        status: 'pending',
        billing: { subtotal_cents: 5000, tax_cents: 1050, tax_label: 'VAT 21%' },
      })
      .select('id, payer_email')
      .single();
    if (error) throw new Error(error.message);
    try {
      sessionCalls.length = 0;
      const url = await createMembershipPaymentLink({
        purchaseId: pur!.id as string,
        workspaceId: tf.workspaceId,
        amountCents: 6050,
        currency: 'EUR',
        itemLabel: 'Membership (fixture)',
        payerEmail: pur!.payer_email as string,
      });
      expect(url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
      const link = sessionCalls.at(-1) as { line_items: { price_data: { unit_amount: number } }[]; payment_intent_data: { application_fee_amount?: number } };
      expect(link.line_items[0]!.price_data.unit_amount).toBe(6050);
      // The workspace's plan percentage (2% on the fixture), of the NET.
      expect(link.payment_intent_data.application_fee_amount).toBe(100);
    } finally {
      await service.from('purchase').delete().eq('id', pur!.id);
      await service.from('workspace').update({ stripe_account_id: null }).eq('id', tf.workspaceId);
    }
  });
});
