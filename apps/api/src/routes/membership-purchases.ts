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

export const membershipPurchaseRoutes = new Hono();

type OwnedMember = {
  id: string;
  workspace_id: string;
  person_id: string;
  tier_id: string;
  status: string;
  stripe_subscription_id: string | null;
};

/** The members held by persons with this verified email, across workspaces. */
async function membersForEmail(email: string): Promise<OwnedMember[]> {
  const { data: persons } = await adminClient.from('person').select('id').eq('email', email).is('deleted_at', null);
  const ids = (persons ?? []).map((p) => p.id as string);
  if (!ids.length) return [];
  const { data } = await adminClient
    .from('membership_member')
    .select('id, workspace_id, person_id, tier_id, status, stripe_subscription_id')
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
