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

  const { data: memberships } = await db
    .from('app_membership')
    .select('app_id, role, permissions, app:app_id (slug, name)')
    .eq('user_id', ctx.userId);

  const { data: workspace } = await db
    .from('workspace')
    .select('id, slug, name, plan, created_at')
    .eq('id', user.workspace_id)
    .single();

  return c.json({ user, workspace, memberships: memberships ?? [], app_id: ctx.appId });
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
