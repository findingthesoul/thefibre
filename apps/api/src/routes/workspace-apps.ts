import { Hono } from 'hono';
import { z } from 'zod';
import { userClient } from '../db.js';

export const workspaceAppsRoutes = new Hono();

const INSTALLABLE = ['fibre-meet', 'the-thread', 'fibre-sales', 'fibre-learn'] as const;
type InstallableSlug = (typeof INSTALLABLE)[number];

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
  app_slug: z.enum(INSTALLABLE),
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
  const slug: InstallableSlug = body.data.app_slug;

  // Resolve app id
  const { data: app, error: aErr } = await db
    .from('app')
    .select('id, slug, name, base_url')
    .eq('slug', slug)
    .single();
  if (aErr || !app) return c.json({ error: 'app not found' }, 404);

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
  if (!INSTALLABLE.includes(slug as InstallableSlug)) {
    return c.json({ error: 'unknown app' }, 400);
  }

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data: app, error: aErr } = await db
    .from('app')
    .select('id')
    .eq('slug', slug)
    .single();
  if (aErr || !app) return c.json({ error: 'app not found' }, 404);

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
