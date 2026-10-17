// Part of a card payment back, with its credit note (refund rules, slice 3a,
// 2026-10-17). REAL Stripe TEST charges on the fixtures' connected account;
// a throwaway workspace (its credit notes can only go with it).
//
// Pinned:
//   · NO STRIPE INVOICE: 50% back → a Stripe refund of exactly that, the
//     platform fee returned in proportion READ BACK from Stripe, a note in
//     our own series; the rest → the purchase reads refunded; one cent more
//     → refused BEFORE Stripe is called; a double submit → one refund, one
//     note;
//   · A STRIPE INVOICE with 21% VAT on top: the credit note is Stripe's, in
//     that invoice's own series, for exactly the refund, and our row's net +
//     VAT are the note's;
//   · the database refusing AFTER the money moved is loud: the fixed tag in
//     the log, the refund id, and the words the organiser reads.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-04-22.dahlia' as Stripe.LatestApiVersion });
let account = '';
let ws = '';
let threadApp = '';

async function cardPurchase(amount: number, fee: number, extra: Record<string, unknown> = {}) {
  const pi = await stripe.paymentIntents.create(
    { amount, currency: 'eur', payment_method: 'pm_card_visa', confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: 'never' }, application_fee_amount: fee },
    { stripeAccount: account },
  );
  expect(pi.status).toBe('succeeded');
  return insertPurchase(amount, fee, pi.id, extra);
}

async function insertPurchase(amount: number, fee: number, pi: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await service
    .from('purchase')
    .insert({ workspace_id: ws, app_id: threadApp, item_label: 'Refund part', item_ref: randomUUID(), amount_cents: amount, platform_fee_cents: fee, currency: 'EUR', method: 'stripe', status: 'paid', stripe_payment_intent: pi, stripe_account_id: account, ...extra })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data!.id as string;
}

const args = (purchaseId: string, amountCents: number, over: Record<string, unknown> = {}) => ({
  purchaseId, workspaceId: ws, amountCents, reason: null, rulePct: null, ruleFeeKeptCents: 0, cancellationRequestId: null, issuedBy: null, ...over,
});

beforeAll(async () => {
  expect(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'), 'Stripe TEST key only').toBe(true);
  account = (await service.from('workspace').select('stripe_account_id').eq('slug', 'fixture-upcoming-choir').single()).data!.stripe_account_id as string;
  threadApp = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id as string;
  ws = await createThrowawayWorkspace('refund-part');
}, 120_000);

afterAll(async () => {
  // Credit notes go only with their workspace (the delete guard).
  if (ws) expect(await deleteThrowawayWorkspace(ws)).toBe(true);
}, 120_000);

describe('a card payment with no Stripe invoice', () => {
  it('50% back: the exact refund, the fee back in proportion (read from Stripe), a note in our series', async () => {
    const { refundPart } = await import('../lib/partial-refund.js');
    const id = await cardPurchase(4000, 200);
    const r = await refundPart(args(id, 2000, { rulePct: 50 }));
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    expect(r).toMatchObject({ refunded_cents: 2000, purchase_refunded: false, platform_fee_refunded_cents: 100 });
    expect(r.note.number).toMatch(/-CN-01$/);
    const refunds = await stripe.refunds.list({ payment_intent: (await service.from('purchase').select('stripe_payment_intent').eq('id', id).single()).data!.stripe_payment_intent as string }, { stripeAccount: account });
    expect(refunds.data.map((x) => x.amount)).toEqual([2000]);
    const { data: row } = await service.from('purchase_credit_note').select('seller_ref, amount_cents, net_cents, vat_cents, platform_fee_refunded_cents, rule_pct, kind').eq('id', r.note.id).single();
    expect(row).toMatchObject({ seller_ref: `fibre:${account}`, amount_cents: 2000, net_cents: 2000, vat_cents: 0, platform_fee_refunded_cents: 100, rule_pct: 50, kind: 'refund' });

    // The rest: the purchase now reads refunded.
    const rest = await refundPart(args(id, 2000));
    expect(rest).toMatchObject({ ok: true, purchase_refunded: true });
    expect((await service.from('purchase').select('status').eq('id', id).single()).data!.status).toBe('refunded');
  });

  it('one cent more than is left is refused BEFORE Stripe', async () => {
    const { refundPart } = await import('../lib/partial-refund.js');
    const id = await cardPurchase(1000, 50);
    const pi = (await service.from('purchase').select('stripe_payment_intent').eq('id', id).single()).data!.stripe_payment_intent as string;
    const r = await refundPart(args(id, 1001));
    expect(r).toMatchObject({ ok: false, code: 'over' });
    expect((await stripe.refunds.list({ payment_intent: pi }, { stripeAccount: account })).data).toEqual([]);
  });

  it('a double submit: one refund, one note', async () => {
    const { refundPart } = await import('../lib/partial-refund.js');
    const id = await cardPurchase(3000, 100);
    const pi = (await service.from('purchase').select('stripe_payment_intent').eq('id', id).single()).data!.stripe_payment_intent as string;
    // Same purchase, same amount, at once: the same idempotency key. One call
    // makes the refund; the other gets it back recorded, or is told it is
    // already being made. Never a second refund, never a second note.
    const [a, b] = await Promise.all([refundPart(args(id, 1500)), refundPart(args(id, 1500))]);
    const outcomes = [a, b].map((x) => (x.ok ? 'ok' : x.code)).sort();
    expect(['ok,ok', 'in_progress,ok'], JSON.stringify([a, b])).toContain(outcomes.join(','));
    expect((await stripe.refunds.list({ payment_intent: pi }, { stripeAccount: account })).data).toHaveLength(1);
    expect((await service.from('purchase_credit_note').select('id').eq('purchase_id', id)).data).toHaveLength(1);
  });
});

describe('a payment with a Stripe invoice and VAT on top', () => {
  it('the credit note is Stripe’s, in the invoice’s series, for exactly the refund; our net + VAT are its', async () => {
    const { refundPart } = await import('../lib/partial-refund.js');
    const customer = await stripe.customers.create({ email: `int-refund-${randomUUID().slice(0, 6)}@example.com` }, { stripeAccount: account });
    const rate = await stripe.taxRates.create({ display_name: 'VAT', percentage: 21, inclusive: false, country: 'NL' }, { stripeAccount: account });
    const invoice = await stripe.invoices.create({ customer: customer.id, collection_method: 'charge_automatically', auto_advance: false, application_fee_amount: 100 }, { stripeAccount: account });
    await stripe.invoiceItems.create({ customer: customer.id, invoice: invoice.id, amount: 5000, currency: 'eur', description: 'Enrolment', tax_rates: [rate.id] }, { stripeAccount: account });
    const final = await stripe.invoices.finalizeInvoice(invoice.id, {}, { stripeAccount: account });
    const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id }, { stripeAccount: account });
    const paid = await stripe.invoices.pay(final.id, { payment_method: pm.id }, { stripeAccount: account });
    expect(paid.total).toBe(6050);
    const payments = await stripe.invoicePayments.list({ invoice: paid.id }, { stripeAccount: account });
    const piId = (payments.data[0]!.payment as { payment_intent?: string }).payment_intent!;
    const id = await insertPurchase(6050, 100, piId, { stripe_invoice_id: paid.id });

    const r = await refundPart(args(id, 3025));
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    expect(r.note.number.startsWith(`${paid.number}-CN-`)).toBe(true);
    const { data: row } = await service.from('purchase_credit_note').select('seller_ref, amount_cents, net_cents, vat_cents, vat_rate, stripe_credit_note_id').eq('id', r.note.id).single();
    const cn = await stripe.creditNotes.retrieve(row!.stripe_credit_note_id as string, {}, { stripeAccount: account });
    expect(cn.total).toBe(3025);
    expect(row).toMatchObject({ seller_ref: account, amount_cents: 3025, vat_rate: 21 });
    expect((row!.net_cents as number) + (row!.vat_cents as number)).toBe(3025);
    expect(row!.vat_cents).toBe(cn.total - (cn.total_excluding_tax ?? cn.subtotal));
  });
});

describe('the database refusing after the money moved', () => {
  it('is loud: the tag, the refund id, and the words for the organiser', async () => {
    const mod = await import('../lib/partial-refund.js');
    const db = await import('../db.js');
    const id = await cardPurchase(2000, 100);
    const realFrom = db.adminClient.from.bind(db.adminClient);
    const errors: unknown[][] = [];
    const errSpy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void errors.push(a));
    // Force the INSERT of the note to fail; everything else is real.
    const fromSpy = vi.spyOn(db.adminClient, 'from').mockImplementation(((table: string) => {
      const q = realFrom(table);
      if (table !== 'purchase_credit_note') return q;
      const realInsert = q.insert.bind(q);
      (q as unknown as { insert: unknown }).insert = (() => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'forced by the test' } }) }) })) as unknown;
      void realInsert;
      return q;
    }) as never);
    try {
      const r = await mod.refundPart(args(id, 500));
      expect(r).toMatchObject({ ok: false, code: 'unrecorded' });
      if (r.ok || r.code !== 'unrecorded') return;
      expect(r.refund_id).toMatch(/^re_/);
      expect(r.error).toBe(`The refund was made but couldn't be recorded. Contact support with ${r.refund_id}.`);
      expect(errors.some((e) => e[0] === mod.UNRECORDED_TAG && JSON.stringify(e[1]).includes(r.refund_id))).toBe(true);
    } finally {
      fromSpy.mockRestore();
      errSpy.mockRestore();
    }
  });
});
