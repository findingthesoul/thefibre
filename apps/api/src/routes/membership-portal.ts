import { Hono } from 'hono';
import { z } from 'zod';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { appUrl, isLocale, toLocale } from '@thefibre/shared';
import { adminClient } from '../db.js';
import { rows } from '../lib/rows.js';
import {
  markEmailProven,
  personIdsForProvenEmail,
  personsForProvenEmail,
} from '../lib/proven-email.js';
import { buildInvoicePdf, type PdfInvoice } from '../lib/invoice-pdf.js';
import { sellerForSale } from './purchases.js';
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

const MEMBERSHIP_APP_URL =
  process.env.MEMBERSHIP_APP_URL ?? appUrl('membership', process.env);

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

  // This token proves the holder reads this mailbox; record it, so the
  // address still finds their memberships after a merge moves it off
  // `person.email`. Same reasoning as routes/portal.ts.
  await markEmailProven(email);

  // Every list on this page throws on a failed read (lib/rows.ts): a member
  // shown "no memberships" because a query broke is worse than an error.
  // WHICH persons this address may act for is the one shared rule in
  // lib/proven-email.ts — their own address, or one they have proven.
  const personIds = await personIdsForProvenEmail(email);
  if (!personIds.length) return c.json({ email, items: [], products: [] });

  const members = rows(
    'member portal: memberships',
    await adminClient
      .from('membership_member')
      .select(
        `id, workspace_id, person_id, status, started_at, renews_at, stripe_customer_id, locale,
       workspace:workspace_id (name, slug),
       tier:tier_id (name, price_cents_year, price_cents_month, currency)`,
      )
      .in('person_id', personIds)
      .is('deleted_at', null)
      .order('started_at', { ascending: false }),
  );

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

  // À-la-carte purchases (2026-09-06): person-keyed, so they surface even
  // when the buyer holds no membership. Additive `products` array.
  const purchases = rows(
    'member portal: product purchases',
    await adminClient
      .from('membership_product_purchase')
      .select(
        `id, workspace_id, amount_cents, currency, status, created_at,
       product:product_id (name, description, links),
       workspace:workspace_id (name, slug)`,
      )
      .in('person_id', personIds)
      .eq('status', 'paid')
      .order('created_at', { ascending: false }),
  );

  type PurchaseRow = {
    id: string;
    amount_cents: number;
    currency: string;
    created_at: string;
    product:
      | { name: string; description: string | null; links: unknown }
      | { name: string; description: string | null; links: unknown }[]
      | null;
    workspace: { name: string; slug: string } | { name: string; slug: string }[] | null;
  };
  const products = ((purchases ?? []) as unknown as PurchaseRow[]).map((p) => {
    const product = one(p.product);
    const ws = one(p.workspace);
    const links = Array.isArray(product?.links)
      ? (product!.links as { kind?: string; ref?: string; label?: string }[]).filter(
          (l) => l?.kind === 'url' && typeof l.ref === 'string' && /^https?:\/\//.test(l.ref),
        )
      : [];
    return {
      purchase_id: p.id,
      workspace: { name: ws?.name ?? '', slug: ws?.slug ?? '' },
      product: {
        name: product?.name ?? '',
        description: product?.description ?? null,
        links: links.map((l) => ({ ref: l.ref!, label: l.label ?? null })),
      },
      amount_cents: p.amount_cents,
      currency: p.currency,
      purchased_at: p.created_at,
    };
  });

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

  return c.json({ email, items, products });
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

  const items = rows(
    'member portal: invoices',
    await adminClient
      .from('purchase')
      .select('id, item_label, amount_cents, currency, status, created_at, stripe_invoice_url')
      .eq('app_id', app.id)
      .eq('workspace_id', member.workspace_id)
      .eq('person_id', member.person_id)
      .order('created_at', { ascending: false }),
  );

  return c.json({ items });
});

// GET /me/invoices/:id/pdf — the member's OWN invoice as a PDF.
//
// The ledger already had a PDF route, and a member could never reach it: it
// scopes to the workspace's organiser-or-admin, which is what a member is
// not. So the portal showed people an invoice line with nothing to click
// unless Stripe happened to have hosted one — and an invoice-method
// membership never has (soul.com, 2026-09-09).
//
// Ownership is the whole security surface here, and it is proven the way
// every other handler in this file proves it: the verified email resolves
// to person rows, and the ledger row must belong to one of them. Both keys
// are checked — person_id OR payer_email — because either alone drops rows
// (the ledger-identity rule).
membershipPortalRoutes.get('/me/invoices/:id/pdf', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);

  const { data: app } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', 'membership')
    .maybeSingle();
  if (!app) return c.json({ error: 'not found' }, 404);

  const { data: persons } = await adminClient
    .from('person')
    .select('id')
    .eq('email', email.toLowerCase())
    .is('deleted_at', null);
  const personIds = (persons ?? []).map((p) => p.id);

  const { data: purchase } = await adminClient
    .from('purchase')
    .select('*')
    .eq('id', c.req.param('id'))
    .eq('app_id', app.id)
    .maybeSingle();
  if (!purchase) return c.json({ error: 'not found' }, 404);

  const mine =
    (purchase.person_id && personIds.includes(purchase.person_id as string)) ||
    (typeof purchase.payer_email === 'string' &&
      purchase.payer_email.toLowerCase() === email.toLowerCase());
  if (!mine) return c.json({ error: 'not found' }, 404);

  // The app is `membership` by construction (the query filters on it), so
  // this always resolves the COMMUNITY as seller, never the organiser's
  // personal invoicing identity. See sellerForSale.
  const seller = (await sellerForSale(
    'membership',
    purchase.workspace_id as string,
    (purchase.organiser_user_id as string | null) ?? null,
  )) ?? { legal_name: '' };
  const pdf = await buildInvoicePdf(purchase as unknown as PdfInvoice, {
    legal_name: seller.legal_name ?? '',
    ...seller,
  });
  const number = String(
    (purchase.billing as { number?: string } | null)?.number ?? (purchase.id as string),
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${number.replace(/[^A-Za-z0-9-]/g, '')}.pdf"`,
    },
  });
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

/** Same shape as routes/membership.ts: the Postgres error goes to stderr
 *  (code, details, hint), the caller gets the message. Reading the API log
 *  first is the house rule for a save that will not save. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fail(c: any, where: string, error: { message: string; code?: string }) {
  console.error(`[membership/portal] ${where}`, error);
  return c.json({ error: error.message, code: error.code }, 500);
}

// ===========================================================================
// MEMBER DIRECTORY — the member's own choice (spec §3.3, §4, §9.6, slice 2a).
//
// Opt-IN. `listed` defaults to false and nothing lists anybody until they say
// so here. No list is served yet, deliberately: somebody can state their
// choice before anyone can see them, which is the right order for a choice
// that defaults to off.
//
// THREE THINGS THAT ARE NOT OBVIOUS:
//
// 1. The choice is written to EVERY person row the proven email owns in that
//    workspace, not just one. `merge_person` repoints FKs generically, but
//    this table is unique on (workspace_id, person_id), so when both rows
//    carry an entry the merge keeps the DESTINATION and records the loss.
//    With the default off, a choice on the losing row would silently un-list
//    somebody who deliberately opted in.
//
// 2. A member may only set a choice in a workspace that already knows them.
//    Without that check, any signed-in address could write an entry into any
//    workspace — a row that slice 3 would then read.
//
// 3. The consent record is written when the switch goes ON, not at join. At
//    join nothing has been consented to, because the switch arrives off, and
//    a consent row for a switch nobody touched records something untrue.
// ===========================================================================

type DirectoryChoice = {
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  listed: boolean;
  /** null = follow the workspace default, which is reported beside it. */
  show_contact: boolean | null;
  workspace_show_contact_default: boolean;
};

/** The workspaces this proven email is actually a member of, with the person
 *  rows it owns in each. Membership is what authorises a choice. */
async function memberWorkspaces(email: string): Promise<Map<string, string[]>> {
  const persons = await personsForProvenEmail(email);
  if (!persons.length) return new Map();
  const personIds = persons.map((p) => p.id);

  const members = rows(
    'member portal: directory membership check',
    await adminClient
      .from('membership_member')
      .select('workspace_id, person_id')
      .in('person_id', personIds)
      .is('deleted_at', null),
  );

  // Only workspaces that know them, and within those, EVERY person row they
  // own there — including rows no membership points at, because a merge may
  // keep any of them.
  const memberWorkspaceIds = new Set(members.map((m) => m.workspace_id as string));
  const byWorkspace = new Map<string, string[]>();
  for (const p of persons) {
    if (!memberWorkspaceIds.has(p.workspace_id)) continue;
    const list = byWorkspace.get(p.workspace_id) ?? [];
    list.push(p.id);
    byWorkspace.set(p.workspace_id, list);
  }
  return byWorkspace;
}

membershipPortalRoutes.get('/me/directory', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  await markEmailProven(email);

  const byWorkspace = await memberWorkspaces(email);
  if (!byWorkspace.size) return c.json({ items: [] as DirectoryChoice[] });

  const workspaceIds = [...byWorkspace.keys()];
  const allPersonIds = [...byWorkspace.values()].flat();

  const [workspaces, settings, entries] = await Promise.all([
    adminClient.from('workspace').select('id, name, slug').in('id', workspaceIds),
    adminClient
      .from('membership_settings')
      .select('workspace_id, directory_show_contact')
      .in('workspace_id', workspaceIds),
    adminClient
      .from('membership_directory_entry')
      .select('workspace_id, person_id, listed, show_contact')
      .in('person_id', allPersonIds),
  ]);
  if (workspaces.error) return fail(c, 'directory: workspaces', workspaces.error);
  if (settings.error) return fail(c, 'directory: settings', settings.error);
  if (entries.error) return fail(c, 'directory: entries', entries.error);

  const defaultShow = new Map(
    (settings.data ?? []).map((s) => [s.workspace_id as string, Boolean(s.directory_show_contact)]),
  );

  const items: DirectoryChoice[] = (workspaces.data ?? []).map((w) => {
    const mine = (entries.data ?? []).filter((e) => e.workspace_id === w.id);
    // Duplicate person rows can disagree. Open on the member's own choice —
    // listed if ANY row says so — and closed on visibility: the most
    // restrictive show_contact wins. Neither resolution can surprise anybody.
    const listed = mine.some((e) => e.listed === true);
    const shown = mine.map((e) => e.show_contact).filter((v) => v !== null) as boolean[];
    return {
      workspace_id: w.id as string,
      workspace_name: w.name as string,
      workspace_slug: w.slug as string,
      listed,
      show_contact: shown.length ? shown.every(Boolean) : null,
      workspace_show_contact_default: defaultShow.get(w.id as string) ?? false,
    };
  });

  return c.json({ items });
});

const PatchDirectory = z.object({
  workspace_id: z.string().uuid(),
  listed: z.boolean().optional(),
  show_contact: z.boolean().nullable().optional(),
});

membershipPortalRoutes.patch('/me/directory', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  const body = PatchDirectory.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  await markEmailProven(email);

  const byWorkspace = await memberWorkspaces(email);
  const personIds = byWorkspace.get(body.data.workspace_id);
  // Not a member there — or not a member any more. Refuse rather than create
  // an entry slice 3 would read.
  if (!personIds?.length) return c.json({ error: 'not a member of that community' }, 403);

  const before = await adminClient
    .from('membership_directory_entry')
    .select('person_id, listed')
    .eq('workspace_id', body.data.workspace_id)
    .in('person_id', personIds);
  if (before.error) return fail(c, 'directory: read before', before.error);
  const wasListed = (before.data ?? []).some((e) => e.listed === true);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.data.listed !== undefined) patch.listed = body.data.listed;
  if (body.data.show_contact !== undefined) patch.show_contact = body.data.show_contact;

  const { error: upsertErr } = await adminClient.from('membership_directory_entry').upsert(
    personIds.map((person_id) => ({
      workspace_id: body.data.workspace_id,
      person_id,
      ...patch,
    })),
    { onConflict: 'workspace_id,person_id' },
  );
  if (upsertErr) return fail(c, 'directory: save choice', upsertErr);

  // The consent record follows the switch, and only when it CHANGES — so a
  // member editing show_contact does not accumulate consent rows.
  if (body.data.listed === true && !wasListed) {
    const { error } = await adminClient.from('consent_record').insert(
      personIds.map((person_id) => ({
        person_id,
        purpose_code: 'member_directory',
        legal_basis: 'consent',
        text_version: 'member-directory-v1',
      })),
    );
    if (error) return fail(c, 'directory: record consent', error);
  }
  if (body.data.listed === false && wasListed) {
    // Both: the record is the evidence, the flag is the behaviour (§4).
    const { error } = await adminClient
      .from('consent_record')
      .update({ revoked_at: new Date().toISOString() })
      .in('person_id', personIds)
      .eq('purpose_code', 'member_directory')
      .is('revoked_at', null);
    if (error) return fail(c, 'directory: revoke consent', error);
  }

  return c.json({ ok: true });
});

// ===========================================================================
// MEMBER DIRECTORY — the list (spec §5, §6; slice 3).
//
// The first surface where one member can see another, so every rule that
// decides who appears is here and nowhere else.
//
// A member is a candidate only when their entry says listed IS TRUE. A
// MISSING row means NOT listed. That is the opposite of what §5 said until
// 2026-10-05 — the spec still carried the opt-out rule after §3.3 and §4 had
// been corrected, and implementing it as written would have listed every
// existing member the moment this shipped, without anyone being asked.
//
// There is deliberately NO BACKFILL. A row written on somebody's behalf is a
// choice they did not make.
//
// Visibility follows slice 1: 'everybody' sees everybody; 'category' sees
// only members sharing a category, where a person's categories are the union
// over the products they hold. An uncategorised member in category mode is
// not listed AND sees nobody — it fails closed, which is why the admin
// screen counts uncategorised products.
// ===========================================================================

type DirectoryMember = {
  person_id: string;
  display_name: string;
  photo_url: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  tags: string[];
  /** Only when the workspace shows categories (§9.2). */
  categories: string[];
  /** Only when show(M) resolves true — never as a separate lookup. */
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  website_url: string | null;
};

/** Categories a set of people hold, by person: the union over the products
 *  in their tier plus anything bought on its own (§5). */
async function categoriesByPerson(
  workspaceId: string,
  personIds: string[],
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (!personIds.length) return out;

  const [members, links, purchases] = await Promise.all([
    adminClient
      .from('membership_member')
      .select('person_id, tier_id')
      .eq('workspace_id', workspaceId)
      .in('person_id', personIds)
      .is('deleted_at', null),
    adminClient.from('membership_product_category').select('product_id, category_id'),
    adminClient
      .from('membership_product_purchase')
      .select('person_id, product_id')
      .eq('workspace_id', workspaceId)
      .in('person_id', personIds),
  ]);
  if (members.error) throw new Error(`directory categories (members): ${members.error.message}`);
  if (links.error) throw new Error(`directory categories (links): ${links.error.message}`);
  if (purchases.error) throw new Error(`directory categories (purchases): ${purchases.error.message}`);

  const tierIds = [...new Set((members.data ?? []).map((m) => m.tier_id as string))];
  const tierProducts = tierIds.length
    ? await adminClient
        .from('membership_tier_product')
        .select('tier_id, product_id')
        .in('tier_id', tierIds)
    : { data: [], error: null };
  if (tierProducts.error) {
    throw new Error(`directory categories (tier products): ${tierProducts.error.message}`);
  }

  const catsOfProduct = new Map<string, string[]>();
  for (const l of links.data ?? []) {
    const list = catsOfProduct.get(l.product_id as string) ?? [];
    list.push(l.category_id as string);
    catsOfProduct.set(l.product_id as string, list);
  }
  const productsOfTier = new Map<string, string[]>();
  for (const tp of tierProducts.data ?? []) {
    const list = productsOfTier.get(tp.tier_id as string) ?? [];
    list.push(tp.product_id as string);
    productsOfTier.set(tp.tier_id as string, list);
  }

  const add = (personId: string, productId: string) => {
    const set = out.get(personId) ?? new Set<string>();
    for (const c of catsOfProduct.get(productId) ?? []) set.add(c);
    out.set(personId, set);
  };
  for (const m of members.data ?? []) {
    for (const p of productsOfTier.get(m.tier_id as string) ?? []) add(m.person_id as string, p);
  }
  for (const p of purchases.data ?? []) add(p.person_id as string, p.product_id as string);
  return out;
}

membershipPortalRoutes.get('/me/directory/:workspaceId/members', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  await markEmailProven(email);

  const workspaceId = c.req.param('workspaceId');
  const byWorkspace = await memberWorkspaces(email);
  const viewerPersonIds = byWorkspace.get(workspaceId);
  // Not a member there: the list does not exist for them. Same refusal as
  // the write path, for the same reason.
  if (!viewerPersonIds?.length) return c.json({ error: 'not a member of that community' }, 403);

  const settings = await adminClient
    .from('membership_settings')
    .select('directory_enabled, directory_visibility, directory_show_contact, directory_show_category, directory_default_category_id')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (settings.error) return fail(c, 'directory list: settings', settings.error);
  // Off unless the community turned it on (slice 3). 404 rather than an empty
  // list: "there is no directory here" and "the directory is empty" are
  // different answers and must not look alike.
  if (!settings.data?.directory_enabled) return c.json({ error: 'no member directory here' }, 404);

  // The viewer must be listed themselves to see the list. Being in a
  // directory and reading one are the same bargain.
  const viewerEntry = await adminClient
    .from('membership_directory_entry')
    .select('person_id')
    .eq('workspace_id', workspaceId)
    .in('person_id', viewerPersonIds)
    .eq('listed', true);
  if (viewerEntry.error) return fail(c, 'directory list: viewer entry', viewerEntry.error);
  if (!(viewerEntry.data ?? []).length) {
    return c.json({ items: [], you_are_listed: false });
  }

  // Candidates: listed IS TRUE, active membership, person not soft-deleted.
  const listed = await adminClient
    .from('membership_directory_entry')
    .select('person_id, show_contact, tags')
    .eq('workspace_id', workspaceId)
    .eq('listed', true);
  if (listed.error) return fail(c, 'directory list: entries', listed.error);
  const candidateIds = (listed.data ?? []).map((e) => e.person_id as string);
  if (!candidateIds.length) return c.json({ items: [], you_are_listed: true });

  const [activeMembers, persons] = await Promise.all([
    adminClient
      .from('membership_member')
      .select('person_id')
      .eq('workspace_id', workspaceId)
      .in('person_id', candidateIds)
      .eq('status', 'active')
      .is('deleted_at', null),
    adminClient
      // person carries NO photo_url and NO bio — they live on
      // identity_profile, keyed by EMAIL, which is the platform's one profile
      // per human (§9.1, and the same source A2 taught the public organiser
      // page to read). Checked against the real table: selecting
      // person.photo_url is a runtime 400, and TypeScript never reads a
      // PostgREST select string.
      .from('person')
      .select(
        'id, first_name, last_name, preferred_name, email, phone, linkedin_url, website_url, city, country, deleted_at',
      )
      .in('id', candidateIds)
      .is('deleted_at', null),
  ]);
  if (activeMembers.error) return fail(c, 'directory list: memberships', activeMembers.error);
  if (persons.error) return fail(c, 'directory list: persons', persons.error);
  const activeIds = new Set((activeMembers.data ?? []).map((m) => m.person_id as string));

  // The profile half, by email. A member with no profile row still appears —
  // with their person name and no photo — because being unlisted for want of
  // a profile is not a choice anybody made.
  const emails = [...new Set((persons.data ?? []).map((p) => p.email as string).filter(Boolean))];
  const profiles = emails.length
    ? await adminClient
        .from('identity_profile')
        .select('email, display_name, bio, photo_url')
        .in('email', emails)
    : { data: [], error: null };
  if (profiles.error) return fail(c, 'directory list: profiles', profiles.error);
  const profileOf = new Map(
    (profiles.data ?? []).map((r) => [String(r.email).toLowerCase(), r]),
  );

  const cats = await categoriesByPerson(workspaceId, [...candidateIds, ...viewerPersonIds]);
  const viewerCats = new Set<string>();
  for (const id of viewerPersonIds) for (const c2 of cats.get(id) ?? []) viewerCats.add(c2);
  const byCategory = settings.data.directory_visibility === 'category';

  const categoryNames = settings.data.directory_show_category
    ? await adminClient
        .from('membership_directory_category')
        .select('id, name')
        .eq('workspace_id', workspaceId)
    : { data: [], error: null };
  if (categoryNames.error) return fail(c, 'directory list: category names', categoryNames.error);
  const nameOf = new Map(
    (categoryNames.data ?? []).map((r) => [r.id as string, r.name as string]),
  );

  const entryOf = new Map(
    (listed.data ?? []).map((e) => [e.person_id as string, e]),
  );
  const items: DirectoryMember[] = [];
  for (const p of persons.data ?? []) {
    const id = p.id as string;
    if (!activeIds.has(id)) continue;
    if (viewerPersonIds.includes(id)) continue; // you are not a row in your own list
    const mine = cats.get(id) ?? new Set<string>();
    if (byCategory && ![...mine].some((x) => viewerCats.has(x))) continue;

    const entry = entryOf.get(id);
    const show =
      entry?.show_contact !== null && entry?.show_contact !== undefined
        ? Boolean(entry.show_contact)
        : Boolean(settings.data.directory_show_contact);

    const prof = profileOf.get(String(p.email ?? '').toLowerCase());
    const fromPerson = [p.preferred_name || p.first_name, p.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    items.push({
      person_id: id,
      display_name: (prof?.display_name as string | null) || fromPerson || 'A member',
      photo_url: (prof?.photo_url as string | null) ?? null,
      bio: (prof?.bio as string | null) ?? null,
      // City and country only — region, street and postal code are never
      // returned by this surface (§5).
      city: (p.city as string | null) ?? null,
      country: (p.country as string | null) ?? null,
      tags: (entry?.tags as string[] | undefined) ?? [],
      categories: settings.data.directory_show_category
        ? [...mine].map((x) => nameOf.get(x)).filter((n): n is string => Boolean(n))
        : [],
      email: show ? ((p.email as string | null) ?? null) : null,
      phone: show ? ((p.phone as string | null) ?? null) : null,
      // §5 counts LinkedIn and website as contact points, so they follow
      // show(M) rather than riding along with the name.
      linkedin_url: show ? ((p.linkedin_url as string | null) ?? null) : null,
      website_url: show ? ((p.website_url as string | null) ?? null) : null,
    });
  }

  items.sort((a, b) => a.display_name.localeCompare(b.display_name));
  return c.json({ items, you_are_listed: true });
});
