import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';
import {
  ensureProfile,
  saveProfile,
  billingFor,
  saveBilling,
} from '../lib/identity-profile.js';

// ===========================================================================
// The platform public profile — ONE face per user, inherited by every app
// (docs/platform-spot-members-profile.md, Phase B). Apps keep their own
// override columns; when those are null, their /me endpoints read this.
// ===========================================================================

export const profileRoutes = new Hono();

profileRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  // Your profile follows you between workspaces; your payment details do too,
  // and they live apart because everyone in a workspace may read the first and
  // nobody but you may read the second (20260901160000).
  const [profile, billing] = await Promise.all([
    ensureProfile(ctx.userId).catch((e: unknown) => {
      console.error('[profile GET] provision failed', e);
      return null;
    }),
    billingFor(ctx.userId),
  ]);
  if (!profile) return c.json({ error: 'failed to provision profile' }, 500);
  return c.json({ ...profile, ...billing });
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
      vat_registered: z.boolean().optional(),
      vat_rate_pct: z.number().min(0).max(100).nullable().optional(),
    })
    .nullable()
    .optional(),
  default_payment_methods: z.array(z.enum(['stripe', 'invoice'])).nullable().optional(),
});

profileRoutes.patch('/', async (c) => {
  const body = ProfilePatch.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');

  const { stripe_account_id, invoice_details, default_payment_methods, ...face } = body.data;

  if (Object.keys(face).length) {
    const r = await saveProfile(ctx.userId, face);
    if (r.error) return c.json({ error: r.error }, 500);
  }

  const billing: Record<string, unknown> = {};
  if (stripe_account_id !== undefined) billing.stripe_account_id = stripe_account_id || null;
  if (invoice_details !== undefined) billing.invoice_details = invoice_details;
  if (default_payment_methods !== undefined) {
    billing.default_payment_methods = default_payment_methods;
  }
  if (Object.keys(billing).length) {
    const r = await saveBilling(ctx.userId, billing);
    if (r.error) return c.json({ error: r.error }, 500);
  }

  // The payments SPoT still falls back to the app-local columns, so a write
  // here — a DISCONNECT above all — has to overwrite them, or clearing the
  // platform value resurrects the old account.
  if (stripe_account_id !== undefined) {
    const value = stripe_account_id || null;
    await adminClient.from('meet_host').update({ stripe_account_id: value }).eq('user_id', ctx.userId);
    await adminClient
      .from('thread_organiser')
      .update({ stripe_account_id: value })
      .eq('user_id', ctx.userId);
  }

  const [profile, saved] = await Promise.all([
    ensureProfile(ctx.userId),
    billingFor(ctx.userId),
  ]);
  return c.json({ ...profile, ...saved });
});
