import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient, userClient } from '../db.js';

// ===========================================================================
// The platform public profile — ONE face per user, inherited by every app
// (docs/platform-spot-members-profile.md, Phase B). Apps keep their own
// override columns; when those are null, their /me endpoints read this.
// ===========================================================================

export const profileRoutes = new Hono();

profileRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  let { data: profile } = await db
    .from('user_profile')
    .select('*')
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (!profile) {
    const { data: u } = await adminClient
      .from('user')
      .select('full_name')
      .eq('id', ctx.userId)
      .single();
    const { data: created, error } = await adminClient
      .from('user_profile')
      .insert({ user_id: ctx.userId, display_name: u?.full_name ?? null })
      .select('*')
      .single();
    if (error || !created) return c.json({ error: 'failed to provision profile' }, 500);
    profile = created;
  }
  return c.json(profile);
});

const ProfilePatch = z.object({
  display_name: z.string().max(200).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  photo_url: z.string().max(1000).nullable().optional(),
  timezone: z.string().max(100).optional(),
});

profileRoutes.patch('/', async (c) => {
  const body = ProfilePatch.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('user_profile')
    .update({ ...body.data, updated_at: new Date().toISOString() })
    .eq('user_id', ctx.userId)
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});
