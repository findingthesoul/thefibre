// Workspace-level payment settings — the SPoT's second half (the first is
// user_profile). Admin-or-above only; values live on the workspace row.

import { Hono } from 'hono';
import { z } from 'zod';
import { APP_IDS, type AppId, appUrl, stagingAppUrl } from '@thefibre/shared';
import { publicOrigin } from './mcp-discovery.js';
import { stripeOrNull } from '../lib/stripe/client.js';
import { platformFeeCents } from '../lib/fees.js';
import { workspaceStripeAccount } from '../lib/payment-accounts.js';
import { adminClient } from '../db.js';
import { saveBilling } from '../lib/identity-profile.js';
import {
  accountStatus,
  authorizeUrl,
  connectClientId,
  deauthorize,
  exchangeCode,
  signState,
  verifyState,
} from '../lib/stripe/connect.js';

export const workspaceBillingRoutes = new Hono();

async function isAdmin(userId: string, workspaceId: string): Promise<boolean> {
  const { data } = await adminClient
    .from('workspace_member')
    .select('workspace_role')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return data?.workspace_role === 'admin' || data?.workspace_role === 'super_admin';
}

workspaceBillingRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  const { data } = await adminClient
    .from('workspace')
    .select('stripe_account_id, invoice_details, default_payment_methods')
    .eq('id', ctx.workspaceId)
    .maybeSingle();
  return c.json({
    stripe_account_id: data?.stripe_account_id ?? null,
    invoice_details: data?.invoice_details ?? null,
    default_payment_methods: data?.default_payment_methods ?? null,
    editable: await isAdmin(ctx.userId, ctx.workspaceId),
  });
});

const BillingPatch = z.object({
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
      website: z.string().max(200).optional(),
      vat_registered: z.boolean().optional(),
      vat_rate_pct: z.number().min(0).max(100).nullable().optional(),
    })
    .nullable()
    .optional(),
  default_payment_methods: z.array(z.enum(['stripe', 'invoice'])).nullable().optional(),
});

workspaceBillingRoutes.patch('/', async (c) => {
  const body = BillingPatch.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  if (!(await isAdmin(ctx.userId, ctx.workspaceId))) {
    return c.json({ error: 'workspace payment settings need an admin role' }, 403);
  }
  const patch: Record<string, unknown> = { ...body.data };
  if (patch.stripe_account_id === '') patch.stripe_account_id = null;
  // Clearing the field is a DISCONNECT, so hand the permission back rather
  // than leaving the platform authorised on an account nobody points at.
  if ('stripe_account_id' in body.data && !patch.stripe_account_id) {
    const { data: before } = await adminClient
      .from('workspace')
      .select('stripe_account_id')
      .eq('id', ctx.workspaceId)
      .maybeSingle();
    if (before?.stripe_account_id) await deauthorize(before.stripe_account_id);
  }
  const { data, error } = await adminClient
    .from('workspace')
    .update(patch)
    .eq('id', ctx.workspaceId)
    .select('stripe_account_id, invoice_details, default_payment_methods')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  // Keep the legacy fallback column in sync (disconnects must stick).
  if ('stripe_account_id' in body.data) {
    await adminClient
      .from('thread_settings')
      .update({ stripe_account_id: patch.stripe_account_id })
      .eq('workspace_id', ctx.workspaceId);
  }
  return c.json(data);
});

// ===========================================================================
// Stripe Connect — the client connects themselves
// ===========================================================================
//
// See lib/stripe/connect.ts for why this did not exist until 2026-09-24 and
// what it cost. In short: the text field above stores an account id and asks
// Stripe for nothing, which is fine for the platform's own accounts and
// useless for a client's.
//
// Three routes: start the hand-off, receive it back, and say honestly
// whether the connection works. The last one is the one the old badge
// should have been all along.

/** Where Stripe sends the admin back. Must match the redirect URI registered
 *  in Stripe → Connect → Settings, character for character, AND must be the
 *  same string in the authorize request and the token exchange.
 *
 *  Derived from the REQUEST, via the same helper mcp-discovery uses, because
 *  the first version read a `PUBLIC_API_URL` that is set on neither Fly app
 *  and fell back to the production host. On staging that would have sent the
 *  admin to production's callback, where the signed state fails to verify
 *  against a different SSO_INTERNAL_SECRET and the workspace id belongs to a
 *  different database. Caught before anyone tried it, by Sjoerd asking
 *  whether to register the platform on the .tech stack. */
function redirectUri(headers: Headers): string {
  return `${publicOrigin(headers)}/api/v1/workspace-billing/stripe/callback`;
}

/** GET /stripe/connect — hand the admin to Stripe to approve. */
workspaceBillingRoutes.get('/stripe/connect', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isAdmin(ctx.userId, ctx.workspaceId))) {
    return c.json({ error: 'connecting Stripe needs an admin role' }, 403);
  }
  const clientId = connectClientId();
  if (!clientId) {
    // Dark rather than broken: the platform has not been registered with
    // Stripe yet, and saying so beats a redirect that fails at Stripe's end.
    return c.json({ error: 'this platform is not registered with Stripe Connect yet' }, 503);
  }
  return c.json({
    url: authorizeUrl(clientId, signState('workspace', ctx.workspaceId, ctx.appId), redirectUri(c.req.raw.headers)),
  });
});

/**
 * Where to send the admin back to.
 *
 * Two things went wrong here on 2026-09-24 and they are separate:
 *
 * 1. The app was hard-coded to `membership`, so an admin who started in
 *    Thread came back to a different product. The `state` now carries the
 *    app they left, signed, so a crafted return URL still cannot redirect
 *    them anywhere of an attacker's choosing — the slug is validated against
 *    APP_IDS before it is used.
 *
 * 2. The STACK was wrong: staging returned Sjoerd to
 *    `membership.thethread.app`, which is PRODUCTION. `appUrl` resolves from
 *    `meta.urlEnv`, and the staging API has `NEXT_PUBLIC_*_URL` for only
 *    five of the nine apps — membership's is named `MEMBERSHIP_APP_URL`, and
 *    connect's is not set at all — so a miss falls through to the production
 *    constant. branding.ts warns about exactly this ("a missing variable
 *    fails toward the live system, which is the wrong way round"). Every
 *    other membership caller in this API dodges it with an explicit
 *    `process.env.MEMBERSHIP_APP_URL ??`; this one did not. So ask the STACK
 *    first, the way server.ts derives STAGING_ORIGINS, and never rely on a
 *    per-app variable being present.
 */
export function settingsUrlFor(appId: string | null): string {
  const slug: AppId = (APP_IDS as readonly string[]).includes(appId ?? '')
    ? (appId as AppId)
    : 'membership'; // pre-2026-09-24 state, or a header we do not recognise
  const origin =
    process.env.FLY_APP_NAME === 'thefibre-api-staging'
      ? stagingAppUrl(slug)
      : appUrl(slug, process.env);
  return `${origin}/settings/payments`;
}

/** GET /stripe/callback — Stripe returns here with a one-time code.
 *
 *  No auth middleware can help: the admin arrives from Stripe's domain, so
 *  the signed `state` IS the authentication. Without it, a crafted link
 *  could bind somebody else's account to a workspace. */

workspaceBillingRoutes.get('/stripe/callback', async (c) => {
  // Resolved twice: before `state` is verified we do not yet know the app, so
  // an early failure lands on the fallback; after verification we use the app
  // the admin actually started from.
  let settingsUrl = settingsUrlFor(null);
  const fail = (reason: string) =>
    c.redirect(`${settingsUrl}?stripe=error&reason=${encodeURIComponent(reason)}`);

  const denied = c.req.query('error');
  if (denied) return fail(c.req.query('error_description') ?? denied);

  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!code || !state) return fail('Stripe did not return a code');

  const verified = verifyState(state);
  if (!verified) return fail('that link has expired — start again from settings');
  settingsUrl = settingsUrlFor(verified.appId);

  const result = await exchangeCode(code, redirectUri(c.req.raw.headers));
  if ('error' in result) return fail(result.error);

  // ONE callback for both scopes, deliberately. Stripe validates the
  // redirect_uri against a list the platform owner maintains by hand in the
  // dashboard, in each mode — a second URI is a second thing for a human to
  // register correctly, and the live one was only added on 2026-09-24. The
  // signed `state` already distinguishes them, so it does the routing.
  const { error } =
    verified.scope === 'personal'
      ? // identity_billing, via saveBilling — NOT user_profile. `billingFor`
        // reads identity_billing FIRST and falls back to user_profile, so a
        // write to the fallback is invisible the moment an identity row
        // exists. It is keyed by email, which is why saveBilling takes the
        // user id and resolves it (lib/identity-profile.ts).
        await saveBilling(verified.subjectId, { stripe_account_id: result.accountId })
          .then((r) => ({ error: r.error ? { message: r.error } : null }))
      : await adminClient
          .from('workspace')
          .update({ stripe_account_id: result.accountId })
          .eq('id', verified.subjectId);
  if (error) {
    console.error('[workspace-billing] could not store the connected account', error);
    return fail('connected, but we could not save it — try again');
  }
  // Deliberately NOT written to `thread_settings.stripe_account_id`.
  //
  // That column is a READ FALLBACK only (lib/payment-accounts.ts:
  // `workspaceStripeAccount` returns `workspace.stripe_account_id` and
  // consults thread_settings only when it is null). Writing it on CONNECT
  // would revive a second source of truth for the same fact — the thing the
  // payments SPoT exists to end. The PATCH handler above still CLEARS it on
  // disconnect, which is the opposite case and is necessary: an uncleared
  // fallback would keep answering with a stale account after the primary
  // went null. Flagged by the connections session, 2026-09-24.

  return c.redirect(`${settingsUrl}?stripe=connected`);
});

/** POST /stripe/test-payment — a rehearsal the admin runs themselves.
 *
 *  Sjoerd, 2026-09-24: *"From experience I can say that I would like to test
 *  it myself."* Every previous payment failure on this platform was found by
 *  a real buyer on a live page — soul.com sat broken for two weeks behind a
 *  green badge. `accountStatus` asks Stripe whether the account is reachable,
 *  which is necessary and not sufficient: it does not prove a CHARGE works.
 *  This does, because it is the same call the real checkout makes.
 *
 *  Deliberately a real charge on the connected account, with the same
 *  plan-aware application fee as a real sale — a test that skips the fee or
 *  runs in test mode proves something other than the thing in doubt. The
 *  money lands on the workspace's own Stripe and is refundable there.
 *
 *  It writes NOTHING to the purchase ledger: the app webhooks key off
 *  `metadata.thread_enrolment_id` / membership ids, so a session carrying
 *  neither is ignored by all of them. `fibre_test` is on the metadata so a
 *  human reading the Stripe dashboard can see what it was. */
workspaceBillingRoutes.post('/stripe/test-payment', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isAdmin(ctx.userId, ctx.workspaceId))) {
    return c.json({ error: 'a test payment needs an admin role' }, 403);
  }
  const stripe = stripeOrNull();
  if (!stripe) return c.json({ error: 'payments are not configured' }, 503);

  const parsed = z
    .object({
      // Stripe's own floor for EUR is 50 cents; the ceiling is ours, so a
      // mistyped amount cannot become a four-figure charge on a real card.
      amount_cents: z.number().int().min(50).max(100_000),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: 'choose an amount between 0.50 and 1000.00' }, 400);
  }
  const amountCents = parsed.data.amount_cents;

  const account = await workspaceStripeAccount(ctx.workspaceId);
  if (!account) return c.json({ error: 'connect a Stripe account first' }, 400);

  const { data: ws } = await adminClient
    .from('workspace')
    .select('name, default_currency')
    .eq('id', ctx.workspaceId)
    .maybeSingle();
  const currency = (ws?.default_currency || 'EUR').toLowerCase();
  const back = settingsUrlFor(ctx.appId);

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency,
              unit_amount: amountCents,
              product_data: { name: `Test payment — ${ws?.name ?? 'workspace'}` },
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: await platformFeeCents(ctx.workspaceId, amountCents, account),
          metadata: { fibre_test: 'true', workspace_id: ctx.workspaceId },
        },
        metadata: { fibre_test: 'true', workspace_id: ctx.workspaceId },
        success_url: `${back}?stripe=test_paid`,
        cancel_url: `${back}?stripe=test_cancelled`,
      },
      { stripeAccount: account },
    );
    if (!session.url) return c.json({ error: 'Stripe did not return a checkout page' }, 502);
    return c.json({ url: session.url });
  } catch (e) {
    // The message Stripe gives here is the DIAGNOSIS — "does not have access
    // to account", "capability disabled" — so it goes to the admin verbatim
    // rather than being flattened into "could not start checkout", which is
    // the exact sentence that told nobody anything for two weeks.
    const detail = e instanceof Error ? e.message : 'could not reach Stripe';
    console.error('[workspace-billing] test payment failed', e);
    return c.json({ error: detail }, 502);
  }
});

/** GET /stripe/status — does the connection actually work?
 *
 *  The question the old green badge never asked. `saved` and `connected` are
 *  different things and soul.com spent two weeks in the gap between them. */
workspaceBillingRoutes.get('/stripe/status', async (c) => {
  const ctx = c.get('ctx');
  const { data } = await adminClient
    .from('workspace')
    .select('stripe_account_id')
    .eq('id', ctx.workspaceId)
    .maybeSingle();
  const status = await accountStatus(data?.stripe_account_id ?? null);
  return c.json({
    account_id: data?.stripe_account_id ?? null,
    connect_available: Boolean(connectClientId()),
    ...status,
  });
});
