// Extra seats on the Stripe subscription — one item, quantity = seats over
// the plan's allowance, prorated by Stripe on every change.
//
// ONE reconciler. Called after an invite creates a user, after checkout, and
// from the billing webhook (so plan switches in the portal re-count against
// the new allowance). Idempotent: it compares the item's quantity to the
// truth and touches Stripe only on a difference — safe against the webhook
// echo its own update produces.
//
// It fails SOFT: a Stripe hiccup logs and returns, it never blocks an invite.
// The person joins now; the next reconcile (webhook, next invite, checkout)
// repairs the quantity. Money converges, colleagues don't wait.
//
// PRORATION IS ASYMMETRIC, deliberately (Sjoerd, 2026-09-04): a seat ADDED
// mid-month is prorated from the day it lands (Stripe's default), but a seat
// REMOVED stops billing from the NEXT period — no mid-month credit. The paid
// month runs out; the next invoice simply counts fewer. So every quantity
// GROW uses 'create_prorations' and every SHRINK (including removing the
// item entirely) uses proration_behavior: 'none'.

import { adminClient } from '../db.js';
import { stripeOrNull } from './stripe/client.js';
import { seatsUsed } from './plan.js';

type SeatContext = {
  subscriptionId: string;
  interval: 'monthly' | 'annual';
  seatPriceId: string;
  includedSeats: number;
};

async function seatContext(workspaceId: string): Promise<SeatContext | null> {
  const { data: sub } = await adminClient
    .from('workspace_subscription')
    .select(
      `status, stripe_subscription_id, billing_interval,
       plan:plan_id (included_seats, stripe_price_id_seat_month, stripe_price_id_seat_year)`,
    )
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (!sub?.stripe_subscription_id) return null;
  if (sub.status !== 'active' && sub.status !== 'trialing' && sub.status !== 'past_due') return null;
  const plan = (Array.isArray(sub.plan) ? sub.plan[0] : sub.plan) as {
    included_seats: number | null;
    stripe_price_id_seat_month: string | null;
    stripe_price_id_seat_year: string | null;
  } | null;
  if (!plan || plan.included_seats === null) return null; // unlimited — nothing to bill
  const interval = sub.billing_interval === 'annual' ? 'annual' : 'monthly';
  const seatPriceId =
    interval === 'annual' ? plan.stripe_price_id_seat_year : plan.stripe_price_id_seat_month;
  if (!seatPriceId) return null; // not synced / plan has no seat price
  return {
    subscriptionId: sub.stripe_subscription_id,
    interval,
    seatPriceId,
    includedSeats: plan.included_seats,
  };
}

/**
 * Whether an invite past the allowance may proceed because the seat will be
 * BILLED rather than refused. False = the 402 stands (no Stripe subscription,
 * comped, unpaid, or seat prices not synced).
 */
export async function seatBillable(workspaceId: string): Promise<boolean> {
  const ctx = await seatContext(workspaceId);
  return ctx !== null;
}

/** The extra-seat quantity the subscription SHOULD carry right now. */
export async function seatOverage(workspaceId: string): Promise<number> {
  const ctx = await seatContext(workspaceId);
  if (!ctx) return 0;
  const used = await seatsUsed(workspaceId);
  return Math.max(0, used - ctx.includedSeats);
}

export async function reconcileSeatBilling(workspaceId: string): Promise<void> {
  try {
    const stripe = stripeOrNull();
    if (!stripe) return;
    const ctx = await seatContext(workspaceId);
    if (!ctx) return;

    const used = await seatsUsed(workspaceId);
    const overage = Math.max(0, used - ctx.includedSeats);

    const sub = await stripe.subscriptions.retrieve(ctx.subscriptionId);
    const seatItem = sub.items.data.find((i) => i.price?.id === ctx.seatPriceId);

    if (!seatItem && overage > 0) {
      // Grow from nothing — prorated from today, the seat is in use now.
      await stripe.subscriptionItems.create({
        subscription: ctx.subscriptionId,
        price: ctx.seatPriceId,
        quantity: overage,
        proration_behavior: 'create_prorations',
      });
      console.log(`[seats] ${workspaceId}: +seat item ×${overage}`);
    } else if (seatItem && overage === 0) {
      // Shrink to nothing — no credit; the next invoice carries no seat line.
      await stripe.subscriptionItems.del(seatItem.id, { proration_behavior: 'none' });
      console.log(`[seats] ${workspaceId}: seat item removed (no credit — next period)`);
    } else if (seatItem && seatItem.quantity !== overage) {
      const grow = overage > (seatItem.quantity ?? 0);
      await stripe.subscriptionItems.update(seatItem.id, {
        quantity: overage,
        // Grow: prorated from the day the seat lands. Shrink: the paid month
        // runs out, the NEXT invoice counts fewer — never a mid-month credit.
        proration_behavior: grow ? 'create_prorations' : 'none',
      });
      console.log(
        `[seats] ${workspaceId}: seat item ${seatItem.quantity} → ${overage}${grow ? '' : ' (no credit — next period)'}`,
      );
    }
  } catch (e) {
    console.error('[seats] reconcile failed (will converge on next event)', workspaceId, e);
  }
}
