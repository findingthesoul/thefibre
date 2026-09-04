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
import { appUrl, ENTITY } from '@thefibre/shared';
import { sendReceipt } from './purchases.js';
import { adminClient } from '../db.js';
import { stripeOrNull } from '../lib/stripe/client.js';
import { forgetPlan, seatsUsed } from '../lib/plan.js';
import { recordPurchase } from '../lib/purchases.js';
import { reconcileSeatBilling } from '../lib/seat-billing.js';
import { ensurePlanApps } from '../lib/plan-apps.js';
import { getSetting } from '../lib/platform-settings.js';

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
        'id, name, price_cents_month, price_cents_year, included_seats, extra_seat_cents_month, stripe_product_id, stripe_price_id_month, stripe_price_id_year, stripe_price_id_seat_month, stripe_price_id_seat_year',
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

  // Seats over the allowance ride on the same subscription as a second item
  // (quantity-billed). Counted against the plan being BOUGHT, so a 14-seat
  // workspace checking out on Pro is billed 49 + 9×8 from day one.
  let seatLine: { price: string; quantity: number } | null = null;
  if (plan.included_seats !== null && plan.extra_seat_cents_month) {
    const used = await seatsUsed(ctx.workspaceId);
    const overage = Math.max(0, used - plan.included_seats);
    if (overage > 0) {
      const seatPriceId =
        interval === 'monthly' ? plan.stripe_price_id_seat_month : plan.stripe_price_id_seat_year;
      if (!seatPriceId) {
        return c.json(
          { error: 'seat prices not synced to Stripe yet — run scripts/sync-stripe-plans.mjs' },
          503,
        );
      }
      seatLine = { price: seatPriceId, quantity: overage };
    }
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

  type CheckoutCreateParams = NonNullable<Parameters<Stripe['checkout']['sessions']['create']>[0]>;
  const baseSessionParams: CheckoutCreateParams = {
    mode: 'subscription' as const,
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
      ...(seatLine ? [seatLine] : []),
    ],
    // B2B: collect the address + VAT number so Stripe's invoice is a legal one.
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    // Required whenever tax-id/address collection runs against an EXISTING
    // customer (we create the customer before the session): Stripe writes
    // what the buyer types back onto the customer record.
    customer_update: { name: 'auto', address: 'auto' },
    allow_promotion_codes: true,
    success_url: `${planUrl()}?upgraded=1`,
    cancel_url: planUrl(),
    metadata: { workspace_id: ctx.workspaceId, plan_id: plan.id },
    subscription_data: {
      metadata: { workspace_id: ctx.workspaceId, plan_id: plan.id },
    },
  };

  // VAT via Stripe Tax (prices are ex-VAT): 21% NL, reverse charge for EU
  // B2B with a validated VAT id, out of scope elsewhere. Falls back to
  // tax-less checkout until Stripe Tax is ACTIVATED in the dashboard —
  // enabling it here must never turn checkout off.
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      ...baseSessionParams,
      automatic_tax: { enabled: true },
    });
  } catch (e) {
    console.warn(
      '[billing/checkout] automatic tax refused (activate Stripe Tax in the dashboard) — proceeding without',
      e instanceof Error ? e.message : e,
    );
    session = await stripe.checkout.sessions.create(baseSessionParams);
  }

  return c.json({ url: session.url });
});

// ---------------------------------------------------------------------------
// POST /switch — change plan/interval IN-APP on a live subscription.
//
// Stripe as rails only (the 2026-09-03 principle): we update the
// subscription's base item to the target price with proration — the card on
// file pays the difference, no checkout page. The seat item is dropped and
// immediately re-reconciled against the NEW plan's allowance and seat price.
// The webhook confirms what we already wrote (idempotent convergence).
// ---------------------------------------------------------------------------
const SwitchBody = z.object({
  plan_id: z.string().min(1).max(40),
  interval: z.enum(['monthly', 'annual']),
});

billingRoutes.post('/switch', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user' || !ctx.userId) return c.json({ error: 'user session required' }, 403);
  if (!(await isAdmin(ctx.userId, ctx.workspaceId))) {
    return c.json({ error: 'changing the plan needs an admin role' }, 403);
  }
  const stripe = stripeOrNull();
  if (!stripe) return c.json({ error: 'Stripe is not configured on this environment' }, 503);

  const body = SwitchBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const { plan_id, interval } = body.data;

  const [{ data: plan }, { data: sub }] = await Promise.all([
    adminClient
      .from('billing_plan')
      .select(
        'id, name, price_cents_month, price_cents_year, stripe_product_id, stripe_price_id_month, stripe_price_id_year',
      )
      .eq('id', plan_id)
      .maybeSingle(),
    adminClient
      .from('workspace_subscription')
      .select('status, stripe_subscription_id, custom_price_cents_month, custom_price_cents_year')
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle(),
  ]);
  if (!plan) return c.json({ error: `unknown plan "${plan_id}"` }, 400);
  if (!sub?.stripe_subscription_id) {
    return c.json({ error: 'no live subscription — use the upgrade buttons instead' }, 409);
  }

  const custom =
    interval === 'monthly' ? sub.custom_price_cents_month : sub.custom_price_cents_year;
  const listPrice = interval === 'monthly' ? plan.stripe_price_id_month : plan.stripe_price_id_year;
  if (!custom && !listPrice) {
    return c.json({ error: `${plan.name} is not sold ${interval}` }, 400);
  }

  // Which subscription item is the base plan, which the seat rider?
  const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
  const { data: allPlans } = await adminClient
    .from('billing_plan')
    .select('stripe_price_id_month, stripe_price_id_year, stripe_price_id_seat_month, stripe_price_id_seat_year');
  const basePriceIds = new Set(
    (allPlans ?? []).flatMap((p) => [p.stripe_price_id_month, p.stripe_price_id_year]).filter(Boolean),
  );
  const baseItem =
    stripeSub.items.data.find((i) => i.price && basePriceIds.has(i.price.id)) ??
    stripeSub.items.data[0];
  const seatItems = stripeSub.items.data.filter((i) => i.id !== baseItem?.id);
  if (!baseItem) return c.json({ error: 'subscription has no items — check Stripe' }, 500);

  await stripe.subscriptions.update(sub.stripe_subscription_id, {
    items: [
      custom
        ? {
            id: baseItem.id,
            price_data: {
              currency: 'eur',
              product: plan.stripe_product_id!,
              unit_amount: custom,
              recurring: { interval: interval === 'monthly' ? ('month' as const) : ('year' as const) },
            },
          }
        : { id: baseItem.id, price: listPrice! },
      // Seat riders are re-created against the new plan by the reconciler.
      ...seatItems.map((i) => ({ id: i.id, deleted: true as const })),
    ],
    // always_invoice: the proration is invoiced and charged/credited NOW —
    // so the switch produces a real invoice that lands in OUR ledger via
    // invoice.paid immediately, not a silent adjustment on next month's bill
    // ("and invoicing" — Sjoerd, 2026-09-03).
    proration_behavior: 'always_invoice',
    cancel_at_period_end: false,
    metadata: { workspace_id: ctx.workspaceId, plan_id: plan.id },
  });

  // Best-effort: make sure the subscription computes VAT from here on
  // (no-op until Stripe Tax is activated in the dashboard).
  await stripe.subscriptions
    .update(sub.stripe_subscription_id, { automatic_tax: { enabled: true } })
    .catch(() => {});

  // Optimistic write so the screen flips immediately; the webhook confirms.
  await adminClient
    .from('workspace_subscription')
    .update({
      plan_id: plan.id,
      billing_interval: interval,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', ctx.workspaceId);
  forgetPlan(ctx.workspaceId);
  void ensurePlanApps(ctx.workspaceId);
  void reconcileSeatBilling(ctx.workspaceId);

  // Travel through Stripe ONLY when genuinely needed (Sjoerd's phrase): an
  // off-session proration charge can be refused pending 3-D Secure. If the
  // switch's invoice is still open, hand back Stripe's hosted invoice page
  // so the customer can authenticate — invoice.paid then converges us.
  try {
    const invoices = await stripe.invoices.list({
      subscription: sub.stripe_subscription_id,
      limit: 1,
    });
    const latest = invoices.data[0];
    if (latest && latest.status === 'open' && latest.hosted_invoice_url) {
      return c.json({
        ok: true,
        plan: plan.id,
        interval,
        // The client redirects here — same field checkout/portal use.
        url: latest.hosted_invoice_url,
        needs_authentication: true,
      });
    }
  } catch (e) {
    console.warn('[billing/switch] latest-invoice check failed (non-fatal)', e);
  }

  return c.json({ ok: true, plan: plan.id, interval });
});

// ---------------------------------------------------------------------------
// POST /cancel + /resume — downgrade-to-Free at period end, and the way back.
// ---------------------------------------------------------------------------
async function setCancelFlag(c: import('hono').Context, value: boolean) {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user' || !ctx.userId) return c.json({ error: 'user session required' }, 403);
  if (!(await isAdmin(ctx.userId, ctx.workspaceId))) {
    return c.json({ error: 'changing the plan needs an admin role' }, 403);
  }
  const stripe = stripeOrNull();
  if (!stripe) return c.json({ error: 'Stripe is not configured on this environment' }, 503);
  const { data: sub } = await adminClient
    .from('workspace_subscription')
    .select('stripe_subscription_id')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (!sub?.stripe_subscription_id) return c.json({ error: 'no live subscription' }, 409);

  await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: value });
  await adminClient
    .from('workspace_subscription')
    .update({ cancel_at_period_end: value, updated_at: new Date().toISOString() })
    .eq('workspace_id', ctx.workspaceId);
  forgetPlan(ctx.workspaceId);
  return c.json({ ok: true, cancel_at_period_end: value });
}

billingRoutes.post('/cancel', (c) => setCancelFlag(c, true));
billingRoutes.post('/resume', (c) => setCancelFlag(c, false));

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
  // The configuration created by sync-stripe-plans.mjs (plan switches +
  // cancellation). Passed explicitly so we never depend on which config the
  // Stripe dashboard happens to consider "default".
  const portalConfig = await getSetting<string | null>('stripe_portal_configuration', null);
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: planUrl(),
    ...(portalConfig ? { configuration: portalConfig } : {}),
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

  // The subscription can carry TWO items — the base plan and the extra-seat
  // item (lib/seat-billing.ts). The base item is the one whose price is a
  // plan's month/year price; never assume items[0].
  const priceIds = (sub.items?.data ?? []).map((i) => i.price?.id).filter(Boolean) as string[];
  let basePlanId: string | undefined;
  let baseItem = sub.items?.data?.[0];
  if (priceIds.length > 0) {
    const { data: byPrice } = await adminClient
      .from('billing_plan')
      .select('id, stripe_price_id_month, stripe_price_id_year')
      .or(
        priceIds
          .map((id) => `stripe_price_id_month.eq.${id},stripe_price_id_year.eq.${id}`)
          .join(','),
      );
    const match = (byPrice ?? [])[0];
    if (match) {
      basePlanId = match.id;
      baseItem =
        sub.items.data.find(
          (i) =>
            i.price?.id === match.stripe_price_id_month ||
            i.price?.id === match.stripe_price_id_year,
        ) ?? baseItem;
    }
  }
  const interval = baseItem?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly';
  // current_period_end moved onto the item in newer API versions; take
  // whichever this event carries.
  const periodEnd =
    (baseItem as unknown as { current_period_end?: number })?.current_period_end ??
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
  // The plan follows the price actually on the subscription (a portal plan
  // switch changes the price, not the checkout metadata), with the original
  // checkout metadata as fallback.
  const planId = basePlanId ?? sub.metadata?.plan_id;
  if (planId) patch.plan_id = planId;

  const { error } = await adminClient
    .from('workspace_subscription')
    .update(patch)
    .eq('workspace_id', target);
  if (error) console.error('[billing/webhook] subscription update failed', error);
  forgetPlan(target);
  // A plan switch changes the seat allowance — re-count the extra-seat item
  // against the new plan. Idempotent, so the webhook echo of its own update
  // is a no-op.
  void reconcileSeatBilling(target);
  // …and switches on the apps the new plan includes (Pro brings Flow +
  // Pulse). Signup v2: the product assembles itself.
  void ensurePlanApps(target);
}

async function subscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  const target =
    sub.metadata?.workspace_id ??
    (customerId ? (await workspaceForCustomer(customerId))?.workspace_id : null);
  if (!target) return;
  // Self-serve downgrade (Signup v2): a subscription that ends — cancelled in
  // the portal, or lapsed — puts the workspace back on FREE. Nothing is
  // deleted (pricing-proposal.md: read-only, not gone; the way back is a
  // click) and already-active apps stay active — gates only bind on new
  // activations, mirroring the seat rule "binds on the next invite".
  const { error } = await adminClient
    .from('workspace_subscription')
    .update({
      plan_id: 'free',
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

  // The invoice's own facts land in the ledger row, so the Fibre can present
  // the invoice ITSELF — Stripe's PDF becomes a footnote ("my invoices are
  // still in Stripe" — Sjoerd, 2026-09-04).
  const addr = invoice.customer_address;
  // Tax breakdown — field names moved across Stripe API versions, so read
  // defensively: sum of tax amounts, subtotal ex-tax, reverse-charge flag.
  const inv = invoice as unknown as {
    total_tax_amounts?: { amount: number }[];
    total_taxes?: { amount: number }[];
    tax?: number | null;
    total_excluding_tax?: number | null;
    subtotal?: number | null;
    customer_tax_exempt?: string | null;
  };
  const taxCents =
    inv.total_tax_amounts?.reduce((a, t) => a + (t.amount ?? 0), 0) ??
    inv.total_taxes?.reduce((a, t) => a + (t.amount ?? 0), 0) ??
    inv.tax ??
    0;
  const subtotalCents = inv.total_excluding_tax ?? inv.subtotal ?? (invoice.amount_paid ?? 0) - taxCents;
  const reverseCharge = inv.customer_tax_exempt === 'reverse';
  const taxPct = subtotalCents > 0 && taxCents > 0 ? Math.round((taxCents / subtotalCents) * 100) : null;
  const billing = {
    subtotal_cents: subtotalCents,
    tax_cents: taxCents,
    tax_label: reverseCharge
      ? 'VAT reverse-charged'
      : taxCents > 0
        ? `VAT ${taxPct ?? ''}%`.trim()
        : null,
    number: invoice.number ?? null,
    company: invoice.customer_name ?? ws?.name ?? null,
    address: addr?.line1 ?? null,
    postal_code: addr?.postal_code ?? null,
    city: addr?.city ?? null,
    country: addr?.country ?? null,
    tax_no: invoice.customer_tax_ids?.[0]?.value ?? null,
    period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    // Direct PDF download (invoice_pdf), distinct from the hosted page.
    pdf: invoice.invoice_pdf ?? null,
  };

  const itemRef = invoice.id ?? `invoice-${Date.now()}`;
  await recordPurchase({
    appSlug: 'fibre-platform',
    workspaceId: row.workspace_id,
    itemRef,
    itemLabel: label,
    payerName: invoice.customer_name ?? ws?.name ?? '',
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
    billing,
  });

  // Receipt from the FIBRE (not just Stripe's mail): the same receipt style
  // every other purchase gets, with the platform as seller.
  const { data: saved } = await adminClient
    .from('purchase')
    .select('payer_name, payer_email, item_label, amount_cents, currency, method, status, created_at, billing, stripe_invoice_url')
    .eq('stripe_invoice_id', invoice.id ?? '')
    .maybeSingle();
  if (saved) {
    void sendReceipt(row.workspace_id, saved as Record<string, unknown>, {
      legal_name: ENTITY.name,
      address: ENTITY.address,
    }).catch((e) => console.error('[billing/webhook] receipt email failed', e));
  }
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
          void ensurePlanApps(workspaceId);
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
