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

  // Operating costs — the operator's own Pulse budget lines (category
  // "Platform infrastructure", seeded by scripts/seed-operating-costs.mjs,
  // edited in Pulse → Budget). Scoped to workspaces the requesting super
  // admin is a MEMBER of: this reads their own data under their own
  // authority, the same in-family table sharing Meet/Thread/Flow practise —
  // not a peek into any tenant's books.
  const costs = await operatingCosts(ctx.userId);

  return c.json({
    mrr_cents: mrr,
    arr_cents: mrr * 12,
    by_plan: byPlan,
    paying,
    comped,
    income,
    pipeline,
    costs,
  });
});

// ---------------------------------------------------------------------------
// GET /invoices — the SELLER's view of the platform's own invoices: every
// fibre-platform purchase row across all workspaces (they live in each
// customer's workspace, so the normal workspace-scoped Invoices pages can't
// show the operator this list). Same ledger, other side of the counter.
// ---------------------------------------------------------------------------
adminEconomicsRoutes.get('/invoices', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isSuperAdminUser(ctx))) {
    return c.json({ error: 'super admin required' }, 403);
  }
  const { data: app } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', 'fibre-platform')
    .maybeSingle();
  if (!app) return c.json({ items: [] });

  // Newest first; 200 covers years at current scale. Revisit with a cursor
  // when the platform has more paying workspaces than this page can hold —
  // a fine problem to have.
  const { data, error } = await adminClient
    .from('purchase')
    .select(
      'id, item_label, amount_cents, currency, status, method, paid_at, refunded_at, created_at, payer_name, payer_email, stripe_invoice_url, workspace:workspace_id (name, slug)',
    )
    .eq('app_id', app.id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error('[admin-economics invoices]', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ items: data ?? [] });
});

const COST_CATEGORY = 'Platform infrastructure';

/** Cadence → what it costs per month. */
function monthlyCents(amountCents: number, cadence: string): number {
  switch (cadence) {
    case 'weekly':
      return Math.round((amountCents * 52) / 12);
    case 'fortnightly':
      return Math.round((amountCents * 26) / 12);
    case 'quarterly':
      return Math.round(amountCents / 3);
    case 'yearly':
      return Math.round(amountCents / 12);
    default:
      return amountCents; // monthly
  }
}

async function operatingCosts(userId: string): Promise<{
  lines: { label: string; cadence: string; amount_cents: number; monthly_cents: number }[];
  monthly_total_cents: number;
  category: string;
}> {
  const { data: memberships } = await adminClient
    .from('workspace_member')
    .select('workspace_id')
    .eq('user_id', userId);
  const wsIds = (memberships ?? []).map((m) => m.workspace_id);
  if (wsIds.length === 0) return { lines: [], monthly_total_cents: 0, category: COST_CATEGORY };

  const { data: rows } = await adminClient
    .from('pulse_budget_line')
    .select('label, cadence, amount_cents, direction, included')
    .in('workspace_id', wsIds)
    .eq('category', COST_CATEGORY)
    .eq('direction', 'out')
    .is('archived_at', null);

  const lines = (rows ?? [])
    .filter((r) => r.included)
    .map((r) => ({
      label: r.label as string,
      cadence: r.cadence as string,
      amount_cents: Number(r.amount_cents),
      monthly_cents: monthlyCents(Number(r.amount_cents), r.cadence as string),
    }))
    .sort((a, b) => b.monthly_cents - a.monthly_cents);

  return {
    lines,
    monthly_total_cents: lines.reduce((s, l) => s + l.monthly_cents, 0),
    category: COST_CATEGORY,
  };
}
