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
  // Payments SPoT (personal level) — every app reads these.
  stripe_account_id: z
    .string()
    .max(64)
    .regex(/^(acct_[A-Za-z0-9]+)?$/, 'Must be a Stripe account id like acct_…')
    .nullable()
    .optional(),
  invoice_details: z
    .object({
      legal_name: z.string().max(200).optional(),
      address: z.string().max(500).optional(),
      tax_no: z.string().max(60).optional(),
    })
    .nullable()
    .optional(),
  default_payment_methods: z.array(z.enum(['stripe', 'invoice'])).nullable().optional(),
});

profileRoutes.patch('/', async (c) => {
  const body = ProfilePatch.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const patch: Record<string, unknown> = { ...body.data, updated_at: new Date().toISOString() };
  if (patch.stripe_account_id === '') patch.stripe_account_id = null;
  const { data, error } = await db
    .from('user_profile')
    .update(patch)
    .eq('user_id', ctx.userId)
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 500);

  // The SPoT resolution falls back to the legacy app-local columns, so a
  // write here (especially a DISCONNECT) must overwrite them too — otherwise
  // clearing the platform value would resurrect the old account.
  if ('stripe_account_id' in body.data) {
    await adminClient
      .from('meet_host')
      .update({ stripe_account_id: patch.stripe_account_id })
      .eq('user_id', ctx.userId);
    await adminClient
      .from('thread_organiser')
      .update({ stripe_account_id: patch.stripe_account_id })
      .eq('user_id', ctx.userId);
  }
  return c.json(data);
});
