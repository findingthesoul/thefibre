import { Hono } from 'hono';
import { z } from 'zod';
import { can, planFor, needsPlan, type PlanFeature } from '../lib/plan.js';
import { userClient, adminClient } from '../db.js';
import { ensurePipelineFlow } from '../lib/pulse-pipeline.js';

export const workspaceAppsRoutes = new Hono();

// What may be activated is no longer a constant in this file. It is any app
// whose row says `status = 'approved'` — the gate docs/brief-external-apps.md
// §1 moved from a hardcoded list onto the row. `fibre-platform` is excluded
// because it isn't installable: it IS the platform.
//
// The DB has the last word regardless: workspace_app_approved_gate rejects the
// insert if the app isn't approved. This lookup exists to return a clean 400
// instead of a trigger's exception.
async function resolveInstallableApp(slug: string) {
  const { data } = await adminClient
    .from('app')
    .select('id, slug, name, base_url, status, released_at, kind')
    .eq('slug', slug)
    .maybeSingle();
  if (!data) return { app: null, error: 'app not found' as const };
  if (slug === 'fibre-platform') return { app: null, error: 'fibre-platform is not installable' as const };
  if (data.status !== 'approved') {
    return { app: null, error: `app "${slug}" is ${data.status}, not approved` as const };
  }
  // Approved says a human allowed it to act. released_at says it exists at all.
  // Without this check a workspace can switch on an app that will never render
  // a page — see 20260824210000_app_released_at.sql.
  if (!data.released_at) {
    return { app: null, error: `app "${slug}" is not built yet` as const };
  }
  return { app: data, error: null };
}

// GET /api/v1/workspace-apps — installed apps for the current workspace.
// Returns one row per installed app with the app metadata expanded.
workspaceAppsRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('workspace_app')
    .select(
      'id, app_id, activated_at, activated_by, deactivated_at, settings, app:app_id (slug, name, base_url)',
    )
    .is('deactivated_at', null);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});

const ActivateBody = z.object({
  app_slug: z.string().min(3).max(50),
});

// POST /api/v1/workspace-apps — activate an app for this workspace.
// Workspace-admin gated by RLS (is_platform_admin AND workspace match).
// Also auto-grants the activating user a default membership for that app
// so they can immediately use it without an extra step.
workspaceAppsRoutes.post('/', async (c) => {
  const body = ActivateBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const slug = body.data.app_slug;

  const { app, error: resolveErr } = await resolveInstallableApp(slug);
  if (!app) return c.json({ error: resolveErr }, resolveErr === 'app not found' ? 404 : 400);

  // The plan gate for Flow and Pulse, and it is the ONLY one they need.
  // Both apps already refuse to render for a workspace that has not activated
  // them (their layouts redirect to /no-access), so refusing the activation
  // gates the whole app — no plan check scattered through their routes, and
  // nothing half-open if one is missed.
  //
  // Third-party apps are gated the same way, one line further down the same
  // list: installing somebody else's app is a Pro capability.
  const GATED: Record<string, { feature: PlanFeature; label: string }> = {
    'fibre-flow': { feature: 'flow', label: 'Fibre Flow' },
    'fibre-pulse': { feature: 'pulse', label: 'Fibre Pulse' },
  };
  const gate = GATED[slug];
  if (gate && !(await can(ctx.workspaceId, gate.feature))) {
    const plan = await planFor(ctx.workspaceId);
    return c.json({ error: needsPlan(gate.label, 'Pro'), plan: plan.name }, 402);
  }
  if (app.kind === 'third_party' && !(await can(ctx.workspaceId, 'third_party_apps'))) {
    const plan = await planFor(ctx.workspaceId);
    return c.json({ error: needsPlan('Installing apps built outside The Fibre', 'Pro'), plan: plan.name }, 402);
  }

  // Upsert workspace_app — re-activating a previously deactivated row clears
  // deactivated_at and bumps activated_at.
  const { data: wapp, error: wErr } = await db
    .from('workspace_app')
    .upsert(
      {
        workspace_id: ctx.workspaceId,
        app_id: app.id,
        activated_by: ctx.userId,
        activated_at: new Date().toISOString(),
        deactivated_at: null,
      },
      { onConflict: 'workspace_id,app_id' },
    )
    .select('id, app_id, activated_at, activated_by, settings')
    .single();
  if (wErr) {
    console.error('[workspace-apps POST]', wErr);
    return c.json({ error: wErr.message, code: wErr.code }, 500);
  }

  // Pulse ships with its Pipeline — a real Fibre Flow definition (steps,
  // transitions, canvas) plus the pulse_stage mirror. Idempotent.
  if (slug === 'fibre-pulse') {
    await ensurePipelineFlow(ctx.workspaceId, ctx.userId);
  }

  // Grant the activating user membership for this app (idempotent).
  // Default role = 'admin' — they activated it; they own its config.
  const { error: mErr } = await db
    .from('app_membership')
    .upsert(
      {
        user_id: ctx.userId,
        app_id: app.id,
        role: 'admin',
      },
      { onConflict: 'user_id,app_id' },
    );
  if (mErr) {
    console.error('[workspace-apps POST] membership upsert', mErr);
    // Non-fatal: the app is activated. The user can grant themselves access
    // via a future members UI.
  }

  return c.json({ ok: true, app, workspace_app: wapp });
});

// DELETE /api/v1/workspace-apps/:slug — deactivate an app.
// Soft delete: we keep the row with deactivated_at set so historical activity
// rows still resolve their app metadata.
workspaceAppsRoutes.delete('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  // adminClient, not userClient: a suspended app is invisible to a normal user
  // under the app read policy, and you must still be able to deactivate one.
  const { data: app } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!app) return c.json({ error: 'app not found' }, 404);

  const { error } = await db
    .from('workspace_app')
    .update({ deactivated_at: new Date().toISOString() })
    .eq('workspace_id', ctx.workspaceId)
    .eq('app_id', app.id);
  if (error) {
    console.error('[workspace-apps DELETE]', error);
    return c.json({ error: error.message }, 500);
  }
  return c.body(null, 204);
});

// ===========================================================================
// GET /api/v1/workspace-apps/billing
//
// The workspace's current subscription + plan features. UI uses this to
// gate features ("Pro required"), show the plan badge, and decide
// whether to render an upgrade prompt. Service-role read because the
// plan row (billing_plan) has no RLS — features are workspace-wide and
// not private.
// ===========================================================================
workspaceAppsRoutes.get('/billing', async (c) => {
  const ctx = c.get('ctx');
  const { data: sub, error: sErr } = await adminClient
    .from('workspace_subscription')
    .select(
      'plan_id, status, billing_interval, current_period_end, cancel_at_period_end, trial_ends_at, seat_count, comped_reason, comped_until',
    )
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (sErr) {
    console.error('[workspace billing] sub lookup failed', sErr);
    return c.json({ error: sErr.message }, 500);
  }
  if (!sub) {
    // Pre-migration safety: workspace exists but has no subscription
    // row (shouldn't happen post-Phase-2 backfill, but if it does we
    // treat it as Free so callers don't have to special-case null).
    return c.json({
      plan: { id: 'free', name: 'Free', features: {} },
      subscription: null,
    });
  }
  const { data: plan, error: pErr } = await adminClient
    .from('billing_plan')
    .select(
      'id, name, price_cents_user_month, meet_paid_pct, meet_paid_cap_cents, features',
    )
    .eq('id', sub.plan_id)
    .single();
  if (pErr) {
    console.error('[workspace billing] plan lookup failed', pErr);
    return c.json({ error: pErr.message }, 500);
  }
  return c.json({ plan, subscription: sub });
});
