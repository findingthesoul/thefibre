import { Hono } from 'hono';
import { userClient } from '../db.js';

export const authRoutes = new Hono();

authRoutes.get('/me', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data: user, error } = await db
    .from('user')
    .select('id, email, full_name, avatar_url, person_id, workspace_id')
    .eq('id', ctx.userId)
    .is('deleted_at', null)
    .single();

  if (error) return c.json({ error: error.message }, 500);

  const { data: memberships } = await db
    .from('app_membership')
    .select('app_id, role, permissions, app:app_id (slug, name)')
    .eq('user_id', ctx.userId);

  return c.json({ user, memberships: memberships ?? [], app_id: ctx.appId });
});
