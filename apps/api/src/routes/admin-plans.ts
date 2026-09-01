// /api/v1/admin/plans — the tier matrix, read and edited by the platform
// super admin. These are the SAME billing_plan rows lib/plan.ts gates on and
// GET /plan + /public/plans display, so the matrix, the pricing page and
// enforcement cannot drift from each other.
//
// What a PATCH can change: prices, allowances, the fee ladder, and the value
// of existing feature keys. What it cannot change: which feature keys EXIST —
// a new gate is a PlanFeature entry plus a can() call site, i.e. a deploy,
// the same deliberate choice as app-key scopes (v0.14.0).

import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';
import { forgetAllPlans, sortPlans } from '../lib/plan.js';
import { isSuperAdminUser } from '../lib/super-admin.js';

export const adminPlansRoutes = new Hono();

const PLAN_COLUMNS =
  'id, name, price_cents_month, price_cents_year, price_cents_user_month, included_seats, extra_seat_cents_month, included_emails_month, included_storage_gb, retention_months, meet_paid_pct, meet_paid_cap_cents, features, created_at';

adminPlansRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isSuperAdminUser(ctx))) {
    return c.json({ error: 'super admin required' }, 403);
  }

  const [{ data: plans, error }, { data: subs, error: sErr }] = await Promise.all([
    adminClient.from('billing_plan').select(PLAN_COLUMNS).order('price_cents_month'),
    adminClient.from('workspace_subscription').select('plan_id, status'),
  ]);
  if (error || sErr) {
    console.error('[admin-plans GET]', error ?? sErr);
    return c.json({ error: (error ?? sErr)?.message }, 500);
  }

  // Who sits where — the matrix should show that a plan edit touches real
  // tenants, not an empty column.
  const counts: Record<string, { total: number; comped: number }> = {};
  for (const s of subs ?? []) {
    const row = (counts[s.plan_id] ??= { total: 0, comped: 0 });
    row.total += 1;
    if (s.status === 'comped') row.comped += 1;
  }

  return c.json({
    plans: sortPlans(plans ?? []).map((p) => ({
      ...p,
      workspaces: counts[p.id] ?? { total: 0, comped: 0 },
    })),
  });
});

// Feature values are booleans, except thread_live_limit (a count, null = no
// limit). Keys are free-form snake_case so a gate deployed tomorrow is
// editable without another API change — the matrix UI only offers known keys.
const FeatureValue = z.union([z.boolean(), z.number().int().min(0), z.null()]);
const PatchBody = z
  .object({
    name: z.string().min(1).max(80),
    price_cents_month: z.number().int().min(0),
    price_cents_year: z.number().int().min(0).nullable(),
    included_seats: z.number().int().min(0).nullable(),
    extra_seat_cents_month: z.number().int().min(0).nullable(),
    included_emails_month: z.number().int().min(0).nullable(),
    included_storage_gb: z.number().int().min(0).nullable(),
    retention_months: z.number().int().min(1).nullable(),
    meet_paid_pct: z.number().min(0).max(1),
    meet_paid_cap_cents: z.number().int().min(0).nullable(),
    features: z.record(z.string().regex(/^[a-z0-9_]{1,64}$/), FeatureValue),
  })
  .partial();

adminPlansRoutes.patch('/:id', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isSuperAdminUser(ctx))) {
    return c.json({ error: 'super admin required' }, 403);
  }
  const id = c.req.param('id');
  const body = PatchBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  if (Object.keys(body.data).length === 0) {
    return c.json({ error: 'nothing to change' }, 400);
  }

  // Merge features rather than replace: the matrix sends what it knows, and a
  // key added by a newer deploy must not be wiped by an older browser tab.
  let update: Record<string, unknown> = { ...body.data };
  if (body.data.features) {
    const { data: current } = await adminClient
      .from('billing_plan')
      .select('features')
      .eq('id', id)
      .maybeSingle();
    if (!current) return c.json({ error: 'plan not found' }, 404);
    update = {
      ...update,
      features: { ...(current.features ?? {}), ...body.data.features },
    };
  }

  const { data, error } = await adminClient
    .from('billing_plan')
    .update(update)
    .eq('id', id)
    .select(PLAN_COLUMNS)
    .maybeSingle();
  if (error) {
    console.error('[admin-plans PATCH]', error);
    return c.json({ error: error.message }, 500);
  }
  if (!data) return c.json({ error: 'plan not found' }, 404);

  // The plan cache is keyed by workspace and this touched every workspace on
  // the plan — drop all of it. Live within one request, not one TTL.
  forgetAllPlans();

  return c.json({ plan: data });
});
