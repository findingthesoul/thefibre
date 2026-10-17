// WILL THE RENEWAL FIND A CARD? (2026-10-17.) A member who paid the first
// year by invoice can sit on a subscription Stripe will try to CHARGE at its
// end, with nothing to charge: the renewal invoice fails, the member drops
// into grace and gets a "payment failed" email. The reminder used to tell
// them "nothing to do". This says, for one subscription, whether a card is
// needed before the renewal, and by when — read by the renewal reminder and
// by my.thread's card line, so both say the same thing.

import type Stripe from 'stripe';

export type RenewalCard = { needs_card: boolean; on: string | null };

/** The rule, pure. A card is needed when Stripe will charge automatically at
 *  the next renewal, the subscription is going to renew, and neither the
 *  subscription nor the customer has a default payment method. A
 *  send_invoice subscription bills by email and needs none. */
export function renewalNeedsCard(
  sub: Pick<Stripe.Subscription, 'status' | 'cancel_at_period_end' | 'collection_method' | 'trial_end'> & {
    period_end: number | null;
  },
  hasPaymentMethod: boolean,
): RenewalCard {
  const renews = ['active', 'trialing', 'past_due'].includes(sub.status) && !sub.cancel_at_period_end;
  const endsAt = sub.status === 'trialing' && sub.trial_end ? sub.trial_end : sub.period_end;
  const on = endsAt ? new Date(endsAt * 1000).toISOString() : null;
  const needs = renews && sub.collection_method === 'charge_automatically' && !hasPaymentMethod;
  return { needs_card: needs, on: needs ? on : null };
}

/** The same, asked of Stripe for one subscription on a connected account. */
export async function renewalCardState(stripe: Stripe, account: string, subscriptionId: string): Promise<RenewalCard> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['customer'] }, { stripeAccount: account });
  const cust = typeof sub.customer === 'object' && !('deleted' in sub.customer && sub.customer.deleted) ? (sub.customer as Stripe.Customer) : null;
  const has = !!(sub.default_payment_method || sub.default_source || cust?.invoice_settings?.default_payment_method || cust?.default_source);
  return renewalNeedsCard({ ...sub, period_end: sub.items.data[0]?.current_period_end ?? null }, has);
}
