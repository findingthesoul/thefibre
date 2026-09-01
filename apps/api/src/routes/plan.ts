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
import { planFor, seatsUsed, emailUsage } from '../lib/plan.js';

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
      'id, name, price_cents_month, price_cents_year, included_seats, extra_seat_cents_month, included_emails_month, included_storage_gb, retention_months, meet_paid_pct, meet_paid_cap_cents, features',
    )
    .order('price_cents_month');

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
    },
    catalogue: catalogue ?? [],
  });
});
