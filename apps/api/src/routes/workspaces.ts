import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';
import { forgetPlan } from '../lib/plan.js';
import { isSuperAdminUser } from '../lib/super-admin.js';

export const workspacesRoutes = new Hono();

/**
 * Every workspace on the platform, with live counts and its subscription.
 * Super-admin only.
 *
 *  - CREATE exists since the productisation slice (docs/productisation-
 *    proposal.md §2.2): a super admin onboarding a chosen organisation — a
 *    social enterprise being given a workspace — should not have to make them
 *    file a signup request first. The signup-request path remains the door
 *    for people who ask; this is the door for people we invite.
 *  - There is STILL no delete. `workspace_id` is referenced by 54 tables;
 *    removing one is a cascade you cannot preview from a confirm dialog. If a
 *    delete is ever added it must refuse unless the workspace is provably
 *    empty, the way the Festival-of-Trust cleanup did.
 *
 * Runs on `adminClient` because the `workspace_self` RLS policy scopes SELECT
 * to `current_workspace_id()` — even a super admin's own JWT cannot see anyone
 * else's workspace. So the super-admin check below is the entire gate, not a
 * nicety on top of RLS. Do not remove it.
 */

type CountSpec = { table: string; key: string; filter?: (q: any) => any };

const COUNTS: CountSpec[] = [
  { table: 'user', key: 'users', filter: (q) => q.is('deleted_at', null) },
  { table: 'person', key: 'people', filter: (q) => q.is('deleted_at', null) },
  { table: 'organisation', key: 'organisations', filter: (q) => q.is('deleted_at', null) },
  // activity is append-only — it has no deleted_at to filter on, by design.
  { table: 'activity', key: 'activities' },
  { table: 'workspace_app', key: 'apps', filter: (q) => q.is('deactivated_at', null) },
];

workspacesRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isSuperAdminUser(ctx))) {
    return c.json({ error: 'super admin required' }, 403);
  }

  const [{ data: rows, error }, { data: subs, error: sErr }] = await Promise.all([
    adminClient
      .from('workspace')
      .select('id, slug, name, created_at')
      .order('created_at', { ascending: true }),
    // The authoritative plan. `workspace.plan`, the text column, is legacy and
    // no longer selected — showing it here is how it kept looking alive.
    adminClient
      .from('workspace_subscription')
      .select(
        'workspace_id, plan_id, status, comped_reason, comped_until, custom_price_cents_month, custom_price_cents_year, plan:plan_id(name, price_cents_month)',
      ),
  ]);
  if (error || sErr) {
    console.error('[workspaces GET] list failed', error ?? sErr);
    return c.json({ error: (error ?? sErr)?.message }, 500);
  }
  const subByWs = new Map((subs ?? []).map((s) => [s.workspace_id, s]));

  // N × 5 head-count queries. Fine at the scale this platform runs at, and
  // honest — a cached aggregate would go stale exactly when you are using this
  // page to check whether something is real. Revisit past ~100 workspaces.
  const items = await Promise.all(
    (rows ?? []).map(async (w) => {
      const counts: Record<string, number> = {};
      await Promise.all(
        COUNTS.map(async ({ table, key, filter }) => {
          let q = adminClient
            .from(table)
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', w.id);
          if (filter) q = filter(q);
          const { count, error: cErr } = await q;
          if (cErr) {
            console.error(`[workspaces GET] count ${table} failed`, cErr);
            counts[key] = -1; // surfaced as "?" rather than a false zero
            return;
          }
          counts[key] = count ?? 0;
        }),
      );
      const sub = subByWs.get(w.id);
      const plan = sub ? ((Array.isArray(sub.plan) ? sub.plan[0] : sub.plan) as {
        name: string;
        price_cents_month: number;
      } | null) : null;
      return {
        ...w,
        counts,
        subscription: sub
          ? {
              plan_id: sub.plan_id,
              plan_name: plan?.name ?? sub.plan_id,
              status: sub.status,
              comped_reason: sub.comped_reason,
              comped_until: sub.comped_until,
              custom_price_cents_month: sub.custom_price_cents_month,
              custom_price_cents_year: sub.custom_price_cents_year,
              list_price_cents_month: plan?.price_cents_month ?? 0,
            }
          : null,
        // A workspace nobody has ever signed into. This is the signal the page
        // exists for — an accidental or abandoned tenant, visible at a glance.
        is_empty: counts.users === 0 && counts.people === 0 && counts.activities === 0,
        is_yours: w.id === ctx.workspaceId,
      };
    }),
  );

  return c.json({ items });
});

// ---------------------------------------------------------------------------
// POST / — create a workspace directly. Super-admin only.
//
// The invited-in door: a social enterprise Sjoerd wants on the platform gets
// a workspace (with its plan, comp, or tailored price set in the same breath)
// without filing a signup request. The subscription row itself is created by
// the on_workspace_insert trigger (free + comped); we then move it to what
// was asked for.
// ---------------------------------------------------------------------------
const CreateBody = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/)
    .optional(),
  plan_id: z.string().min(1).max(40).optional(),
  comped: z.boolean().optional(),
  comped_reason: z.string().max(500).nullable().optional(),
  custom_price_cents_month: z.number().int().min(0).nullable().optional(),
  custom_price_cents_year: z.number().int().min(0).nullable().optional(),
});

workspacesRoutes.post('/', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isSuperAdminUser(ctx))) {
    return c.json({ error: 'super admin required' }, 403);
  }
  const body = CreateBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const b = body.data;

  if (b.plan_id) {
    const { data: plan } = await adminClient
      .from('billing_plan')
      .select('id')
      .eq('id', b.plan_id)
      .maybeSingle();
    if (!plan) return c.json({ error: `unknown plan "${b.plan_id}"` }, 400);
  }

  const slugBase =
    b.slug ??
    b.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  // Same suffix scheme as signup approval — collisions on a hand-typed slug
  // come back as a clean 409 instead.
  const slug = b.slug ? b.slug : `${slugBase || 'workspace'}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: ws, error: wsErr } = await adminClient
    .from('workspace')
    .insert({ slug, name: b.name })
    .select('id, slug')
    .single();
  if (wsErr || !ws) {
    if (wsErr?.code === '23505') return c.json({ error: `slug "${slug}" is taken` }, 409);
    console.error('[workspaces POST] create failed', wsErr);
    return c.json({ error: wsErr?.message ?? 'create failed' }, 500);
  }

  if (b.plan_id || b.comped !== undefined || b.comped_reason !== undefined ||
      b.custom_price_cents_month !== undefined || b.custom_price_cents_year !== undefined) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (b.plan_id) patch.plan_id = b.plan_id;
    if (b.comped !== undefined) {
      patch.status = b.comped ? 'comped' : 'active';
      patch.comped_by = b.comped ? ctx.userId : null;
      patch.comped_reason = b.comped ? (b.comped_reason ?? null) : null;
    } else if (b.comped_reason !== undefined) {
      patch.comped_reason = b.comped_reason;
    }
    if (b.custom_price_cents_month !== undefined) patch.custom_price_cents_month = b.custom_price_cents_month;
    if (b.custom_price_cents_year !== undefined) patch.custom_price_cents_year = b.custom_price_cents_year;
    const { error: subErr } = await adminClient
      .from('workspace_subscription')
      .update(patch)
      .eq('workspace_id', ws.id);
    if (subErr) {
      console.error('[workspaces POST] subscription update failed', subErr);
      return c.json({ error: subErr.message }, 500);
    }
  }
  forgetPlan(ws.id);
  return c.json({ ok: true, workspace_id: ws.id, slug: ws.slug });
});

// ---------------------------------------------------------------------------
// PATCH /:id/subscription — plan, comp, tailored price. Super-admin only.
//
// Prices and comps only ever change what a workspace PAYS and what its plan
// screen says; feature gates always follow plan_id. Setting `comped: false`
// on a workspace with no Stripe subscription leaves it 'active' unpaid —
// fine during the trial, and the Stripe phase will reconcile status itself.
// ---------------------------------------------------------------------------
const SubscriptionBody = z
  .object({
    plan_id: z.string().min(1).max(40),
    comped: z.boolean(),
    comped_reason: z.string().max(500).nullable(),
    comped_until: z.string().datetime().nullable(),
    custom_price_cents_month: z.number().int().min(0).nullable(),
    custom_price_cents_year: z.number().int().min(0).nullable(),
  })
  .partial();

workspacesRoutes.patch('/:id/subscription', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isSuperAdminUser(ctx))) {
    return c.json({ error: 'super admin required' }, 403);
  }
  const workspaceId = c.req.param('id');
  const body = SubscriptionBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const b = body.data;
  if (Object.keys(b).length === 0) return c.json({ error: 'nothing to change' }, 400);

  if (b.plan_id) {
    const { data: plan } = await adminClient
      .from('billing_plan')
      .select('id')
      .eq('id', b.plan_id)
      .maybeSingle();
    if (!plan) return c.json({ error: `unknown plan "${b.plan_id}"` }, 400);
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.plan_id !== undefined) patch.plan_id = b.plan_id;
  if (b.comped !== undefined) {
    patch.status = b.comped ? 'comped' : 'active';
    patch.comped_by = b.comped ? ctx.userId : null;
    if (!b.comped) {
      patch.comped_reason = null;
      patch.comped_until = null;
    }
  }
  if (b.comped_reason !== undefined) patch.comped_reason = b.comped_reason;
  if (b.comped_until !== undefined) patch.comped_until = b.comped_until;
  if (b.custom_price_cents_month !== undefined) patch.custom_price_cents_month = b.custom_price_cents_month;
  if (b.custom_price_cents_year !== undefined) patch.custom_price_cents_year = b.custom_price_cents_year;

  const { data, error } = await adminClient
    .from('workspace_subscription')
    .update(patch)
    .eq('workspace_id', workspaceId)
    .select('workspace_id')
    .maybeSingle();
  if (error) {
    console.error('[workspaces PATCH subscription]', error);
    return c.json({ error: error.message }, 500);
  }
  if (!data) return c.json({ error: 'workspace not found' }, 404);

  // The gate cache answers for this workspace changed right now.
  forgetPlan(workspaceId);
  return c.json({ ok: true });
});
