// Workspace-level payment settings — the SPoT's second half (the first is
// user_profile). Admin-or-above only; values live on the workspace row.

import { Hono } from 'hono';
import { z } from 'zod';
import { appUrl } from '@thefibre/shared';
import { publicOrigin } from './mcp-discovery.js';
import { adminClient } from '../db.js';
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
    url: authorizeUrl(clientId, signState(ctx.workspaceId), redirectUri(c.req.raw.headers)),
  });
});

/** GET /stripe/callback — Stripe returns here with a one-time code.
 *
 *  No auth middleware can help: the admin arrives from Stripe's domain, so
 *  the signed `state` IS the authentication. Without it, a crafted link
 *  could bind somebody else's account to a workspace. */
workspaceBillingRoutes.get('/stripe/callback', async (c) => {
  const settingsUrl = `${appUrl('membership', process.env)}/settings/payments`;
  const fail = (reason: string) =>
    c.redirect(`${settingsUrl}?stripe=error&reason=${encodeURIComponent(reason)}`);

  const denied = c.req.query('error');
  if (denied) return fail(c.req.query('error_description') ?? denied);

  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!code || !state) return fail('Stripe did not return a code');

  const verified = verifyState(state);
  if (!verified) return fail('that link has expired — start again from settings');

  const result = await exchangeCode(code, redirectUri(c.req.raw.headers));
  if ('error' in result) return fail(result.error);

  const { error } = await adminClient
    .from('workspace')
    .update({ stripe_account_id: result.accountId })
    .eq('id', verified.workspaceId);
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
