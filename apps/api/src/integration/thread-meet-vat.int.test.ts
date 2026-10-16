// VAT added on top of a Thread enrolment and a Meet booking — against staging
// and Stripe TEST mode, through the real public routes, reading back the
// Checkout session Stripe made and the ledger row we wrote.
//
// Sjoerd, 2026-10-15: "Everything excl. VAT now." The seller here is the
// organiser / host selling under their own name, VAT-registered in their own
// invoice details (the lookup prefers them over the workspace).
//   · NL buyer, card: Stripe charges 300 + 21% = 363, with a tax line
//   · NL buyer, invoice: the ledger row is 363 with net 300 / VAT 63
//   · outside the EU: 300
//   · no country from a VAT-registered seller: refused before anything exists

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import Stripe from 'stripe';
import {
  cleanupMeetFixture,
  cleanupPublicThreadFixture,
  createMeetFixture,
  createPublicThreadFixture,
  service,
  type MeetFixture,
  type PublicThreadFixture,
} from './staging.js';

let app: Hono;
let tf: PublicThreadFixture;
let mf: MeetFixture;
let account = '';
const threadEmails: string[] = [];
const meetEmails: string[] = [];
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-04-22.dahlia' as Stripe.LatestApiVersion });
const VAT_DETAILS = { legal_name: 'Vat Organiser', vat_registered: true, vat_rate_pct: 21 };

const sessionFrom = async (url: string | undefined) => {
  const id = url?.match(/cs_test_[A-Za-z0-9]+/)?.[0];
  expect(id, url).toBeTruthy();
  return stripe.checkout.sessions.retrieve(id!, {}, { stripeAccount: account });
};

beforeAll(async () => {
  expect(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'), 'Stripe TEST key only').toBe(true);
  const { threadRoutes } = await import('../routes/thread.js');
  const { meetRoutes } = await import('../routes/meet.js');
  app = new Hono();
  const v1 = new Hono();
  v1.route('/thread', threadRoutes);
  v1.route('/meet', meetRoutes);
  app.route('/api/v1', v1);

  const { data: donor } = await service.from('workspace').select('stripe_account_id').eq('slug', 'fixture-upcoming-choir').single();
  account = donor!.stripe_account_id as string;
  expect(account).toMatch(/^acct_/);

  // Thread: a €300 thread paid to its organiser, who is VAT-registered.
  tf = await createPublicThreadFixture('tvat');
  await service.from('user_profile').upsert({ user_id: tf.userRowId, stripe_account_id: account, invoice_details: VAT_DETAILS }, { onConflict: 'user_id' });
  await service
    .from('thread_thread')
    .update({ price_cents: 30000, price_currency: 'EUR', payment_methods: ['stripe', 'invoice'], payment_destination: 'personal', public_enrolment_open: true, is_public_listed: true })
    .eq('id', tf.threadId);

  // Meet: a €300 one-off, its host VAT-registered.
  mf = await createMeetFixture('mvat', { capacity: 10 });
  await service.from('user_profile').upsert({ user_id: mf.userRowId, stripe_account_id: account, invoice_details: VAT_DETAILS }, { onConflict: 'user_id' });
  await service.from('meet_meeting_type').update({ price_cents: 30000, price_currency: 'eur', payment_methods: ['stripe', 'invoice'] }).eq('id', mf.meetingTypeId);
}, 180_000);

afterAll(async () => {
  if (tf) {
    await service.from('user_profile').delete().eq('user_id', tf.userRowId);
    await cleanupPublicThreadFixture(tf, threadEmails);
  }
  if (mf) {
    await service.from('meet_booking').delete().eq('meeting_type_id', mf.meetingTypeId);
    await service.from('user_profile').delete().eq('user_id', mf.userRowId);
    await cleanupMeetFixture(mf, meetEmails);
  }
}, 180_000);

const enrol = (extra: Record<string, unknown>) => {
  const email = `int-tvat-${randomUUID().slice(0, 8)}@example.com`;
  threadEmails.push(email);
  return app.request('/api/v1/thread/public/enrol', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organiser_slug: tf.organiserSlug, thread_slug: tf.threadSlug, name: 'Vat Buyer', email, policy_accepted: true, request_id: `int-tvat-${randomUUID()}`, ...extra }),
  });
};
const book = (extra: Record<string, unknown>) => {
  const email = `int-mvat-${randomUUID().slice(0, 8)}@example.com`;
  meetEmails.push(email);
  return app.request('/api/v1/meet/public/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meeting_type_id: mf.meetingTypeId, invitee_email: email, invitee_name: 'Vat Guest', starts_at: mf.startsAt, request_id: `int-mvat-${randomUUID()}`, ...extra }),
  });
};
const ledger = async (itemRef: string) =>
  (await service.from('purchase').select('amount_cents, billing').eq('item_ref', itemRef).single()).data as { amount_cents: number; billing: Record<string, unknown> };

describe('Thread: VAT on top', () => {
  it('the public thread says the seller adds VAT, and the quote gives 21% for NL', async () => {
    const t = (await (await app.request(`/api/v1/thread/public/organiser/${tf.organiserSlug}/thread/${tf.threadSlug}`)).json()).thread;
    expect(t.vat_registered).toBe(true);
    const q = await (await app.request(`/api/v1/thread/public/vat-quote?organiser_slug=${tf.organiserSlug}&thread_slug=${tf.threadSlug}&country=NL`)).json();
    expect(q).toMatchObject({ applies: true, rate_pct: 21 });
  });

  it('NL card: Stripe charges 363 with a tax line; the ledger says 363 = 300 + 63', async () => {
    const r = await enrol({ payment_method: 'stripe', country: 'NL' });
    expect(r.status, await r.clone().text()).toBe(201);
    const body = await r.json();
    const s = await sessionFrom(body.checkout_url);
    expect(s.amount_subtotal).toBe(30000);
    expect(s.total_details?.amount_tax).toBe(6300);
    expect(s.amount_total).toBe(36300);
    expect(await ledger(body.enrolment_id)).toMatchObject({ amount_cents: 36300, billing: { subtotal_cents: 30000, tax_cents: 6300, tax_label: 'VAT 21%' } });
  });

  it('NL invoice: the ledger row is 363 with the breakdown, and keeps the buyer’s details', async () => {
    const r = await enrol({ payment_method: 'invoice', billing: { company: 'Bandora BV', country: 'NL', tax_no: 'NL854383402B01', address: 'Street 1', postal_code: '1000AA', city: 'Amsterdam' } });
    expect(r.status, await r.clone().text()).toBe(201);
    const body = await r.json();
    expect(await ledger(body.enrolment_id)).toMatchObject({ amount_cents: 36300, billing: { company: 'Bandora BV', subtotal_cents: 30000, tax_cents: 6300 } });
  });

  it('outside the EU: 300', async () => {
    const r = await enrol({ payment_method: 'stripe', country: 'US' });
    const s = await sessionFrom((await r.json()).checkout_url);
    expect(s.amount_total).toBe(30000);
  });

  it('no country: refused', async () => {
    const r = await enrol({ payment_method: 'stripe' });
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ code: 'country_required' });
  });
});

describe('Meet: VAT on top', () => {
  it('the page says the host adds VAT; the quote gives 21% for NL', async () => {
    const q = await (await app.request(`/api/v1/meet/public/vat-quote?meeting_type_id=${mf.meetingTypeId}&country=NL`)).json();
    expect(q).toMatchObject({ applies: true, rate_pct: 21 });
    const p = await (await app.request(`/api/v1/meet/public/host/${mf.hostSlug}/mt/${mf.meetingTypeSlug}`)).json();
    expect(p.meeting_type.vat_registered).toBe(true);
  });

  it('NL card: Stripe charges 363 with a tax line; the ledger says 363 = 300 + 63', async () => {
    const r = await book({ payment_method: 'stripe', country: 'NL' });
    expect(r.status, await r.clone().text()).toBe(200);
    const body = await r.json();
    const s = await sessionFrom(body.checkout_url);
    expect(s.total_details?.amount_tax).toBe(6300);
    expect(s.amount_total).toBe(36300);
    expect(await ledger(body.booking.id)).toMatchObject({ amount_cents: 36300, billing: { subtotal_cents: 30000, tax_cents: 6300 } });
  });

  it('NL invoice: the ledger row is 363 with the breakdown', async () => {
    const r = await book({ payment_method: 'invoice', billing: { company: 'Bandora BV', country: 'NL' } });
    expect(r.status, await r.clone().text()).toBe(200);
    const body = await r.json();
    expect(await ledger(body.booking.id)).toMatchObject({ amount_cents: 36300, billing: { company: 'Bandora BV', tax_cents: 6300 } });
  });

  it('no country: refused before a booking exists', async () => {
    const before = (await service.from('meet_booking').select('id', { count: 'exact', head: true }).eq('meeting_type_id', mf.meetingTypeId)).count ?? 0;
    const r = await book({ payment_method: 'stripe' });
    expect(r.status).toBe(400);
    const after = (await service.from('meet_booking').select('id', { count: 'exact', head: true }).eq('meeting_type_id', mf.meetingTypeId)).count ?? 0;
    expect(after).toBe(before);
  });
});

// PRICE INCLUDES VAT (2026-10-16, as Members): a ticket or meeting type
// marked so was entered as what a HOME buyer pays. The seller here is the
// organiser/host in person — their own details are VAT-registered, the
// workspace's are not — so the NL case also proves the seller is looked up
// per person (organiserUserId): judged on the workspace alone, the flag would
// be ignored and Stripe would charge 363 + 21%.
describe('Thread: a ticket whose price includes VAT', () => {
  let ticketId = '';
  beforeAll(async () => {
    const { data, error } = await service
      .from('thread_ticket')
      .insert({ workspace_id: tf.workspaceId, thread_id: tf.threadId, name: 'Incl. VAT', price_cents: 36300, price_currency: 'EUR', is_active: true, payment_methods: ['stripe', 'invoice'], price_includes_vat: true, position: 0 })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    ticketId = data!.id as string;
  });
  afterAll(async () => {
    await service.from('thread_enrolment').delete().eq('ticket_id', ticketId);
    await service.from('thread_ticket').delete().eq('id', ticketId);
  });

  it('the public payload says so on the ticket', async () => {
    const t = (await (await app.request(`/api/v1/thread/public/organiser/${tf.organiserSlug}/thread/${tf.threadSlug}`)).json()).thread;
    expect(t.tickets.find((k: { id: string }) => k.id === ticketId)).toMatchObject({ price_cents: 36300, price_includes_vat: true });
  });

  it('NL card: Stripe charges exactly 363 — 300 net + 63 VAT; the place stores the net', async () => {
    const r = await enrol({ payment_method: 'stripe', country: 'NL', ticket_id: ticketId });
    expect(r.status, await r.clone().text()).toBe(201);
    const body = await r.json();
    const s = await sessionFrom(body.checkout_url);
    expect(s.amount_subtotal).toBe(30000);
    expect(s.total_details?.amount_tax).toBe(6300);
    expect(s.amount_total).toBe(36300);
    expect(await ledger(body.enrolment_id)).toMatchObject({ amount_cents: 36300, billing: { subtotal_cents: 30000, tax_cents: 6300 } });
    expect((await service.from('thread_enrolment').select('amount_cents').eq('id', body.enrolment_id).single()).data!.amount_cents).toBe(30000);
  });

  it('outside the EU: the net, 300 (option A, as Members)', async () => {
    const r = await enrol({ payment_method: 'stripe', country: 'US', ticket_id: ticketId });
    const s = await sessionFrom((await r.json()).checkout_url);
    expect(s.amount_total).toBe(30000);
  });

  it('a seller who is not VAT-registered: the flag is ignored, 363 is the price', async () => {
    await service.from('user_profile').update({ invoice_details: { legal_name: 'Vat Organiser', vat_registered: false } }).eq('user_id', tf.userRowId);
    try {
      const r = await enrol({ payment_method: 'stripe', country: 'NL', ticket_id: ticketId });
      expect(r.status, await r.clone().text()).toBe(201);
      const s = await sessionFrom((await r.json()).checkout_url);
      expect(s.amount_total).toBe(36300);
      expect(s.total_details?.amount_tax ?? 0).toBe(0);
    } finally {
      await service.from('user_profile').update({ invoice_details: VAT_DETAILS }).eq('user_id', tf.userRowId);
    }
  });
});

describe('Meet: a meeting type whose price includes VAT', () => {
  beforeAll(async () => {
    await service.from('meet_meeting_type').update({ price_cents: 36300, price_includes_vat: true }).eq('id', mf.meetingTypeId);
  });
  afterAll(async () => {
    await service.from('meet_meeting_type').update({ price_cents: 30000, price_includes_vat: false }).eq('id', mf.meetingTypeId);
  });

  it('the public page says so', async () => {
    const p = await (await app.request(`/api/v1/meet/public/host/${mf.hostSlug}/mt/${mf.meetingTypeSlug}`)).json();
    expect(p.meeting_type).toMatchObject({ price_cents: 36300, price_includes_vat: true });
  });

  it('NL card: Stripe charges exactly 363 — 300 net + 63 VAT', async () => {
    const r = await book({ payment_method: 'stripe', country: 'NL' });
    expect(r.status, await r.clone().text()).toBe(200);
    const body = await r.json();
    const s = await sessionFrom(body.checkout_url);
    expect(s.amount_subtotal).toBe(30000);
    expect(s.total_details?.amount_tax).toBe(6300);
    expect(s.amount_total).toBe(36300);
    expect(await ledger(body.booking.id)).toMatchObject({ amount_cents: 36300, billing: { subtotal_cents: 30000, tax_cents: 6300 } });
  });

  it('NL invoice: the ledger row is 363 = 300 + 63', async () => {
    const r = await book({ payment_method: 'invoice', billing: { company: 'Bandora BV', country: 'NL' } });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await ledger((await r.json()).booking.id)).toMatchObject({ amount_cents: 36300, billing: { subtotal_cents: 30000, tax_cents: 6300 } });
  });

  it('outside the EU: the net, 300', async () => {
    const r = await book({ payment_method: 'stripe', country: 'US' });
    const s = await sessionFrom((await r.json()).checkout_url);
    expect(s.amount_total).toBe(30000);
  });
});
