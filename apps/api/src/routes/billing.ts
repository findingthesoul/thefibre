// Platform billing — the workspace's own Fibre subscription, on the PLATFORM
// Stripe account (Solidarity Lab B.V.). Entirely separate from Connect, which
// carries ticket money to organisers; the two share nothing but the SDK.
//
// Three surfaces:
//   POST /checkout        — admin+: Stripe Checkout in subscription mode
//   POST /portal          — admin+: Stripe's hosted billing portal
//   POST /stripe-webhook  — signature-verified; drives workspace_subscription
//
// Rules carried from docs/pricing-proposal.md, enforced here and not
// renegotiated per call site:
//   - Comped workspaces never touch Stripe (checkout refuses).
//   - A failed payment moves status, never features mid-event: gates read
//     features off the PLAN, and taking things away for non-payment is a
//     deliberate later decision, not a webhook side effect.
//   - Every paid subscription invoice lands in the purchase ledger under
//     'fibre-platform', so the workspace sees its Fibre invoices on the same
//     Invoices page as everything else.

import { Hono } from 'hono';
import { z } from 'zod';
import type Stripe from 'stripe';
import { appUrl } from '@thefibre/shared';
import { adminClient } from '../db.js';
import { stripeOrNull } from '../lib/stripe/client.js';
import { forgetPlan } from '../lib/plan.js';
import { recordPurchase } from '../lib/purchases.js';

export const billingRoutes = new Hono();

async function isAdmin(userId: string, workspaceId: string): Promise<boolean> {
  const { data } = await adminClient
    .from('workspace_member')
    .select('workspace_role')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return data?.workspace_role === 'admin' || data?.workspace_role === 'super_admin';
}

function planUrl(): string {
  return `${appUrl('fibre-platform', process.env)}/settings/plan`;
}

// ---------------------------------------------------------------------------
// POST /checkout — start (or replace) the subscription.
// ---------------------------------------------------------------------------
const CheckoutBody = z.object({
  plan_id: z.string().min(1).max(40),
  interval: z.enum(['monthly', 'annual']),
});

billingRoutes.post('/checkout', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user' || !ctx.userId) {
    return c.json({ error: 'user session required' }, 403);
  }
  if (!(await isAdmin(ctx.userId, ctx.workspaceId))) {
    return c.json({ error: 'changing the plan needs an admin role' }, 403);
  }
  const stripe = stripeOrNull();
  if (!stripe) return c.json({ error: 'Stripe is not configured on this environment' }, 503);

  const body = CheckoutBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const { plan_id, interval } = body.data;

  const [{ data: plan }, { data: sub }, { data: ws }, { data: me }] = await Promise.all([
    adminClient
      .from('billing_plan')
      .select(
        'id, name, price_cents_month, price_cents_year, stripe_product_id, stripe_price_id_month, stripe_price_id_year',
      )
      .eq('id', plan_id)
      .maybeSingle(),
    adminClient
      .from('workspace_subscription')
      .select(
        'status, stripe_customer_id, stripe_subscription_id, custom_price_cents_month, custom_price_cents_year',
      )
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle(),
    adminClient.from('workspace').select('name, slug').eq('id', ctx.workspaceId).maybeSingle(),
    adminClient.from('user').select('email, full_name').eq('id', ctx.userId).maybeSingle(),
  ]);

  if (!plan) return c.json({ error: `unknown plan "${plan_id}"` }, 400);
  if (!sub || !ws) return c.json({ error: 'workspace not found' }, 404);

  // A comped workspace pays nothing and must never grow a Stripe subscription
  // by accident. Un-comping is a super-admin act on /admin/workspaces.
  if (sub.status === 'comped') {
    return c.json(
      { error: 'this workspace is on the house — talk to us before adding a paid subscription' },
      409,
    );
  }
  if (sub.stripe_subscription_id) {
    // Plan changes on a live subscription belong in the portal, where Stripe
    // handles proration and confirmation honestly.
    return c.json({ use_portal: true }, 409);
  }

  const custom =
    interval === 'monthly' ? sub.custom_price_cents_month : sub.custom_price_cents_year;
  const listPrice = interval === 'monthly' ? plan.stripe_price_id_month : plan.stripe_price_id_year;
  const priceCents =
    custom ?? (interval === 'monthly' ? plan.price_cents_month : plan.price_cents_year);
  if (priceCents === null || priceCents === undefined) {
    return c.json({ error: `${plan.name} is not sold ${interval}` }, 400);
  }
  if (priceCents === 0) {
    return c.json({ error: `${plan.name} costs nothing — there is nothing to check out` }, 400);
  }
  if (!custom && !listPrice) {
    return c.json(
      { error: 'plan not synced to Stripe yet — run scripts/sync-stripe-plans.mjs' },
      503,
    );
  }
  if (custom && !plan.stripe_product_id) {
    return c.json(
      { error: 'plan not synced to Stripe yet — run scripts/sync-stripe-plans.mjs' },
      503,
    );
  }

  // One customer per workspace, created lazily and remembered immediately so
  // a retried checkout reuses it.
  let customerId = sub.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: ws.name,
      email: me?.email ?? undefined,
      metadata: { workspace_id: ctx.workspaceId, workspace_slug: ws.slug },
    });
    customerId = customer.id;
    await adminClient
      .from('workspace_subscription')
      .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspaceId);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      custom
        ? {
            quantity: 1,
            price_data: {
              currency: 'eur',
              product: plan.stripe_product_id!,
              unit_amount: custom,
              recurring: { interval: interval === 'monthly' ? ('month' as const) : ('year' as const) },
            },
          }
        : { quantity: 1, price: listPrice! },
    ],
    // B2B: collect the address + VAT number so Stripe's invoice is a legal one.
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    allow_promotion_codes: true,
    success_url: `${planUrl()}?upgraded=1`,
    cancel_url: planUrl(),
    metadata: { workspace_id: ctx.workspaceId, plan_id: plan.id },
    subscription_data: {
      metadata: { workspace_id: ctx.workspaceId, plan_id: plan.id },
    },
  });

  return c.json({ url: session.url });
});

// ---------------------------------------------------------------------------
// POST /portal — card changes, plan switches, cancellation. Stripe's page.
// ---------------------------------------------------------------------------
billingRoutes.post('/portal', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user' || !ctx.userId) {
    return c.json({ error: 'user session required' }, 403);
  }
  if (!(await isAdmin(ctx.userId, ctx.workspaceId))) {
    return c.json({ error: 'billing needs an admin role' }, 403);
  }
  const stripe = stripeOrNull();
  if (!stripe) return c.json({ error: 'Stripe is not configured on this environment' }, 503);

  const { data: sub } = await adminClient
    .from('workspace_subscription')
    .select('stripe_customer_id')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (!sub?.stripe_customer_id) {
    return c.json({ error: 'no billing account yet — upgrade first' }, 404);
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: planUrl(),
  });
  return c.json({ url: session.url });
});

// ---------------------------------------------------------------------------
// POST /stripe-webhook — the only writer of Stripe-driven status.
// Signature-verified with its OWN secret (no fallback to the Connect ones:
// a webhook that verifies against the wrong endpoint's secret is an outage
// that looks like a security feature).
// ---------------------------------------------------------------------------
type SubRow = {
  workspace_id: string;
  plan_id: string;
};

async function workspaceForCustomer(customerId: string): Promise<SubRow | null> {
  const { data } = await adminClient
    .from('workspace_subscription')
    .select('workspace_id, plan_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return (data as SubRow | null) ?? null;
}

function mapStatus(s: Stripe.Subscription.Status): string {
  switch (s) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    case 'incomplete':
      return 'incomplete';
    default:
      return 'active';
  }
}

async function applySubscription(sub: Stripe.Subscription): Promise<void> {
  const workspaceId = sub.metadata?.workspace_id;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  const target = workspaceId ?? (customerId ? (await workspaceForCustomer(customerId))?.workspace_id : null);
  if (!target) {
    console.error('[billing/webhook] subscription without a workspace', sub.id);
    return;
  }

  const item = sub.items?.data?.[0];
  const interval = item?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly';
  // current_period_end moved onto the item in newer API versions; take
  // whichever this event carries.
  const periodEnd =
    (item as unknown as { current_period_end?: number })?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    null;

  const patch: Record<string, unknown> = {
    status: mapStatus(sub.status),
    stripe_subscription_id: sub.id,
    billing_interval: interval,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    updated_at: new Date().toISOString(),
  };
  if (customerId) patch.stripe_customer_id = customerId;
  if (periodEnd) patch.current_period_end = new Date(periodEnd * 1000).toISOString();
  if (sub.trial_end) patch.trial_ends_at = new Date(sub.trial_end * 1000).toISOString();
  // The plan follows the subscription's metadata (set at checkout, preserved
  // by the portal's plan switches via the price's metadata fallback below).
  const planId =
    sub.metadata?.plan_id ??
    (item?.price?.id
      ? (
          await adminClient
            .from('billing_plan')
            .select('id')
            .or(`stripe_price_id_month.eq.${item.price.id},stripe_price_id_year.eq.${item.price.id}`)
            .maybeSingle()
        ).data?.id
      : undefined);
  if (planId) patch.plan_id = planId;

  const { error } = await adminClient
    .from('workspace_subscription')
    .update(patch)
    .eq('workspace_id', target);
  if (error) console.error('[billing/webhook] subscription update failed', error);
  forgetPlan(target);
}

async function subscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  const target =
    sub.metadata?.workspace_id ??
    (customerId ? (await workspaceForCustomer(customerId))?.workspace_id : null);
  if (!target) return;
  // Status moves; the plan and its data stay. What a lapsed plan may DO about
  // features is a deliberate later decision (docs/pricing-proposal.md: the
  // first bill that takes something away is a betrayal) — not a webhook's.
  const { error } = await adminClient
    .from('workspace_subscription')
    .update({
      status: 'canceled',
      stripe_subscription_id: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', target);
  if (error) console.error('[billing/webhook] cancel update failed', error);
  forgetPlan(target);
}

async function invoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  const row = await workspaceForCustomer(customerId);
  if (!row) {
    console.error('[billing/webhook] invoice for unknown customer', invoice.id, customerId);
    return;
  }
  const { data: plan } = await adminClient
    .from('billing_plan')
    .select('name')
    .eq('id', row.plan_id)
    .maybeSingle();
  const { data: ws } = await adminClient
    .from('workspace')
    .select('name')
    .eq('id', row.workspace_id)
    .maybeSingle();

  const periodEnd = invoice.lines?.data?.[0]?.period?.end;
  const label = `The Fibre — ${plan?.name ?? row.plan_id}${
    periodEnd ? ` (until ${new Date(periodEnd * 1000).toISOString().slice(0, 10)})` : ''
  }`;

  await recordPurchase({
    appSlug: 'fibre-platform',
    workspaceId: row.workspace_id,
    itemRef: invoice.id ?? `invoice-${Date.now()}`,
    itemLabel: label,
    payerName: ws?.name ?? '',
    payerEmail: invoice.customer_email ?? null,
    amountCents: invoice.amount_paid ?? 0,
    currency: (invoice.currency ?? 'eur').toUpperCase(),
    // The whole amount IS the platform's — no vendor/org split on a
    // subscription invoice.
    platformFeeCents: invoice.amount_paid ?? 0,
    vendorShareCents: 0,
    orgShareCents: 0,
    method: 'stripe',
    status: 'paid',
    stripeInvoiceId: invoice.id ?? null,
    stripeInvoiceUrl: invoice.hosted_invoice_url ?? null,
  });
}

async function invoiceFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  const row = await workspaceForCustomer(customerId);
  if (!row) return;
  const { error } = await adminClient
    .from('workspace_subscription')
    .update({ status: 'past_due', updated_at: new Date().toISOString() })
    .eq('workspace_id', row.workspace_id);
  if (error) console.error('[billing/webhook] past_due update failed', error);
  forgetPlan(row.workspace_id);
}

billingRoutes.post('/stripe-webhook', async (c) => {
  const stripe = stripeOrNull();
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    console.error('[billing/webhook] not configured (key or STRIPE_BILLING_WEBHOOK_SECRET missing)');
    return c.json({ error: 'not configured' }, 503);
  }
  const sig = c.req.header('stripe-signature');
  if (!sig) return c.json({ error: 'missing signature' }, 400);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await c.req.text(), sig, secret);
  } catch (e) {
    console.error('[billing/webhook] signature verification failed', e);
    return c.json({ error: 'bad signature' }, 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;
        const workspaceId = session.metadata?.workspace_id;
        const planId = session.metadata?.plan_id;
        if (workspaceId && planId) {
          const patch: Record<string, unknown> = {
            plan_id: planId,
            status: 'active',
            comped_reason: null,
            updated_at: new Date().toISOString(),
          };
          if (typeof session.customer === 'string') patch.stripe_customer_id = session.customer;
          if (typeof session.subscription === 'string')
            patch.stripe_subscription_id = session.subscription;
          const { error } = await adminClient
            .from('workspace_subscription')
            .update(patch)
            .eq('workspace_id', workspaceId);
          if (error) console.error('[billing/webhook] checkout completion failed', error);
          forgetPlan(workspaceId);
        }
        break;
      }
      case 'customer.subscription.updated':
        await applySubscription(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await subscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.paid':
        await invoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await invoiceFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
  } catch (e) {
    // Let Stripe retry — both the ledger write and the status writes are
    // idempotent (upsert on (app_id, item_ref); status converges).
    console.error('[billing/webhook] handler failed', event.type, e);
    return c.json({ error: 'handler failed' }, 500);
  }

  return c.json({ received: true });
});
