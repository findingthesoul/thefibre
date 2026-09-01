// GET /api/v1/plan — what this workspace is on, and what it is using.
//
// Every refusal elsewhere names a plan; this is where that name leads. It
// answers three questions in one payload: what am I on, what am I using
// against it, and what would the next one give me.
//
// Readable by any member. A plan is not a secret from the people it limits,
// and someone hitting a seat limit should be able to see the number that
// stopped them without asking an admin.

import { Hono } from 'hono';
import { adminClient } from '../db.js';
import { planFor, seatsUsed, emailUsage, sortPlans } from '../lib/plan.js';
import { stripeOrNull } from '../lib/stripe/client.js';

export const planRoutes = new Hono();

planRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  const [plan, seats, email] = await Promise.all([
    planFor(ctx.workspaceId),
    seatsUsed(ctx.workspaceId),
    emailUsage(ctx.workspaceId),
  ]);

  // The catalogue, so the screen can say what moving up would give — read from
  // the same rows the gates read, never a second list in the frontend that
  // drifts from what is enforced.
  const { data: catalogue } = await adminClient
    .from('billing_plan')
    .select(
      'id, name, price_cents_month, price_cents_year, included_seats, extra_seat_cents_month, included_emails_month, included_storage_gb, retention_months, meet_paid_pct, meet_paid_cap_cents, features, stripe_price_id_month',
    )
    .order('price_cents_month');

  // Whether the upgrade button can be a real checkout (Stripe key present and
  // plans synced) or has to stay "talk to us". The price ids themselves stay
  // server-side.
  const stripeReady =
    stripeOrNull() !== null && (catalogue ?? []).some((p) => p.stripe_price_id_month);
  const { data: sub } = await adminClient
    .from('workspace_subscription')
    .select('stripe_subscription_id, billing_interval, current_period_end, cancel_at_period_end')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  return c.json({
    plan: {
      id: plan.id,
      name: plan.name,
      status: plan.status,
      comped: plan.comped,
      price_cents_month: plan.priceCentsMonth,
      price_cents_year: plan.priceCentsYear,
      // What THIS workspace actually pays — a tailored price when a super
      // admin set one, the list price otherwise. Display uses this; the
      // feature gates never do.
      effective_price_cents_month: plan.customPriceCentsMonth ?? plan.priceCentsMonth,
      effective_price_cents_year: plan.customPriceCentsYear ?? plan.priceCentsYear,
      tailored: plan.customPriceCentsMonth !== null || plan.customPriceCentsYear !== null,
      included_seats: plan.includedSeats,
      extra_seat_cents_month: plan.extraSeatCentsMonth,
      included_emails_month: plan.includedEmailsMonth,
      included_storage_gb: plan.includedStorageGb,
      retention_months: plan.retentionMonths,
      thread_live_limit: plan.threadLiveLimit,
      features: plan.features,
    },
    usage: {
      seats_used: seats,
      emails_this_month: email.sent,
      emails_included: email.included,
      // Seats past the allowance — billed as a quantity on the subscription
      // (lib/seat-billing.ts) when one exists.
      extra_seats:
        plan.includedSeats === null ? 0 : Math.max(0, seats - plan.includedSeats),
    },
    catalogue: sortPlans(catalogue ?? []).map(({ stripe_price_id_month: _omit, ...rest }) => rest),
    billing: {
      available: stripeReady,
      subscribed: Boolean(sub?.stripe_subscription_id),
      interval: sub?.billing_interval ?? null,
      current_period_end: sub?.current_period_end ?? null,
      cancel_at_period_end: sub?.cancel_at_period_end ?? false,
    },
  });
});
