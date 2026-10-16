// REIMBURSE — the one refund path (D3: full, the platform's fee returned).
//
// Lifted out of POST /purchases/:id/refund on 2026-10-16 so that approving a
// cancellation request (routes/thread-cancellation.ts) refunds through
// exactly this code and not a second copy of it. The ROUTE still decides who
// may (the organiser of the sale or an admin, on their own client); this
// decides nothing about the caller and only moves the money and flips the
// rows. Both callers must have proven, before calling, that the purchase is
// in the caller's workspace.

import { adminClient } from '../db.js';
import { stripeOrNull } from './stripe/client.js';
import { chargeAccountForItem } from './payment-accounts.js';

export type ReimbursablePurchase = {
  id: string;
  item_ref: string;
  method: string;
  status: string;
  amount_cents?: number | null;
  stripe_payment_intent: string | null;
  stripe_account_id?: string | null;
};

export type ReimburseResult =
  | { ok: true; already?: boolean; refunded_cents: number }
  | { error: string; code: 409 | 502 | 503 };

export async function reimbursePurchase(p: ReimbursablePurchase, appSlug: string): Promise<ReimburseResult> {
  if (p.status === 'refunded') return { ok: true, already: true, refunded_cents: 0 };
  if (p.status !== 'paid') return { error: 'only paid purchases can be reimbursed', code: 409 };
  if (p.method === 'free') {
    // €0-with-code rows are ledger facts, not payments — flipping them to
    // 'refunded' would irreversibly mislabel the enrolment.
    return { error: 'a free enrolment has nothing to reimburse', code: 409 };
  }

  if (p.method === 'stripe') {
    const stripe = stripeOrNull();
    if (!stripe) return { error: 'payments not configured', code: 503 };
    if (!p.stripe_payment_intent) return { error: 'no payment intent on record', code: 409 };
    // The account the charge actually landed on (stored at record time);
    // today's settings only as fallback for pre-migration rows.
    const account = p.stripe_account_id ?? (await chargeAccountForItem(appSlug, p.item_ref));
    if (!account) return { error: 'connected Stripe account not found', code: 409 };
    try {
      await stripe.refunds.create(
        // D3: the platform gives its skim back — the organiser is made whole.
        { payment_intent: p.stripe_payment_intent, refund_application_fee: true },
        { stripeAccount: account },
      );
    } catch (e) {
      console.error('[purchases] stripe refund failed', e);
      return { error: e instanceof Error ? e.message : 'refund failed', code: 502 };
    }
  }
  // Invoice-method: money moves outside Stripe — this records the fact.

  // Flip the source rows + ledger.
  if (appSlug === 'the-thread') {
    await adminClient.from('thread_enrolment').update({ payment_status: 'refunded' }).eq('id', p.item_ref);
    await adminClient.from('thread_payout').update({ status: 'refunded' }).eq('thread_enrolment_id', p.item_ref);
  } else if (appSlug === 'fibre-meet') {
    await adminClient.from('meet_booking').update({ payment_status: 'refunded' }).eq('id', p.item_ref);
  }
  await adminClient
    .from('purchase')
    .update({ status: 'refunded', refunded_at: new Date().toISOString() })
    .eq('id', p.id);
  return { ok: true, refunded_cents: p.amount_cents ?? 0 };
}
