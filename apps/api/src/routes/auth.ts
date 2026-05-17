import { Hono } from 'hono';
import { z } from 'zod';
import { userClient } from '../db.js';

export const authRoutes = new Hono();

authRoutes.get('/me', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data: user, error } = await db
    .from('user')
    .select('id, email, full_name, avatar_url, person_id, workspace_id, primary_auth_method, last_sign_in, is_super_admin')
    .eq('id', ctx.userId)
    .is('deleted_at', null)
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // Filter app_membership to apps the workspace has actually activated
  // (workspace_app row with deactivated_at IS NULL). A leftover membership
  // for an app that's currently off is dormant, not access — and showing
  // it on /settings made the page contradict /settings/apps (v0.13.10
  // fixed the same bug on the contact-profile endpoint).
  const [{ data: rawMemberships }, { data: activeApps }] = await Promise.all([
    db
      .from('app_membership')
      .select('app_id, role, permissions, app:app_id (slug, name)')
      .eq('user_id', ctx.userId),
    db
      .from('workspace_app')
      .select('app_id')
      .eq('workspace_id', user.workspace_id)
      .is('deactivated_at', null),
  ]);
  const activeAppIds = new Set((activeApps ?? []).map((r) => r.app_id as string));
  // fibre-platform is The Fibre itself — there's no workspace_app row for it
  // because you can't deactivate the platform from itself. Always include
  // it so the workspace-admin gate on /settings/apps keeps working.
  const memberships = (rawMemberships ?? []).filter((m) => {
    const appRow = Array.isArray(m.app) ? m.app[0] : m.app;
    if (appRow?.slug === 'fibre-platform') return true;
    return activeAppIds.has(m.app_id as string);
  });

  const { data: workspace } = await db
    .from('workspace')
    .select('id, slug, name, plan, created_at')
    .eq('id', user.workspace_id)
    .single();

  return c.json({ user, workspace, memberships, app_id: ctx.appId });
});

const MeUpdate = z.object({
  full_name: z.string().min(1).max(200).optional(),
  avatar_url: z.string().max(500).nullable().optional(),
});

authRoutes.patch('/me', async (c) => {
  const body = MeUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('user')
    .update(body.data)
    .eq('id', ctx.userId)
    .is('deleted_at', null)
    .select('id, email, full_name, avatar_url')
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});
