import { Hono } from 'hono';
import { z } from 'zod';
import { isLocale } from '@thefibre/shared';
import { adminClient } from '../db.js';
import {
  ensureProfile,
  saveProfile,
  billingFor,
  saveBilling,
} from '../lib/identity-profile.js';
import {
  accountStatus,
  authorizeUrl,
  connectClientId,
  signState,
} from '../lib/stripe/connect.js';
import { stripeOrNull } from '../lib/stripe/client.js';
import { platformFeeCents } from '../lib/fees.js';
import { personalStripeAccount } from '../lib/payment-accounts.js';
import { publicOrigin } from './mcp-discovery.js';
import { settingsUrlFor } from './workspace-billing.js';

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
  // ONE user-level UI/email language (i18n P2, D1). Validated against the
  // shared LOCALES so the list has a single source; null = no preference.
  locale: z
    .string()
    .max(8)
    .nullable()
    .optional()
    .refine((v) => v == null || isLocale(v), 'unsupported locale'),
  // Whether this person wants the To do panel at all (Sjoerd, 2026-09-23:
  // an ON/OFF, in "profile settings"). Per person, not per workspace.
  todo_enabled: z.boolean().optional(),
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


// ===========================================================================
// Stripe Connect for the PERSONAL (organiser) account.
//
// Sjoerd, 2026-09-24: *"And why does the personal account not have to connect
// like this?"* It does. It had the same defect the workspace had and for the
// same reason — a text box holding `acct_…` grants the platform nothing, so a
// personal account belonging to anyone but the platform owner could never
// take a payment, while the screen said it was fine. The workspace half was
// built first only because that is where soul.com was stuck.
//
// The callback is shared with the workspace flow
// (/api/v1/workspace-billing/stripe/callback): Stripe matches redirect_uri
// against a hand-maintained list per mode, and the signed `state` already
// says which scope this is.
// ===========================================================================

function personalRedirectUri(headers: Headers): string {
  return `${publicOrigin(headers)}/api/v1/workspace-billing/stripe/callback`;
}

profileRoutes.get('/stripe/connect', async (c) => {
  const ctx = c.get('ctx');
  const clientId = connectClientId();
  if (!clientId) {
    return c.json({ error: 'this platform is not registered with Stripe Connect yet' }, 503);
  }
  return c.json({
    url: authorizeUrl(
      clientId,
      signState('personal', ctx.userId, ctx.appId),
      personalRedirectUri(c.req.raw.headers),
    ),
  });
});

profileRoutes.get('/stripe/status', async (c) => {
  const ctx = c.get('ctx');
  const accountId = await personalStripeAccount(ctx.userId);
  const status = await accountStatus(accountId);
  return c.json({
    account_id: accountId,
    connect_available: Boolean(connectClientId()),
    ...status,
  });
});

/** The same rehearsal as the workspace one, on the organiser's own account. */
profileRoutes.post('/stripe/test-payment', async (c) => {
  const ctx = c.get('ctx');
  const stripe = stripeOrNull();
  if (!stripe) return c.json({ error: 'payments are not configured' }, 503);

  const parsed = z
    .object({ amount_cents: z.number().int().min(50).max(100_000) })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: 'choose an amount between 0.50 and 1000.00' }, 400);
  }
  const amountCents = parsed.data.amount_cents;

  const account = await personalStripeAccount(ctx.userId);
  if (!account) return c.json({ error: 'connect a Stripe account first' }, 400);

  const { data: ws } = await adminClient
    .from('workspace')
    .select('default_currency')
    .eq('id', ctx.workspaceId)
    .maybeSingle();
  const back = settingsUrlFor(ctx.appId);

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: (ws?.default_currency || 'EUR').toLowerCase(),
              unit_amount: amountCents,
              product_data: { name: 'Test payment' },
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: await platformFeeCents(ctx.workspaceId, amountCents),
          metadata: { fibre_test: 'true', user_id: ctx.userId },
        },
        metadata: { fibre_test: 'true', user_id: ctx.userId },
        success_url: `${back}?stripe=test_paid`,
        cancel_url: `${back}?stripe=test_cancelled`,
      },
      { stripeAccount: account },
    );
    if (!session.url) return c.json({ error: 'Stripe did not return a checkout page' }, 502);
    return c.json({ url: session.url });
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'could not reach Stripe';
    console.error('[profile] test payment failed', e);
    return c.json({ error: detail }, 502);
  }
});
