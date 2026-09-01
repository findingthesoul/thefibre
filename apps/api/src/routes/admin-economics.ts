// /api/v1/admin/economics — the platform's own bookkeeping, super-admin only.
//
// Platform tables ONLY: workspace_subscription × billing_plan (recurring
// revenue), the purchase ledger (fees + subscription invoices), and
// signup_request (the pipeline). No app-owned table is read — the data wall
// applies to the operator too. The richer business view (operating costs,
// runway, per-account income) is Pulse, in Sjoerd's own workspace, fed
// through the sanctioned purchase-ledger crossing.

import { Hono } from 'hono';
import { adminClient } from '../db.js';
import { isSuperAdminUser } from '../lib/super-admin.js';

export const adminEconomicsRoutes = new Hono();

type SubJoin = {
  workspace_id: string;
  status: string;
  billing_interval: string;
  comped_reason: string | null;
  custom_price_cents_month: number | null;
  custom_price_cents_year: number | null;
  plan:
    | { id: string; name: string; price_cents_month: number; price_cents_year: number | null }
    | { id: string; name: string; price_cents_month: number; price_cents_year: number | null }[]
    | null;
  workspace: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** What this subscription adds to MRR, in cents. Comped and canceled add 0. */
function mrrCents(s: SubJoin): number {
  if (s.status !== 'active' && s.status !== 'trialing' && s.status !== 'past_due') return 0;
  const plan = one(s.plan);
  if (!plan) return 0;
  if (s.billing_interval === 'annual') {
    const year = s.custom_price_cents_year ?? plan.price_cents_year;
    if (year) return Math.round(year / 12);
  }
  return s.custom_price_cents_month ?? plan.price_cents_month ?? 0;
}

adminEconomicsRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isSuperAdminUser(ctx))) {
    return c.json({ error: 'super admin required' }, 403);
  }

  const since90 = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();

  const [subsRes, purchasesRes, pipelineRes] = await Promise.all([
    adminClient
      .from('workspace_subscription')
      .select(
        `workspace_id, status, billing_interval, comped_reason,
         custom_price_cents_month, custom_price_cents_year,
         plan:plan_id (id, name, price_cents_month, price_cents_year),
         workspace:workspace_id (name, slug)`,
      ),
    adminClient
      .from('purchase')
      .select('amount_cents, platform_fee_cents, paid_at, app:app_id (slug)')
      .eq('status', 'paid')
      .gte('paid_at', since90),
    adminClient.from('signup_request').select('status'),
  ]);

  if (subsRes.error || purchasesRes.error || pipelineRes.error) {
    const err = subsRes.error ?? purchasesRes.error ?? pipelineRes.error;
    console.error('[admin-economics]', err);
    return c.json({ error: err?.message }, 500);
  }

  const subs = (subsRes.data ?? []) as unknown as SubJoin[];

  // Recurring revenue + who sits where.
  let mrr = 0;
  const byPlan: Record<
    string,
    { name: string; total: number; paying: number; comped: number; mrr_cents: number }
  > = {};
  const comped: { workspace: string; slug: string; plan: string; reason: string | null }[] = [];
  const paying: {
    workspace: string;
    slug: string;
    plan: string;
    status: string;
    interval: string;
    mrr_cents: number;
    tailored: boolean;
  }[] = [];

  for (const s of subs) {
    const plan = one(s.plan);
    const ws = one(s.workspace);
    if (!plan) continue;
    const row = (byPlan[plan.id] ??= {
      name: plan.name,
      total: 0,
      paying: 0,
      comped: 0,
      mrr_cents: 0,
    });
    row.total += 1;
    const cents = mrrCents(s);
    mrr += cents;
    row.mrr_cents += cents;
    if (s.status === 'comped') {
      row.comped += 1;
      comped.push({
        workspace: ws?.name ?? s.workspace_id,
        slug: ws?.slug ?? '',
        plan: plan.name,
        reason: s.comped_reason,
      });
    } else if (cents > 0) {
      row.paying += 1;
      paying.push({
        workspace: ws?.name ?? s.workspace_id,
        slug: ws?.slug ?? '',
        plan: plan.name,
        status: s.status,
        interval: s.billing_interval,
        mrr_cents: cents,
        tailored: s.custom_price_cents_month !== null || s.custom_price_cents_year !== null,
      });
    }
  }

  // Ledger income: Connect fees on app sales, full amount on our own
  // subscription invoices ('fibre-platform' rows).
  const now = Date.now();
  const income = {
    d30: { fees_cents: 0, subscriptions_cents: 0, sales_count: 0 },
    d90: { fees_cents: 0, subscriptions_cents: 0, sales_count: 0 },
  };
  for (const p of purchasesRes.data ?? []) {
    const slug = one(p.app as { slug: string } | { slug: string }[] | null)?.slug;
    const paidAt = p.paid_at ? new Date(p.paid_at).getTime() : 0;
    const buckets: (typeof income.d30)[] = [income.d90];
    if (now - paidAt <= 30 * 24 * 3600 * 1000) buckets.push(income.d30);
    for (const b of buckets) {
      if (slug === 'fibre-platform') {
        b.subscriptions_cents += p.amount_cents ?? 0;
      } else {
        b.fees_cents += p.platform_fee_cents ?? 0;
        b.sales_count += 1;
      }
    }
  }

  const pipeline: Record<string, number> = {};
  for (const r of pipelineRes.data ?? []) {
    pipeline[r.status] = (pipeline[r.status] ?? 0) + 1;
  }

  return c.json({
    mrr_cents: mrr,
    arr_cents: mrr * 12,
    by_plan: byPlan,
    paying,
    comped,
    income,
    pipeline,
  });
});
