// A refund of PART (or all) of a Thread card payment, with its CREDIT NOTE
// (refund rules, slice 3a, 2026-10-17; Sjoerd's answers A–G; the
// coordinator's review). The money and the record in one place.
//
// ORDER — and what each step proves:
//   1. remaining = paid − Σ credit notes, checked here BEFORE Stripe is
//      called (the database guard is the last wall, not the first).
//   2. The Stripe refund on the purchase's OWN connected account, for exactly
//      the amount, with refund_application_fee: Stripe returns the platform's
//      fee in proportion (E). Idempotency key = the request (or purchase +
//      amount), so a double click cannot refund twice.
//   3. The platform fee returned is READ BACK from Stripe (the application
//      fee's amount_refunded before and after) — what moved is the truth. A
//      difference of more than a cent from our proportion is logged.
//   4. The credit note. With a Stripe invoice (every Checkout since
//      invoice_creation): a Stripe credit note crediting the invoice's OWN
//      line, linked to the refund just made — Stripe numbers it in that
//      invoice's series and applies the invoice's tax rate, and our row takes
//      net + VAT from it (one source of truth). The line amount is net of
//      VAT (the rate is "on top"), sized by preview so the note's total is
//      exactly the refund. Without one: our own series per seller, net =
//      amount (a card payment with no invoice carries no VAT breakdown).
//   5. The purchase_credit_note row. If the database refuses it AFTER the
//      money moved, that is the one outcome that must never be quiet: a
//      console.error with a fixed tag and the refund id, and the organiser
//      is told to contact support with it.
//   6. The purchase turns 'refunded' (and its place and payout with it) only
//      when the notes reach what was paid.

import Stripe from 'stripe';
import { adminClient } from '../db.js';
import { stripeOrNull } from './stripe/client.js';

export const UNRECORDED_TAG = '[REFUND-UNRECORDED]';

export type RefundPartArgs = {
  purchaseId: string;
  workspaceId: string;
  amountCents: number;
  /** Required when the amount is not the rule's. */
  reason: string | null;
  /** What the rule said, when the amount IS the rule's; null otherwise. */
  rulePct: number | null;
  ruleFeeKeptCents: number;
  cancellationRequestId: string | null;
  issuedBy: string | null;
};

export type RefundPartResult =
  | { ok: true; refunded_cents: number; note: { id: string; number: string }; purchase_refunded: boolean; platform_fee_refunded_cents: number }
  | { ok: false; code: 'not_found' | 'not_card' | 'no_payment_intent' | 'over' | 'not_configured' | 'stripe' | 'in_progress'; error: string }
  | { ok: false; code: 'unrecorded'; error: string; refund_id: string };

type PurchaseRow = {
  id: string;
  workspace_id: string;
  item_ref: string;
  method: string;
  status: string;
  amount_cents: number;
  currency: string;
  platform_fee_cents: number | null;
  stripe_payment_intent: string | null;
  stripe_account_id: string | null;
  stripe_invoice_id: string | null;
};

export async function remainingFor(purchase: { id: string; amount_cents: number }): Promise<number> {
  const { data, error } = await adminClient.from('purchase_credit_note').select('amount_cents').eq('purchase_id', purchase.id);
  if (error) throw new Error(`credit notes: ${error.message}`);
  return purchase.amount_cents - (data ?? []).reduce((n, r) => n + (r.amount_cents as number), 0);
}

/** Pure: the platform fee that SHOULD come back for `amount` of `paid`. */
export const proportionalFee = (feeCents: number, amount: number, paid: number): number =>
  paid > 0 ? Math.round((feeCents * amount) / paid) : 0;

async function feeRefunded(stripe: Stripe, account: string, paymentIntent: string): Promise<{ id: string; refunded: number } | null> {
  // The charge lives on the CONNECTED account; its application fee on the
  // PLATFORM. Read through the connected account the charge's
  // `application_fee` is null, so the fee is found on the platform by charge.
  const pi = await stripe.paymentIntents.retrieve(paymentIntent, {}, { stripeAccount: account });
  const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
  if (!chargeId) return null;
  const fees = await stripe.applicationFees.list({ charge: chargeId, limit: 1 });
  const fee = fees.data[0];
  return fee ? { id: fee.id, refunded: fee.amount_refunded } : null;
}

/** The Stripe credit note on the purchase's own invoice, sized to `amount`. */
async function stripeCreditNote(stripe: Stripe, account: string, invoiceId: string, amount: number, refundId: string, memo: string): Promise<Stripe.CreditNote> {
  const invoice = await stripe.invoices.retrieve(invoiceId, { expand: ['lines'] }, { stripeAccount: account });
  const line = invoice.lines.data[0];
  if (!line) throw new Error('the invoice has no line to credit');
  // VAT is "on top" (a tax rate on the line), so the line amount is net:
  // start from the invoice's own net/gross ratio and let the preview say.
  const gross = invoice.total ?? amount;
  const net0 = gross > 0 ? Math.round((amount * (invoice.subtotal ?? gross)) / gross) : amount;
  let net = net0;
  for (let i = 0; i < 4; i++) {
    const preview = await stripe.creditNotes.preview(
      { invoice: invoiceId, lines: [{ type: 'invoice_line_item', invoice_line_item: line.id, amount: net }] },
      { stripeAccount: account },
    );
    if (preview.total === amount) break;
    net += amount - preview.total > 0 ? 1 : -1;
  }
  return stripe.creditNotes.create(
    {
      invoice: invoiceId,
      lines: [{ type: 'invoice_line_item', invoice_line_item: line.id, amount: net }],
      refunds: [{ refund: refundId, amount_refunded: amount }],
      memo,
    },
    { stripeAccount: account, idempotencyKey: `cn:${refundId}` },
  );
}

export async function refundPart(args: RefundPartArgs): Promise<RefundPartResult> {
  const { data: p } = await adminClient
    .from('purchase')
    .select('id, workspace_id, item_ref, method, status, amount_cents, currency, platform_fee_cents, stripe_payment_intent, stripe_account_id, stripe_invoice_id')
    .eq('id', args.purchaseId)
    .eq('workspace_id', args.workspaceId)
    .maybeSingle();
  const purchase = p as PurchaseRow | null;
  if (!purchase) return { ok: false, code: 'not_found', error: 'purchase not found' };
  if (purchase.method !== 'stripe' || purchase.status !== 'paid') return { ok: false, code: 'not_card', error: 'there is no card payment to refund' };
  if (!purchase.stripe_payment_intent || !purchase.stripe_account_id) {
    return { ok: false, code: 'no_payment_intent', error: 'this payment has no Stripe payment on record to refund' };
  }
  const amount = Math.round(args.amountCents);
  const remaining = await remainingFor(purchase);
  if (!(amount > 0) || amount > remaining) {
    return { ok: false, code: 'over', error: `the refund must be between 0.01 and what is left (${(remaining / 100).toFixed(2)})` };
  }
  const stripe = stripeOrNull();
  if (!stripe) return { ok: false, code: 'not_configured', error: 'payments not configured' };
  const account = purchase.stripe_account_id;

  // 2 + 3: the refund, with the fee read before and after.
  let refund: Stripe.Refund;
  let feeDelta = 0;
  try {
    // Right after a charge the platform's fee record may not exist yet (it is
    // created asynchronously): then nothing has been refunded from it.
    const before = (await feeRefunded(stripe, account, purchase.stripe_payment_intent)) ?? { id: '', refunded: 0 };
    refund = await stripe.refunds.create(
      { payment_intent: purchase.stripe_payment_intent, amount, refund_application_fee: true },
      { stripeAccount: account, idempotencyKey: `refund:${args.cancellationRequestId ?? purchase.id}:${amount}:${remaining}` },
    );
    let after = await feeRefunded(stripe, account, purchase.stripe_payment_intent);
    for (let i = 0; !after && i < 3; i++) {
      await new Promise((r) => setTimeout(r, 500));
      after = await feeRefunded(stripe, account, purchase.stripe_payment_intent);
    }
    feeDelta = after ? after.refunded - before.refunded : 0;
    const expected = proportionalFee(purchase.platform_fee_cents ?? 0, amount, purchase.amount_cents);
    if (Math.abs(feeDelta - expected) > 1) {
      console.error('[refund] platform fee returned differs from the proportion', { purchase: purchase.id, stripe: feeDelta, expected });
    }
  } catch (e) {
    // The same refund already on its way (a double click while the first is
    // still with Stripe): not a failure — that one will land.
    if ((e as { type?: string }).type === 'StripeIdempotencyError' || /another in-progress request/i.test((e as Error).message ?? '')) {
      return { ok: false, code: 'in_progress', error: 'This refund is already being made. Refresh in a moment.' };
    }
    return { ok: false, code: 'stripe', error: e instanceof Error ? e.message : 'refund failed' };
  }

  // A double submit gets the SAME refund back from Stripe (the idempotency
  // key); if it is already recorded, that record is the answer — not a
  // second row the guard would refuse, which would read as money unrecorded.
  const { data: already } = await adminClient
    .from('purchase_credit_note')
    .select('id, number, amount_cents, platform_fee_refunded_cents')
    .eq('stripe_refund_id', refund.id)
    .maybeSingle();
  if (already) {
    return {
      ok: true,
      refunded_cents: already.amount_cents as number,
      note: { id: already.id as string, number: already.number as string },
      purchase_refunded: (await remainingFor(purchase)) <= 0,
      platform_fee_refunded_cents: already.platform_fee_refunded_cents as number,
    };
  }

  // 4: the credit note.
  const memo = args.reason?.trim() || 'Cancellation';
  let number: string;
  let sellerRef: string;
  let net = amount;
  let vat = 0;
  let vatRate: number | null = null;
  let creditNoteId: string | null = null;
  try {
    if (purchase.stripe_invoice_id) {
      const cn = await stripeCreditNote(stripe, account, purchase.stripe_invoice_id, amount, refund.id, memo);
      number = cn.number;
      sellerRef = account;
      creditNoteId = cn.id;
      net = cn.total_excluding_tax ?? cn.subtotal;
      vat = cn.total - net;
      const rate = cn.total_taxes?.[0] ?? null;
      vatRate = rate && net > 0 ? Math.round((vat / net) * 10000) / 100 : null;
    } else {
      throw new Error('no stripe invoice');
    }
  } catch (e) {
    if (purchase.stripe_invoice_id) console.error('[refund] credit note on Stripe failed — using our own series', { purchase: purchase.id, refund: refund.id, e: (e as Error).message });
    const { count } = await adminClient.from('purchase_credit_note').select('id', { count: 'exact', head: true }).eq('purchase_id', purchase.id);
    sellerRef = `fibre:${account}`;
    number = `${purchase.id.slice(0, 8).toUpperCase()}-CN-${String((count ?? 0) + 1).padStart(2, '0')}`;
    net = amount;
    vat = 0;
    vatRate = null;
  }

  // 5: the row — the database's guard is the last wall.
  const { data: note, error: noteErr } = await adminClient
    .from('purchase_credit_note')
    .insert({
      workspace_id: purchase.workspace_id,
      purchase_id: purchase.id,
      cancellation_request_id: args.cancellationRequestId,
      seller_ref: sellerRef,
      number,
      amount_cents: amount,
      net_cents: net,
      vat_cents: vat,
      vat_rate: vatRate,
      currency: purchase.currency,
      platform_fee_refunded_cents: Math.max(0, feeDelta),
      rule_pct: args.rulePct,
      rule_fee_kept_cents: args.ruleFeeKeptCents,
      kind: 'refund',
      reason: args.reason?.trim() || null,
      stripe_refund_id: refund.id,
      stripe_credit_note_id: creditNoteId,
      issued_by_user_id: args.issuedBy,
    })
    .select('id, number')
    .single();
  if (noteErr || !note) {
    // A concurrent double submit recorded the same refund a moment earlier:
    // the money IS recorded — that row is the answer.
    const { data: twin } = await adminClient
      .from('purchase_credit_note')
      .select('id, number')
      .eq('stripe_refund_id', refund.id)
      .maybeSingle();
    if (twin) {
      return { ok: true, refunded_cents: amount, note: { id: twin.id as string, number: twin.number as string }, purchase_refunded: (await remainingFor(purchase)) <= 0, platform_fee_refunded_cents: Math.max(0, feeDelta) };
    }
    console.error(UNRECORDED_TAG, { purchase: purchase.id, refund: refund.id, amount, error: noteErr?.message });
    return {
      ok: false,
      code: 'unrecorded',
      refund_id: refund.id,
      error: `The refund was made but couldn't be recorded. Contact support with ${refund.id}.`,
    };
  }

  // 6: refunded in full?
  const left = await remainingFor(purchase);
  if (left <= 0) {
    const nowIso = new Date().toISOString();
    await adminClient.from('purchase').update({ status: 'refunded', refunded_at: nowIso }).eq('id', purchase.id);
    await adminClient.from('thread_enrolment').update({ payment_status: 'refunded' }).eq('id', purchase.item_ref);
    await adminClient.from('thread_payout').update({ status: 'refunded' }).eq('thread_enrolment_id', purchase.item_ref);
    await returnCodeUse(purchase.item_ref);
  }
  return {
    ok: true,
    refunded_cents: amount,
    note: { id: note.id as string, number: note.number as string },
    purchase_refunded: left <= 0,
    platform_fee_refunded_cents: Math.max(0, feeDelta),
  };
}

/** D: a discount-code use is given back only on a 100% refund. The count is
 *  decremented by compare-and-set with retries (the redemption's own
 *  pattern, routes/thread.ts), never below 0. */
async function returnCodeUse(enrolmentId: string): Promise<void> {
  const { data: te } = await adminClient.from('thread_enrolment').select('coupon_id').eq('id', enrolmentId).maybeSingle();
  const couponId = te?.coupon_id as string | null | undefined;
  if (!couponId) return;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: c } = await adminClient.from('thread_coupon').select('used_count').eq('id', couponId).maybeSingle();
    const count = (c?.used_count as number | null | undefined) ?? 0;
    if (count <= 0) return;
    const { data: took } = await adminClient
      .from('thread_coupon')
      .update({ used_count: count - 1 })
      .eq('id', couponId)
      .eq('used_count', count)
      .select('id');
    if (took?.length) return;
  }
  console.error('[refund] code use not returned after 5 tries', { coupon: couponId });
}
