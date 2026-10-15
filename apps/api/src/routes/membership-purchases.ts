// my.thread → Purchases: a member's own memberships, managed IN The Fibre.
//
// Sjoerd, 2026-10-15: "Manage payment should not go to Stripe. We want to
// organise everything in THE FIBRE." (Stripe is the rails; the ledger and
// these screens are the record — design_stripe_rails_ledger_record.) P1 of
// the Purchases plan: what renews, when, for how much — and stopping or
// resuming that renewal. Add-ons, changing membership, billing details and the
// card follow in P2–P4.
//
// Its own file, beside membership-portal.ts, so two builders do not edit one
// router at once; mounted on the same prefix.

import { Hono } from 'hono';
import { adminClient } from '../db.js';
import { participantEmailFromAuth } from '../lib/participant-auth.js';
import { stripeOrNull } from '../lib/stripe/client.js';
import { workspaceStripeAccount } from '../lib/payment-accounts.js';
import { logMemberActivity, memberEmailLocale } from './membership.js';
import { membershipRenewalChanged, greetingName } from '../lib/email/membership-templates.js';
import { sendEmail } from '../lib/email/client.js';
import { getBuyerDetails, saveBuyerDetails } from '../lib/buyer-details.js';
import { getWorkspaceBrand, senderOf } from '../lib/workspace-brand.js';
import { reconcileMemberAccess } from './membership.js';
import {
  addAddon,
  addonFit,
  availableAddons,
  availableTiers,
  changeTier,
  DOWNGRADE_REFUNDS,
  loadCtx,
  previewAddon,
  previewTierChange,
  tierPriceFor,
} from '../lib/membership-change.js';

export const membershipPurchaseRoutes = new Hono();

type OwnedMember = {
  id: string;
  workspace_id: string;
  person_id: string;
  tier_id: string;
  status: string;
  country: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
};

/** The members held by persons with this verified email, across workspaces. */
async function membersForEmail(email: string): Promise<OwnedMember[]> {
  const { data: persons } = await adminClient.from('person').select('id').eq('email', email).is('deleted_at', null);
  const ids = (persons ?? []).map((p) => p.id as string);
  if (!ids.length) return [];
  const { data } = await adminClient
    .from('membership_member')
    .select('id, workspace_id, person_id, tier_id, status, country, stripe_subscription_id, stripe_customer_id')
    .in('person_id', ids)
    .is('deleted_at', null)
    .in('status', ['active', 'grace', 'past_due']);
  return (data ?? []) as OwnedMember[];
}

// GET /membership/portal/me/renewals — per membership with a Stripe
// subscription: when it renews, whether it will, and what the next invoice
// will be (Stripe's own preview, so it is what Stripe will charge: net, VAT,
// total).
membershipPurchaseRoutes.get('/me/renewals', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  const stripe = stripeOrNull();
  const members = await membersForEmail(email);
  const items = [];
  for (const m of members) {
    const [{ data: ws }, { data: tier }] = await Promise.all([
      adminClient.from('workspace').select('name, slug').eq('id', m.workspace_id).maybeSingle(),
      adminClient.from('membership_tier').select('name').eq('id', m.tier_id).maybeSingle(),
    ]);
    const base = { member_id: m.id, community: ws?.name ?? '', tier: tier?.name ?? '', status: m.status };
    if (!m.stripe_subscription_id || !stripe) {
      items.push({ ...base, managed_by_community: true });
      continue;
    }
    const account = await workspaceStripeAccount(m.workspace_id);
    if (!account) {
      items.push({ ...base, managed_by_community: true });
      continue;
    }
    try {
      const sub = await stripe.subscriptions.retrieve(m.stripe_subscription_id, {}, { stripeAccount: account });
      const periodEnd = sub.items.data[0]?.current_period_end ?? null;
      let next: { total: number; tax: number; subtotal: number; currency: string } | null = null;
      if (!sub.cancel_at_period_end && sub.status !== 'canceled') {
        const preview = await stripe.invoices.createPreview({ subscription: sub.id }, { stripeAccount: account });
        const tax = (preview.total_taxes ?? []).reduce((sum, t) => sum + (t.amount ?? 0), 0);
        next = { total: preview.total, tax, subtotal: preview.subtotal_excluding_tax ?? preview.subtotal, currency: preview.currency.toUpperCase() };
      }
      items.push({
        ...base,
        managed_by_community: false,
        renews_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        stops_at_period_end: !!sub.cancel_at_period_end,
        next_invoice: next,
      });
    } catch (e) {
      console.error('[membership/purchases] renewal read failed', { member: m.id, message: (e as Error).message });
      items.push({ ...base, managed_by_community: false, unavailable: true });
    }
  }
  return c.json({ items });
});

// POST /membership/portal/me/renewals/:memberId {stop: boolean} — stop the
// renewal at the end of the period (the membership stays active until then),
// or resume it. Nothing is charged or refunded now.
membershipPurchaseRoutes.post('/me/renewals/:memberId', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  const body = (await c.req.json().catch(() => ({}))) as { stop?: unknown };
  if (typeof body.stop !== 'boolean') return c.json({ error: 'stop must be true or false' }, 400);
  const m = (await membersForEmail(email)).find((x) => x.id === c.req.param('memberId'));
  if (!m) return c.json({ error: 'not found' }, 404);
  if (!m.stripe_subscription_id) {
    return c.json({ error: 'This membership is managed directly by the community.' }, 409);
  }
  const stripe = stripeOrNull();
  if (!stripe) return c.json({ error: 'payments are not configured' }, 503);
  const account = await workspaceStripeAccount(m.workspace_id);
  if (!account) return c.json({ error: 'This community has not connected a payment account yet.' }, 409);
  try {
    const sub = await stripe.subscriptions.update(
      m.stripe_subscription_id,
      { cancel_at_period_end: body.stop },
      { stripeAccount: account },
    );
    const periodEnd = sub.items.data[0]?.current_period_end ?? null;
    await logMemberActivity(
      m.workspace_id,
      m.person_id,
      body.stop ? 'membership_renewal_stopped' : 'membership_renewal_resumed',
      body.stop ? 'Renewal stopped by the member' : 'Renewal resumed by the member',
    ).catch(() => undefined);
    // The email, both ways: a stop is a decision about money, and the member
    // should hold it in writing. Logged, never fatal — the change is made.
    try {
      const [{ data: person }, { data: ws }, { data: tier }] = await Promise.all([
        adminClient.from('person').select('first_name, email').eq('id', m.person_id).maybeSingle(),
        adminClient.from('workspace').select('name').eq('id', m.workspace_id).maybeSingle(),
        adminClient.from('membership_tier').select('name').eq('id', m.tier_id).maybeSingle(),
      ]);
      if (person?.email && periodEnd) {
        const locale = await memberEmailLocale(m.workspace_id, null);
        const brand = await getWorkspaceBrand(m.workspace_id);
        const until = new Intl.DateTimeFormat(locale ?? 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })
          // The LAST day when stopped (period end is the next period's first instant).
          .format(new Date(periodEnd * 1000 - (body.stop ? 1000 : 0)));
        const msg = membershipRenewalChanged({
          name: greetingName(person.first_name as string | null, person.email as string),
          communityName: ws?.name ?? 'the community',
          tierName: tier?.name ?? 'membership',
          stopped: body.stop,
          until,
          locale,
          brand: { logoUrl: brand.logoUrl, name: brand.fromName },
        });
        await sendEmail({ to: person.email as string, subject: msg.subject, html: msg.html, text: msg.text, ...senderOf(brand) });
      }
    } catch (err) {
      console.warn('[membership/purchases] renewal email failed', (err as Error).message);
    }
    return c.json({
      member_id: m.id,
      stops_at_period_end: !!sub.cancel_at_period_end,
      renews_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    });
  } catch (e) {
    console.error('[membership/purchases] renewal update failed', { member: m.id, message: (e as Error).message });
    return c.json({ error: 'could not change the renewal — try again shortly' }, 502);
  }
});

// GET /membership/portal/me/billing-details — the member's billing details as
// a buyer (lib/buyer-details.ts): stored, else the last checkout's snapshot
// (`from_checkout: true`, so the page can say where it came from).
membershipPurchaseRoutes.get('/me/billing-details', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  return c.json(await getBuyerDetails(email));
});

// PUT /membership/portal/me/billing-details — save them. Stored in The Fibre,
// synced TO each Stripe customer, and — on a new country or VAT number — the
// VAT of every running membership re-decided from its next invoice. The
// answer says, per membership, what changed.
membershipPurchaseRoutes.put('/me/billing-details', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') return c.json({ error: 'expected a JSON body' }, 400);
  try {
    return c.json(await saveBuyerDetails(email, body));
  } catch (e) {
    console.error('[membership/purchases] billing details save failed', (e as Error).message);
    return c.json({ error: 'could not save your billing details — try again shortly' }, 500);
  }
});

// ---------------------------------------------------------------------------
// P3: ADD TO A MEMBERSHIP, OR CHANGE IT (lib/membership-change.ts).
//
// Every write has a preview first, and the preview is Stripe's own
// computation on the subscription that exists, so "pay now" on the screen is
// what the card is charged. Only active, renewing, self-paid memberships can
// change here; the rest say why.
// ---------------------------------------------------------------------------

/** The signed-in member's own membership, ready to change — or the answer. */
async function changeable(c: import('hono').Context) {
  const email = await participantEmailFromAuth(c);
  if (!email) return { res: c.json({ error: 'sign in required' }, 401) };
  const m = (await membersForEmail(email)).find((x) => x.id === c.req.param('memberId'));
  if (!m) return { res: c.json({ error: 'not found' }, 404) };
  if (!m.stripe_subscription_id || !m.stripe_customer_id) {
    return { res: c.json({ error: 'This membership is managed directly by the community.' }, 409) };
  }
  const ctx = await loadCtx({ ...m, stripe_subscription_id: m.stripe_subscription_id, stripe_customer_id: m.stripe_customer_id });
  if ('error' in ctx) return { res: c.json({ error: ctx.error }, ctx.status as 409) };
  return { ctx };
}

const failed = (c: import('hono').Context, what: string, e: unknown) => {
  const status = (e as { status?: number }).status;
  if (status === 400) return c.json({ error: (e as Error).message }, 400);
  // 409 = the double-submit guard: already added / already on that tier.
  if (status === 409) return c.json({ error: (e as Error).message }, 409);
  console.error(`[membership/purchases] ${what} failed`, (e as Error).message);
  return c.json({ error: `could not ${what} — try again shortly` }, 502);
};

// GET /me/options/:memberId — what this member may add, and move to, with
// prices for their interval and country (net; VAT rides on the subscription).
membershipPurchaseRoutes.get('/me/options/:memberId', async (c) => {
  const r = await changeable(c);
  if (r.res) return r.res;
  const { ctx } = r;
  const addons = (await availableAddons(ctx.member))
    .map((p) => ({ ...p, fit: addonFit(p, ctx.interval) }))
    .filter((p) => p.fit !== null)
    .map((p) => ({ id: p.id, name: p.name, price_cents: p.price_cents, currency: (p.currency ?? ctx.currency).toUpperCase(), recurring: p.fit === 'recurring' }));
  const tiers = [];
  for (const t of await availableTiers(ctx.member)) {
    const price = await tierPriceFor(ctx, t.id as string);
    if (price) tiers.push({ id: t.id, name: t.name, price_cents: price.cents });
  }
  const current = await tierPriceFor(ctx, ctx.member.tier_id);
  return c.json({
    member_id: ctx.member.id,
    interval: ctx.interval,
    currency: ctx.currency.toUpperCase(),
    current_price_cents: current?.cents ?? ctx.mainItem.price.unit_amount ?? null,
    downgrade: DOWNGRADE_REFUNDS ? 'refund' : 'credit',
    addons,
    tiers,
  });
});

/** The client's request id (one per dialog choice), for Stripe idempotency.
 *  Absent or malformed → a fresh one, which still has the claim guard. */
const requestIdOf = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(v) ? v : crypto.randomUUID());

const addonFor = async (memberId: string, productId: unknown, ctx: Awaited<ReturnType<typeof changeable>>['ctx']) => {
  if (typeof productId !== 'string' || !ctx) return null;
  return (await availableAddons(ctx.member)).find((p) => p.id === productId && ctx.member.id === memberId) ?? null;
};

// POST /me/addons/:memberId/preview {product_id} — what adding it costs now
// and per period after.
membershipPurchaseRoutes.post('/me/addons/:memberId/preview', async (c) => {
  const r = await changeable(c);
  if (r.res) return r.res;
  const body = (await c.req.json().catch(() => ({}))) as { product_id?: unknown };
  const product = await addonFor(r.ctx.member.id, body.product_id, r.ctx);
  if (!product) return c.json({ error: 'That add-on is not available for this membership.' }, 404);
  try {
    return c.json(await previewAddon(r.ctx, { ...product, price_cents: product.price_cents! }));
  } catch (e) {
    return failed(c, 'preview the add-on', e);
  }
});

// POST /me/addons/:memberId {product_id, request_id?} — add it. Charged now (prorated to
// the renewal date for a recurring one), recorded, access granted.
membershipPurchaseRoutes.post('/me/addons/:memberId', async (c) => {
  const r = await changeable(c);
  if (r.res) return r.res;
  const body = (await c.req.json().catch(() => ({}))) as { product_id?: unknown; request_id?: unknown };
  // Not filtered by "already held" here: the guard inside addAddon answers a
  // second click with 409 "already part of your membership", not a 404.
  const product =
    typeof body.product_id === 'string'
      ? (
          await adminClient
            .from('membership_tier_product')
            .select('product:product_id (id, name, price_cents, price_interval, currency, archived_at)')
            .eq('tier_id', r.ctx.member.tier_id)
            .eq('optional', true)
            .eq('product_id', body.product_id)
            .maybeSingle()
        ).data?.product
      : null;
  const p = (Array.isArray(product) ? product[0] : product) as
    | { id: string; name: string; price_cents: number | null; price_interval: string | null; currency: string | null; archived_at: string | null }
    | null
    | undefined;
  if (!p || p.archived_at || !(p.price_cents && p.price_cents > 0)) return c.json({ error: 'That add-on is not available for this membership.' }, 404);
  try {
    const out = await addAddon(r.ctx, { ...p, price_cents: p.price_cents }, reconcileMemberAccess, requestIdOf(body.request_id));
    await logMemberActivity(r.ctx.member.workspace_id, r.ctx.member.person_id, 'membership_addon_added', `Add-on added by the member · ${p.name}`).catch(() => undefined);
    return c.json({ ok: true, ...out });
  } catch (e) {
    return failed(c, 'add it', e);
  }
});

// POST /me/change/:memberId/preview {tier_id} — moving to another tier: what
// is paid now (an upgrade) or credited (a downgrade), and the new renewal.
membershipPurchaseRoutes.post('/me/change/:memberId/preview', async (c) => {
  const r = await changeable(c);
  if (r.res) return r.res;
  const body = (await c.req.json().catch(() => ({}))) as { tier_id?: unknown };
  const allowed = (await availableTiers(r.ctx.member)).some((t) => t.id === body.tier_id);
  if (!allowed) return c.json({ error: 'That membership cannot be chosen.' }, 404);
  try {
    const q = await previewTierChange(r.ctx, body.tier_id as string);
    if (!q) return c.json({ error: 'That membership has no price for your billing period.' }, 409);
    return c.json({ ...q, downgrade: DOWNGRADE_REFUNDS ? 'refund' : 'credit' });
  } catch (e) {
    return failed(c, 'preview the change', e);
  }
});

// POST /me/change/:memberId {tier_id, request_id?} — move. The renewal date stays.
membershipPurchaseRoutes.post('/me/change/:memberId', async (c) => {
  const r = await changeable(c);
  if (r.res) return r.res;
  const body = (await c.req.json().catch(() => ({}))) as { tier_id?: unknown; request_id?: unknown };
  // A second click that arrives after the first has landed: already there.
  if (body.tier_id === r.ctx.member.tier_id) return c.json({ error: 'You are already on that membership.' }, 409);
  const target = (await availableTiers(r.ctx.member)).find((t) => t.id === body.tier_id);
  if (!target) return c.json({ error: 'That membership cannot be chosen.' }, 404);
  try {
    const out = await changeTier(r.ctx, target.id as string, reconcileMemberAccess, requestIdOf(body.request_id));
    await logMemberActivity(r.ctx.member.workspace_id, r.ctx.member.person_id, 'membership_tier_changed', `Membership changed by the member · ${target.name}`).catch(() => undefined);
    return c.json({ ok: true, tier: target.name, ...out });
  } catch (e) {
    return failed(c, 'change the membership', e);
  }
});
