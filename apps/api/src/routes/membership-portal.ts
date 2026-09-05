import { Hono } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { isLocale, toLocale } from '@thefibre/shared';
import { adminClient } from '../db.js';
import { stripeOrNull } from '../lib/stripe/client.js';
import { workspaceStripeAccount } from '../lib/payment-accounts.js';

// ===========================================================================
// Member self-serve portal (membership-proposal §3.7).
//
// Auth model: the /my pattern (Thread's public/my-enrolments), NOT workspace
// membership. The visitor signs in to the membership app (Google or the
// 8-digit email code); their Supabase session JWT is verified directly here
// against JWKS — no workspace claims, because members aren't workspace
// members. The ONLY thing the token gives us is an email.
//
// RLS does not protect these handlers: everything runs on adminClient, so
// every query MUST scope explicitly to persons matching the verified email
// (person.email is citext — eq is case-insensitive).
// ===========================================================================

const participantJwks = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createRemoteJWKSet(
      new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
    )
  : null;

// Copied from routes/thread.ts on purpose (do not import — the two apps'
// participant surfaces must be able to evolve independently).
async function participantEmailFromAuth(c: {
  req: { header: (n: string) => string | undefined };
}): Promise<string | null> {
  const auth = c.req.header('authorization');
  if (!auth?.startsWith('Bearer ') || !participantJwks) return null;
  try {
    const { payload } = await jwtVerify(auth.slice(7), participantJwks, {
      audience: process.env.API_JWT_AUDIENCE ?? 'authenticated',
    });
    return (payload.email as string | undefined) ?? null;
  } catch {
    return null;
  }
}

const MEMBERSHIP_APP_URL = process.env.MEMBERSHIP_APP_URL ?? 'https://membership.thefibre.app';

type MemberRow = {
  id: string;
  workspace_id: string;
  person_id: string;
  status: string;
  started_at: string;
  renews_at: string | null;
  stripe_customer_id: string | null;
  locale: string | null;
  workspace: { name: string; slug: string } | { name: string; slug: string }[] | null;
  tier:
    | {
        name: string;
        price_cents_year: number | null;
        price_cents_month: number | null;
        currency: string | null;
      }
    | {
        name: string;
        price_cents_year: number | null;
        price_cents_month: number | null;
        currency: string | null;
      }[]
    | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/**
 * Load a membership_member row and prove it belongs to the caller: the
 * member's person email must match the JWT email. Returns null on any miss —
 * the handlers answer 404 either way, so ownership can't be probed.
 */
async function ownedMember(
  memberId: string,
  email: string,
): Promise<{ id: string; workspace_id: string; person_id: string; stripe_customer_id: string | null } | null> {
  const { data: member } = await adminClient
    .from('membership_member')
    .select('id, workspace_id, person_id, stripe_customer_id')
    .eq('id', memberId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!member) return null;
  const { data: person } = await adminClient
    .from('person')
    .select('email')
    .eq('id', member.person_id)
    .is('deleted_at', null)
    .maybeSingle();
  const personEmail = (person?.email as string | null | undefined) ?? '';
  if (!personEmail || personEmail.toLowerCase() !== email.toLowerCase()) return null;
  return member;
}

export const membershipPortalRoutes = new Hono();

// GET /me — every membership held by persons matching the signed-in email,
// across all workspaces (one person row per workspace that knows them).
membershipPortalRoutes.get('/me', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);

  const { data: persons } = await adminClient
    .from('person')
    .select('id')
    .eq('email', email.toLowerCase())
    .is('deleted_at', null);
  if (!persons?.length) return c.json({ email, items: [] });

  const { data: members } = await adminClient
    .from('membership_member')
    .select(
      `id, workspace_id, person_id, status, started_at, renews_at, stripe_customer_id, locale,
       workspace:workspace_id (name, slug),
       tier:tier_id (name, price_cents_year, price_cents_month, currency)`,
    )
    .in('person_id', persons.map((p) => p.id))
    .is('deleted_at', null)
    .order('started_at', { ascending: false });

  // Workspace default locales, for members without one of their own
  // (member.locale ?? membership_settings.locale ?? 'en').
  const workspaceIds = [...new Set(((members ?? []) as MemberRow[]).map((m) => m.workspace_id))];
  const settingsLocale = new Map<string, string>();
  if (workspaceIds.length) {
    const { data: settings } = await adminClient
      .from('membership_settings')
      .select('workspace_id, locale')
      .in('workspace_id', workspaceIds);
    for (const s of settings ?? []) {
      if (s.locale) settingsLocale.set(s.workspace_id as string, s.locale as string);
    }
  }

  const items = ((members ?? []) as MemberRow[]).map((m) => {
    const ws = one(m.workspace);
    const tier = one(m.tier);
    return {
      member_id: m.id,
      workspace: { name: ws?.name ?? '', slug: ws?.slug ?? '' },
      tier: {
        name: tier?.name ?? '',
        price_cents_year: tier?.price_cents_year ?? null,
        price_cents_month: tier?.price_cents_month ?? null,
        currency: tier?.currency ?? null,
      },
      status: m.status,
      started_at: m.started_at,
      renews_at: m.renews_at,
      // Additive convenience for the UI: manual/comped members have no
      // Stripe subscription, so "Manage payment" would only ever 409.
      has_stripe: !!m.stripe_customer_id,
      // The member's resolved language, so the portal chrome can follow it
      // (additive, i18n P1).
      locale: isLocale(m.locale) ? m.locale : toLocale(settingsLocale.get(m.workspace_id)),
    };
  });

  return c.json({ email, items });
});

// GET /me/invoices?member_id=… — that member's purchase-ledger rows.
// Ownership is proven via the person email BEFORE the ledger is touched.
membershipPortalRoutes.get('/me/invoices', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  const memberId = c.req.query('member_id');
  if (!memberId) return c.json({ error: 'member_id is required' }, 400);

  const member = await ownedMember(memberId, email);
  if (!member) return c.json({ error: 'not found' }, 404);

  const { data: app } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', 'membership')
    .maybeSingle();
  if (!app) return c.json({ items: [] });

  const { data: rows } = await adminClient
    .from('purchase')
    .select('id, item_label, amount_cents, currency, status, created_at, stripe_invoice_url')
    .eq('app_id', app.id)
    .eq('workspace_id', member.workspace_id)
    .eq('person_id', member.person_id)
    .order('created_at', { ascending: false });

  return c.json({ items: rows ?? [] });
});

// POST /me/portal-session {member_id} — Stripe Billing-Portal session on the
// WORKSPACE'S CONNECTED ACCOUNT (the subscription lives there, not on the
// platform account). 409 for manual/comped members: there is nothing in
// Stripe for them to manage.
membershipPortalRoutes.post('/me/portal-session', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);

  const body = (await c.req.json().catch(() => ({}))) as { member_id?: unknown };
  const memberId = typeof body.member_id === 'string' ? body.member_id : '';
  if (!memberId) return c.json({ error: 'member_id is required' }, 400);

  const member = await ownedMember(memberId, email);
  if (!member) return c.json({ error: 'not found' }, 404);

  if (!member.stripe_customer_id) {
    return c.json(
      {
        error:
          'This membership has no Stripe subscription — it is managed directly by the community.',
      },
      409,
    );
  }

  const stripe = stripeOrNull();
  if (!stripe) return c.json({ error: 'payments are not configured' }, 503);
  const account = await workspaceStripeAccount(member.workspace_id);
  if (!account) {
    return c.json(
      { error: 'This community has not connected a payment account yet.' },
      409,
    );
  }

  try {
    const session = await stripe.billingPortal.sessions.create(
      {
        customer: member.stripe_customer_id,
        return_url: `${MEMBERSHIP_APP_URL}/my`,
      },
      { stripeAccount: account },
    );
    return c.json({ url: session.url });
  } catch (e) {
    console.error('[membership/portal] billing portal session failed', e);
    return c.json({ error: 'could not open the payment portal — try again shortly' }, 502);
  }
});
