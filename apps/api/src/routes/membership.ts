import { Hono } from 'hono';
import { z } from 'zod';
import type Stripe from 'stripe';
import { userClient, adminClient } from '../db.js';
import { stripeOrNull } from '../lib/stripe/client.js';
import { workspaceStripeAccount } from '../lib/payment-accounts.js';
import { recordPurchase } from '../lib/purchases.js';
import { sendReceipt } from './purchases.js';
import { sendEmail } from '../lib/email/client.js';
import { getWorkspaceBrand } from '../lib/workspace-brand.js';
import { shell, escapeHtml } from '../lib/email/templates.js';
import {
  membershipWelcome,
  membershipRenewalReminder,
  membershipPaymentFailed,
  membershipLapsed,
} from '../lib/email/membership-templates.js';
import { runCircleAccessSync } from '../lib/circle.js';
import {
  applyPct,
  evaluatePriceLogic,
  priceLogicFor,
  type PriceLogic,
} from '../lib/pricing.js';
import { runFibreSeatSync, grantSeat } from '../lib/fibre-seat.js';

// ===========================================================================
// Fibre Membership — the community-subscription API.
//
// A workspace sells tiered recurring memberships to its community.
// docs/membership-proposal.md is the spec (D1–D6 accepted 2026-09-04).
//
// System-of-record rule (§3.8): member.status is written HERE (and by the
// Stripe webhook / scheduler via service role) — Flow reacts to the activity
// events, it never owns the lifecycle.
//
// RLS does the heavy lifting: catalogue reads for anyone in the workspace
// with the app, writes admin-only, members visible workspace-wide with the
// app. Every human-session query runs through userClient(jwt). Full
// Postgres errors go to stderr (feedback_api_logs_first).
// ===========================================================================

export const membershipRoutes = new Hono();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const Characteristics = z.array(z.string().min(1).max(300)).max(30);

const CreateTier = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  characteristics: Characteristics.optional(),
  price_cents_year: z.number().int().min(0).optional().nullable(),
  price_cents_month: z.number().int().min(0).optional().nullable(),
  currency: z.string().length(3).default('EUR'),
  sort_order: z.number().int().optional(),
});
const PatchTier = CreateTier.partial().extend({
  archived: z.boolean().optional(),
});

const LinkKind = z.enum(['thread', 'meet', 'circle_space', 'url']);
const CreateProduct = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  characteristics: Characteristics.optional(),
  price_cents: z.number().int().min(0).optional().nullable(),
  currency: z.string().length(3).default('EUR'),
  links: z
    .array(z.object({ kind: LinkKind, ref: z.string().min(1).max(500), label: z.string().max(200).optional() }))
    .max(30)
    .optional(),
  sort_order: z.number().int().optional(),
});
const PatchProduct = CreateProduct.partial().extend({
  archived: z.boolean().optional(),
});

const MemberStatus = z.enum(['active', 'grace', 'lapsed', 'cancelled']);
const CreateMember = z.object({
  person_id: z.string().uuid(),
  tier_id: z.string().uuid(),
  status: MemberStatus.default('active'),
  started_at: z.string().datetime().optional(),
  renews_at: z.string().datetime().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});
const PatchMember = z.object({
  tier_id: z.string().uuid().optional(),
  status: MemberStatus.optional(),
  renews_at: z.string().datetime().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  // Self-declared country — a DELIBERATE change (§3.9): reprices the
  // subscription from the next renewal, never mid-cycle.
  country: z.string().regex(/^[A-Za-z]{2}$/).optional().nullable(),
});

// Grant kinds are a deploy-time vocabulary (like app-key scopes) — the DB
// deliberately has no CHECK so adding one here is enough.
const GrantKind = z.enum(['circle', 'thread', 'fibre_seat']);
// Grants attach to a PRODUCT (the promise carries its fulfillment —
// 2026-09-05); tier_id remains accepted for the legacy tier-level rows.
const CreateGrant = z
  .object({
    product_id: z.string().uuid().optional(),
    tier_id: z.string().uuid().optional(),
    kind: GrantKind,
    // Non-secret targeting only ({space_id} / {thread_slug} / {role}).
    // Credentials go in membership_settings, service-role only.
    config: z.record(z.string(), z.unknown()).default({}),
  })
  .refine((v) => Boolean(v.product_id) !== Boolean(v.tier_id), {
    message: 'exactly one of product_id or tier_id',
  });

const PutSettings = z.object({
  circle_api_token: z.string().max(500).optional().nullable(),
  circle_community_url: z.string().url().max(500).optional().nullable(),
  join_page: z.record(z.string(), z.unknown()).optional(),
  // Fibre-seat policy (2026-09-05): approve-or-auto, and the standing
  // consent for seats that bill above the plan allowance.
  fibre_seat_mode: z.enum(['auto', 'approve']).optional(),
  allow_billed_seats: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(c: any, where: string, error: { message: string; code?: string; details?: string; hint?: string }) {
  console.error(`[membership] ${where}`, error);
  return c.json({ error: error.message, code: error.code }, 500);
}

// membership_settings is service-role-only (it holds the Circle token), so
// RLS can't gate it — check explicitly. Two doors (2026-09-05, "some people
// should have access other than the workspace admin"): workspace admin, or
// app-level role 'admin' on Membership (mirrors the has_app_role RLS gate).
async function isMembershipAdmin(workspaceId: string, userId: string): Promise<boolean> {
  if (!userId) return false;
  const [{ data: wm }, app] = await Promise.all([
    adminClient
      .from('workspace_member')
      .select('workspace_role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle(),
    appId(),
  ]);
  if (wm?.workspace_role === 'admin' || wm?.workspace_role === 'super_admin') return true;
  if (!app) return false;
  const { data: am } = await adminClient
    .from('app_membership')
    .select('role')
    .eq('user_id', userId)
    .eq('app_id', app)
    .maybeSingle();
  return am?.role === 'admin';
}

const membershipAppId = { id: null as string | null };
async function appId(): Promise<string | null> {
  if (membershipAppId.id) return membershipAppId.id;
  const { data } = await adminClient.from('app').select('id').eq('slug', 'membership').maybeSingle();
  membershipAppId.id = data?.id ?? null;
  return membershipAppId.id;
}

// Activity is the sanctioned wall-crossing: type + subject only, append-only.
export async function logMemberActivity(
  workspaceId: string,
  personId: string,
  type: string,
  subject: string,
): Promise<void> {
  const app = await appId();
  if (!app) return;
  await adminClient.from('activity').insert({
    workspace_id: workspaceId,
    person_id: personId,
    app_id: app,
    type,
    subject: subject.slice(0, 200),
    occurred_at: new Date().toISOString(),
  });
}

// Ensure the pending journal rows exist for every grant the member's tier
// carries (idempotent — unique (member_id, access_grant_id)); the sync
// worker (Phase D) drains them. Revocation flips existing rows instead.
export async function reconcileMemberAccess(memberId: string): Promise<void> {
  const { data: member } = await adminClient
    .from('membership_member')
    .select('id, tier_id, status')
    .eq('id', memberId)
    .maybeSingle();
  if (!member) return;

  // Entitlement = legacy tier-level grants + grants carried by the tier's
  // products (tier → membership_tier_product → product → grants).
  const [{ data: tierGrants }, { data: tierProducts }] = await Promise.all([
    adminClient.from('membership_access_grant').select('id').eq('tier_id', member.tier_id),
    adminClient.from('membership_tier_product').select('product_id').eq('tier_id', member.tier_id),
  ]);
  const productIds = (tierProducts ?? []).map((tp) => tp.product_id);
  const { data: productGrants } = productIds.length
    ? await adminClient.from('membership_access_grant').select('id').in('product_id', productIds)
    : { data: [] as { id: string }[] };
  const grants = [...(tierGrants ?? []), ...(productGrants ?? [])];

  if (member.status === 'active' || member.status === 'grace') {
    for (const g of grants ?? []) {
      const { error } = await adminClient
        .from('membership_member_access')
        .insert({ member_id: member.id, access_grant_id: g.id, status: 'pending' });
      if (error && error.code !== '23505') {
        console.error('[membership] access journal insert failed', error);
      }
    }
    // A tier change leaves stale granted rows for OTHER tiers' grants —
    // flag them for revocation.
    const grantIds = (grants ?? []).map((g) => g.id);
    const { data: stale } = await adminClient
      .from('membership_member_access')
      .select('id, access_grant_id, status')
      .eq('member_id', member.id);
    for (const row of stale ?? []) {
      if (
        !grantIds.includes(row.access_grant_id) &&
        (row.status === 'granted' || row.status === 'pending' || row.status === 'awaiting_approval')
      ) {
        await adminClient
          .from('membership_member_access')
          .update({ status: row.status === 'granted' ? 'revoke_pending' : 'revoked', updated_at: new Date().toISOString() })
          .eq('id', row.id);
      }
    }
  } else {
    // Lapsed / cancelled — everything granted gets revoke-flagged.
    await adminClient
      .from('membership_member_access')
      .update({ status: 'revoke_pending', updated_at: new Date().toISOString() })
      .eq('member_id', member.id)
      .eq('status', 'granted');
    await adminClient
      .from('membership_member_access')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('member_id', member.id)
      .in('status', ['pending', 'awaiting_approval']);
  }
}

// Access composition changed (tier's products, or a product's grants) —
// re-reconcile everyone currently entitled through that tier.
export async function reconcileTierMembers(tierId: string): Promise<void> {
  const { data: members } = await adminClient
    .from('membership_member')
    .select('id')
    .eq('tier_id', tierId)
    .in('status', ['active', 'grace'])
    .is('deleted_at', null);
  for (const m of members ?? []) await reconcileMemberAccess(m.id);
}

async function reconcileProductMembers(productId: string): Promise<void> {
  const { data: links } = await adminClient
    .from('membership_tier_product')
    .select('tier_id')
    .eq('product_id', productId);
  for (const l of links ?? []) await reconcileTierMembers(l.tier_id);
}

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

membershipRoutes.get('/tiers', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_tier')
    .select(
      'id, name, description, characteristics, price_cents_year, price_cents_month, currency, stripe_price_id_year, stripe_price_id_month, sort_order, archived_at, created_at, membership_tier_product ( product_id )',
    )
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return fail(c, 'list tiers', error);
  const includeArchived = c.req.query('archived') === 'true';
  const items = (data ?? [])
    .filter((t) => includeArchived || !t.archived_at)
    .map((t) => ({
      ...t,
      product_ids: (t.membership_tier_product ?? []).map((l: { product_id: string }) => l.product_id),
      membership_tier_product: undefined,
    }));
  return c.json({ items });
});

membershipRoutes.post('/tiers', async (c) => {
  const body = CreateTier.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_tier')
    .insert({ ...body.data, workspace_id: ctx.workspaceId })
    .select('id')
    .single();
  if (error) return fail(c, 'create tier', error);
  return c.json({ id: data.id }, 201);
});

membershipRoutes.patch('/tiers/:id', async (c) => {
  const body = PatchTier.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { archived, ...rest } = body.data;
  const patch: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
  if (archived !== undefined) patch.archived_at = archived ? new Date().toISOString() : null;
  const { error } = await db.from('membership_tier').update(patch).eq('id', c.req.param('id'));
  if (error) return fail(c, 'patch tier', error);
  return c.json({ ok: true });
});

// Replace a tier's included products in one call (the dialog saves whole).
membershipRoutes.put('/tiers/:id/products', async (c) => {
  const body = z
    .object({ product_ids: z.array(z.string().uuid()).max(100) })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const tierId = c.req.param('id');

  const { data: existing, error: readErr } = await db
    .from('membership_tier_product')
    .select('id, product_id')
    .eq('tier_id', tierId);
  if (readErr) return fail(c, 'read tier products', readErr);

  const want = new Set(body.data.product_ids);
  const have = new Set((existing ?? []).map((r) => r.product_id));
  const toDelete = (existing ?? []).filter((r) => !want.has(r.product_id)).map((r) => r.id);
  const toInsert = body.data.product_ids
    .filter((p) => !have.has(p))
    .map((product_id) => ({ tier_id: tierId, product_id }));

  if (toDelete.length) {
    const { error } = await db.from('membership_tier_product').delete().in('id', toDelete);
    if (error) return fail(c, 'unlink tier products', error);
  }
  if (toInsert.length) {
    const { error } = await db.from('membership_tier_product').insert(toInsert);
    if (error) return fail(c, 'link tier products', error);
  }
  if (toDelete.length || toInsert.length) void reconcileTierMembers(tierId);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

membershipRoutes.get('/products', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_product')
    .select('id, name, description, characteristics, price_cents, currency, links, sort_order, archived_at, created_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return fail(c, 'list products', error);
  const includeArchived = c.req.query('archived') === 'true';
  return c.json({ items: (data ?? []).filter((p) => includeArchived || !p.archived_at) });
});

membershipRoutes.post('/products', async (c) => {
  const body = CreateProduct.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_product')
    .insert({ ...body.data, workspace_id: ctx.workspaceId })
    .select('id')
    .single();
  if (error) return fail(c, 'create product', error);
  return c.json({ id: data.id }, 201);
});

membershipRoutes.patch('/products/:id', async (c) => {
  const body = PatchProduct.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { archived, ...rest } = body.data;
  const patch: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
  if (archived !== undefined) patch.archived_at = archived ? new Date().toISOString() : null;
  const { error } = await db.from('membership_product').update(patch).eq('id', c.req.param('id'));
  if (error) return fail(c, 'patch product', error);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

const MemberListQuery = z.object({
  after: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: MemberStatus.optional(),
  tier_id: z.string().uuid().optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

const MEMBER_SELECT =
  'id, person_id, organisation_id, tier_id, status, started_at, renews_at, lapsed_at, stripe_subscription_id, notes, created_at, ' +
  'person:person_id (id, first_name, last_name, email), tier:tier_id (id, name)';

membershipRoutes.get('/members', async (c) => {
  const parsed = MemberListQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { after, limit, status, tier_id, q } = parsed.data;

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  let query = db
    .from('membership_member')
    .select(MEMBER_SELECT)
    .order('id', { ascending: true })
    .limit(limit + 1);
  if (after) query = query.gt('id', after);
  if (status) query = query.eq('status', status);
  if (tier_id) query = query.eq('tier_id', tier_id);

  const { data, error } = await query;
  if (error) return fail(c, 'list members', error);

  // The concatenated select string defeats supabase-js type inference —
  // rows come back as GenericStringError without the cast.
  type MemberRow = { id: string; person: { first_name?: string; last_name?: string; email?: string } | null };
  let rows = (data ?? []) as unknown as MemberRow[];
  // Person-name search filters the page in memory — PostgREST can't ilike
  // across the embedded relation. Acceptable at community scale; revisit
  // with an RPC if a workspace passes ~thousands of members.
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((m) =>
      [m.person?.first_name, m.person?.last_name, m.person?.email].some((v) => v?.toLowerCase().includes(needle)),
    );
  }
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return c.json({ items, next: hasMore ? items[items.length - 1]?.id : null });
});

membershipRoutes.get('/members/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_member')
    .select(MEMBER_SELECT)
    .eq('id', c.req.param('id'))
    .maybeSingle();
  if (error) return fail(c, 'get member', error);
  if (!data) return c.json({ error: 'not found' }, 404);
  const member = data as unknown as Record<string, unknown> & { id: string };

  const { data: access } = await db
    .from('membership_member_access')
    .select('id, access_grant_id, status, external_ref, last_error, synced_at')
    .eq('member_id', member.id);
  return c.json({ ...member, access: access ?? [] });
});

// Manual add (admin door — the paid door is the public join flow, Phase B).
membershipRoutes.post('/members', async (c) => {
  const body = CreateMember.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_member')
    .insert({ ...body.data, workspace_id: ctx.workspaceId })
    .select('id, person_id, tier_id, status')
    .single();
  if (error) {
    if (error.code === '23505') {
      return c.json({ error: 'This person already has a membership in this workspace.' }, 409);
    }
    return fail(c, 'create member', error);
  }
  const { data: tier } = await db.from('membership_tier').select('name').eq('id', data.tier_id).maybeSingle();
  await logMemberActivity(ctx.workspaceId, data.person_id, 'membership_joined', `Joined · ${tier?.name ?? 'membership'}`);
  await reconcileMemberAccess(data.id);
  return c.json({ id: data.id }, 201);
});

membershipRoutes.patch('/members/:id', async (c) => {
  const body = PatchMember.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const memberId = c.req.param('id');

  const { data: before, error: readErr } = await db
    .from('membership_member')
    .select('id, person_id, tier_id, status, country, stripe_subscription_id, workspace_id, tier:tier_id (name)')
    .eq('id', memberId)
    .maybeSingle();
  if (readErr) return fail(c, 'read member', readErr);
  if (!before) return c.json({ error: 'not found' }, 404);

  const patch: Record<string, unknown> = { ...body.data, updated_at: new Date().toISOString() };
  if (body.data.status === 'lapsed' && before.status !== 'lapsed') patch.lapsed_at = new Date().toISOString();
  const { error } = await db.from('membership_member').update(patch).eq('id', memberId);
  if (error) return fail(c, 'patch member', error);

  // Lifecycle + tier changes cross the wall as activity (type + subject).
  if (body.data.tier_id && body.data.tier_id !== before.tier_id) {
    const { data: tier } = await db.from('membership_tier').select('name').eq('id', body.data.tier_id).maybeSingle();
    await logMemberActivity(ctx.workspaceId, before.person_id, 'membership_tier_changed', `Tier changed · ${tier?.name ?? ''}`);
  }
  if (body.data.status && body.data.status !== before.status) {
    const subjectByStatus: Record<string, [string, string]> = {
      active: before.status === 'lapsed' || before.status === 'cancelled'
        ? ['membership_rejoined', 'Rejoined']
        : ['membership_renewed', 'Membership active'],
      grace: ['membership_payment_failed', 'Payment failed — grace period'],
      lapsed: ['membership_lapsed', 'Membership lapsed'],
      cancelled: ['membership_cancelled', 'Membership cancelled'],
    };
    const entry = subjectByStatus[body.data.status];
    if (entry) await logMemberActivity(ctx.workspaceId, before.person_id, entry[0], entry[1]);
  }
  if (body.data.tier_id || body.data.status) await reconcileMemberAccess(memberId);

  // Country changed on a live subscription → reprice FROM THE NEXT RENEWAL
  // (proration none — the seat policy's sibling). Failures are surfaced,
  // not swallowed: a price that silently didn't change is worse than an
  // error the admin sees.
  const newCountry = body.data.country === undefined ? undefined : body.data.country?.toUpperCase() ?? null;
  if (
    newCountry !== undefined &&
    newCountry !== (before.country?.toUpperCase() ?? null) &&
    before.stripe_subscription_id
  ) {
    const r = await repriceMemberSubscription(memberId);
    if (!r.ok) return c.json({ ok: true, reprice_error: r.error });
    await logMemberActivity(
      ctx.workspaceId,
      before.person_id,
      'membership_repriced',
      `Repriced from next renewal (${newCountry ?? 'no country'})`,
    );
    return c.json({ ok: true, repriced: true });
  }
  return c.json({ ok: true });
});

// Re-resolve the pricing logic for a member's CURRENT tier/interval and move
// the live subscription onto the new amount from the next period. A new
// Price object is created on the connected account (price_data cannot be
// used on subscription updates); proration_behavior 'none' means the paid
// period runs out untouched.
async function repriceMemberSubscription(
  memberId: string,
): Promise<{ ok: true; amount: number } | { ok: false; error: string }> {
  const stripe = stripeOrNull();
  if (!stripe) return { ok: false, error: 'payments not configured' };
  const { data: m } = await adminClient
    .from('membership_member')
    .select('id, workspace_id, tier_id, country, stripe_subscription_id')
    .eq('id', memberId)
    .maybeSingle();
  if (!m?.stripe_subscription_id) return { ok: false, error: 'no live subscription' };
  const account = await workspaceStripeAccount(m.workspace_id);
  if (!account) return { ok: false, error: 'workspace has no Stripe account' };

  const sub = await stripe.subscriptions.retrieve(m.stripe_subscription_id, {}, { stripeAccount: account });
  const item = sub.items.data[0];
  if (!item) return { ok: false, error: 'subscription has no items' };
  const interval = item.price.recurring?.interval === 'month' ? 'month' : 'year';

  const { data: tier } = await adminClient
    .from('membership_tier')
    .select('price_cents_year, price_cents_month, currency')
    .eq('id', m.tier_id)
    .maybeSingle();
  const base = interval === 'year' ? tier?.price_cents_year : tier?.price_cents_month;
  if (base == null || base <= 0) return { ok: false, error: `tier has no ${interval}ly price` };

  const logic = await priceLogicFor(m.workspace_id, m.tier_id);
  const { pct } = evaluatePriceLogic(logic, { country: m.country, interval });
  const amount = applyPct(base, pct);
  if (amount === item.price.unit_amount) return { ok: true, amount };

  const productId = typeof item.price.product === 'string' ? item.price.product : item.price.product?.id;
  if (!productId) return { ok: false, error: 'could not resolve the Stripe product' };
  const newPrice = await stripe.prices.create(
    {
      product: productId,
      currency: item.price.currency,
      unit_amount: amount,
      recurring: { interval },
    },
    { stripeAccount: account },
  );
  await stripe.subscriptions.update(
    m.stripe_subscription_id,
    { items: [{ id: item.id, price: newPrice.id }], proration_behavior: 'none' },
    { stripeAccount: account },
  );
  return { ok: true, amount };
}

// ---------------------------------------------------------------------------
// Access grants
// ---------------------------------------------------------------------------

membershipRoutes.get('/grants', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_access_grant')
    .select('id, tier_id, product_id, kind, config, created_at, tier:tier_id (name), product:product_id (name)')
    .order('created_at', { ascending: true });
  if (error) return fail(c, 'list grants', error);
  return c.json({ items: data ?? [] });
});

membershipRoutes.post('/grants', async (c) => {
  const body = CreateGrant.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_access_grant')
    .insert({ ...body.data, workspace_id: ctx.workspaceId })
    .select('id')
    .single();
  if (error) return fail(c, 'create grant', error);
  if (body.data.tier_id) void reconcileTierMembers(body.data.tier_id);
  else if (body.data.product_id) void reconcileProductMembers(body.data.product_id);
  return c.json({ id: data.id }, 201);
});

membershipRoutes.delete('/grants/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: before } = await db
    .from('membership_access_grant')
    .select('tier_id, product_id')
    .eq('id', c.req.param('id'))
    .maybeSingle();
  // Grants aren't personal data — hard delete is fine; the journal rows
  // cascade. Members keep external access until a future sync sweep; v1
  // treats grant removal as configuration, not revocation.
  const { error } = await db.from('membership_access_grant').delete().eq('id', c.req.param('id'));
  if (error) return fail(c, 'delete grant', error);
  if (before?.tier_id) void reconcileTierMembers(before.tier_id);
  else if (before?.product_id) void reconcileProductMembers(before.product_id);
  return c.json({ ok: true });
});

// Approve a parked seat: provisions synchronously — the human clicked, so
// the answer (granted or a concrete error) comes back on the same request.
// Approval IS the consent, so it overrides mode and the billed-seat gate
// (grantSeat still refuses when the plan can neither include nor bill it).
membershipRoutes.post('/access/:id/approve', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isMembershipAdmin(ctx.workspaceId, ctx.userId))) {
    return c.json({ error: 'admin only' }, 403);
  }
  const { data: row } = await adminClient
    .from('membership_member_access')
    .select('id, status, grant:access_grant_id (kind, config), member:member_id (id, workspace_id, person_id)')
    .eq('id', c.req.param('id'))
    .maybeSingle();
  const grant = Array.isArray(row?.grant) ? row?.grant[0] : row?.grant;
  const member = Array.isArray(row?.member) ? row?.member[0] : row?.member;
  if (!row || !grant || !member || member.workspace_id !== ctx.workspaceId) {
    return c.json({ error: 'not found' }, 404);
  }
  if (row.status !== 'awaiting_approval') return c.json({ error: 'nothing to approve' }, 409);
  if (grant.kind !== 'fibre_seat') return c.json({ error: 'only seat grants park for approval' }, 400);

  const r = await grantSeat(member.workspace_id, member.person_id, grant.config);
  await adminClient
    .from('membership_member_access')
    .update(
      r.ok
        ? { status: 'granted', external_ref: r.userId, last_error: null, synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        : { status: 'error', last_error: r.error, updated_at: new Date().toISOString() },
    )
    .eq('id', row.id);
  return r.ok ? c.json({ ok: true }) : c.json({ error: r.error }, 409);
});

// Retry failed syncs: error rows flip back to the direction the member's
// CURRENT state implies, and the next scheduler tick re-runs them.
membershipRoutes.post('/access/retry', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isMembershipAdmin(ctx.workspaceId, ctx.userId))) {
    return c.json({ error: 'admin only' }, 403);
  }
  const { data: errored } = await adminClient
    .from('membership_member_access')
    .select(
      'id, access_grant_id, member:member_id (workspace_id, status, tier_id), grant:access_grant_id (tier_id)',
    )
    .eq('status', 'error');
  let retried = 0;
  for (const row of (errored ?? []) as unknown as {
    id: string;
    member: { workspace_id: string; status: string; tier_id: string } | null;
    grant: { tier_id: string } | null;
  }[]) {
    if (row.member?.workspace_id !== ctx.workspaceId) continue;
    const entitled =
      (row.member.status === 'active' || row.member.status === 'grace') &&
      row.grant?.tier_id === row.member.tier_id;
    await adminClient
      .from('membership_member_access')
      .update({
        status: entitled ? 'pending' : 'revoke_pending',
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    retried += 1;
  }
  return c.json({ retried });
});

// ---------------------------------------------------------------------------
// Pricing rules — the logic builder (§3.9, generalised). One 'price_logic'
// set per (workspace × tier-or-null); declarative rows, first match wins.
// ---------------------------------------------------------------------------

const PriceConditionZ = z.object({
  attr: z.enum(['country', 'interval']),
  op: z.enum(['in', 'not_in']),
  values: z.array(z.string().min(1).max(20)).min(1).max(100),
});
const PriceLogicZ = z.object({
  rules: z
    .array(
      z.object({
        when: PriceConditionZ,
        pct: z.number().min(1).max(1000),
        label: z.string().max(120).optional(),
      }),
    )
    .max(50),
  default_pct: z.number().min(1).max(1000).default(100),
});

membershipRoutes.get('/pricing-rules', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_pricing_rule')
    .select('id, tier_id, kind, config, updated_at')
    .eq('kind', 'price_logic');
  if (error) return fail(c, 'list pricing rules', error);
  return c.json({ items: data ?? [] });
});

membershipRoutes.put('/pricing-rules', async (c) => {
  const body = z
    .object({ tier_id: z.string().uuid().nullable().default(null), config: PriceLogicZ })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { error } = await db.from('membership_pricing_rule').upsert(
    {
      workspace_id: ctx.workspaceId,
      tier_id: body.data.tier_id,
      kind: 'price_logic',
      config: body.data.config,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id,kind,tier_id' },
  );
  if (error) return fail(c, 'save pricing rules', error);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Settings (service-role-only table — explicit admin check, token masked)
// ---------------------------------------------------------------------------

membershipRoutes.get('/settings', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isMembershipAdmin(ctx.workspaceId, ctx.userId))) {
    return c.json({ error: 'admin only' }, 403);
  }
  const { data, error } = await adminClient
    .from('membership_settings')
    .select('workspace_id, circle_api_token, circle_community_url, join_page, fibre_seat_mode, allow_billed_seats, updated_at')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (error) return fail(c, 'get settings', error);
  return c.json({
    circle_community_url: data?.circle_community_url ?? null,
    // The token never leaves the API — only whether one is set.
    circle_api_token_set: Boolean(data?.circle_api_token),
    join_page: data?.join_page ?? {},
    fibre_seat_mode: data?.fibre_seat_mode ?? 'approve',
    allow_billed_seats: data?.allow_billed_seats ?? false,
  });
});

membershipRoutes.put('/settings', async (c) => {
  const body = PutSettings.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  if (!(await isMembershipAdmin(ctx.workspaceId, ctx.userId))) {
    return c.json({ error: 'admin only' }, 403);
  }
  const row: Record<string, unknown> = { workspace_id: ctx.workspaceId, updated_at: new Date().toISOString() };
  if (body.data.circle_api_token !== undefined) row.circle_api_token = body.data.circle_api_token;
  if (body.data.circle_community_url !== undefined) row.circle_community_url = body.data.circle_community_url;
  if (body.data.join_page !== undefined) row.join_page = body.data.join_page;
  if (body.data.fibre_seat_mode !== undefined) row.fibre_seat_mode = body.data.fibre_seat_mode;
  if (body.data.allow_billed_seats !== undefined) row.allow_billed_seats = body.data.allow_billed_seats;
  const { error } = await adminClient
    .from('membership_settings')
    .upsert(row, { onConflict: 'workspace_id' });
  if (error) return fail(c, 'put settings', error);
  return c.json({ ok: true });
});

// ===========================================================================
// PUBLIC surface — the join page (no auth; adminClient with explicit
// workspace scoping throughout, the /thread/public pattern).
// ===========================================================================

const MEMBERSHIP_APP_URL = process.env.MEMBERSHIP_APP_URL ?? 'https://membership.thefibre.app';

// The workspace must have the app activated for its join page to exist.
async function publicWorkspace(slug: string): Promise<{ id: string; slug: string; name: string } | null> {
  const { data: ws } = await adminClient
    .from('workspace')
    .select('id, slug, name')
    .eq('slug', slug)
    .maybeSingle();
  if (!ws) return null;
  const app = await appId();
  if (!app) return null;
  const { data: wa } = await adminClient
    .from('workspace_app')
    .select('id')
    .eq('workspace_id', ws.id)
    .eq('app_id', app)
    .is('deactivated_at', null)
    .maybeSingle();
  return wa ? ws : null;
}

membershipRoutes.get('/public/catalog/:workspaceSlug', async (c) => {
  const ws = await publicWorkspace(c.req.param('workspaceSlug'));
  if (!ws) return c.json({ error: 'not found' }, 404);

  const [{ data: tiers }, { data: products }, { data: settings }] = await Promise.all([
    adminClient
      .from('membership_tier')
      .select(
        'id, name, description, characteristics, price_cents_year, price_cents_month, currency, sort_order, membership_tier_product ( product_id )',
      )
      .eq('workspace_id', ws.id)
      .is('archived_at', null)
      .order('sort_order', { ascending: true }),
    adminClient
      .from('membership_product')
      .select('id, name, description, characteristics, links, sort_order')
      .eq('workspace_id', ws.id)
      .is('archived_at', null)
      .order('sort_order', { ascending: true }),
    adminClient
      .from('membership_settings')
      .select('join_page, circle_community_url')
      .eq('workspace_id', ws.id)
      .maybeSingle(),
  ]);

  const priceLogic = await priceLogicFor(ws.id, null);

  return c.json({
    workspace: { slug: ws.slug, name: ws.name },
    price_logic: priceLogic,
    tiers: (tiers ?? []).map((t) => ({
      ...t,
      product_ids: (t.membership_tier_product ?? []).map((l: { product_id: string }) => l.product_id),
      membership_tier_product: undefined,
    })),
    products: products ?? [],
    join_page: settings?.join_page ?? {},
  });
});

const PublicJoin = z.object({
  workspace_slug: z.string().min(1).max(100),
  tier_id: z.string().uuid(),
  interval: z.enum(['year', 'month']).default('year'),
  email: z.string().email(),
  name: z.string().min(1).max(200),
  // SELF-DECLARED country (§3.9 D1) — drives the pricing logic. Optional:
  // no country matches no country-rule, so the default pct applies.
  country: z.string().regex(/^[A-Za-z]{2}$/).optional(),
  request_id: z.string().min(8).max(100),
});

// The workspace's plan fee, as Stripe wants it for subscriptions: a percent.
// The fixed cap from lib/fees.ts cannot apply — application_fee_amount does
// not exist in subscription mode (documented in the proposal §3.3).
async function platformFeePercent(workspaceId: string): Promise<number> {
  try {
    const { data: feeRows } = await adminClient.rpc('workspace_meet_fee', { ws_id: workspaceId });
    const row = Array.isArray(feeRows) ? (feeRows[0] as { pct: number | string } | undefined) : null;
    if (row) {
      const pct = typeof row.pct === 'string' ? parseFloat(row.pct) : row.pct;
      if (Number.isFinite(pct)) return Math.round(pct * 100 * 100) / 100; // 0.02 → 2
    }
  } catch (e) {
    console.warn('[membership] fee lookup failed, defaulting to 2%', e);
  }
  return 2;
}

membershipRoutes.post('/public/join', async (c) => {
  const body = PublicJoin.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const d = body.data;
  const email = d.email.trim().toLowerCase();

  const ws = await publicWorkspace(d.workspace_slug);
  if (!ws) return c.json({ error: 'not found' }, 404);

  const stripe = stripeOrNull();
  if (!stripe) return c.json({ error: 'payments are not configured' }, 503);
  const account = await workspaceStripeAccount(ws.id);
  if (!account) {
    return c.json({ error: 'This community has not connected payments yet.' }, 503);
  }

  const { data: tier } = await adminClient
    .from('membership_tier')
    .select('id, name, price_cents_year, price_cents_month, currency')
    .eq('id', d.tier_id)
    .eq('workspace_id', ws.id)
    .is('archived_at', null)
    .maybeSingle();
  if (!tier) return c.json({ error: 'tier not found' }, 404);
  const baseAmount = d.interval === 'year' ? tier.price_cents_year : tier.price_cents_month;
  if (baseAmount == null || baseAmount <= 0) {
    return c.json({ error: `This tier has no ${d.interval}ly price.` }, 400);
  }
  // Pricing logic (§3.9): evaluated SERVER-SIDE — the join page preview is
  // a courtesy, this number is the charge.
  const country = d.country?.toUpperCase() ?? null;
  const logic = await priceLogicFor(ws.id, tier.id);
  const { pct, matched } = evaluatePriceLogic(logic, { country, interval: d.interval });
  const amount = applyPct(baseAmount, pct);
  if (amount <= 0) return c.json({ error: 'This price resolves to zero — check the pricing rules.' }, 400);

  // Auto-account (the Thread enrol pattern): email-only, verify at sign-in.
  try {
    const { data: hasAccount } = await adminClient.rpc('auth_user_exists', { p_email: email });
    if (hasAccount !== true) {
      await adminClient.auth.admin.createUser({ email, email_confirm: true });
    }
  } catch (e) {
    console.warn('[membership/public/join] account auto-create failed', e);
  }

  // Create-or-match the person (case-insensitive email match, no wildcards).
  let personId: string;
  const { data: existingPerson } = await adminClient
    .from('person')
    .select('id')
    .eq('workspace_id', ws.id)
    .ilike('email', email)
    .is('deleted_at', null)
    .maybeSingle();
  if (existingPerson) {
    personId = existingPerson.id;
  } else {
    const parts = d.name.trim().split(/\s+/);
    const { data: created, error: personErr } = await adminClient
      .from('person')
      .insert({
        workspace_id: ws.id,
        first_name: parts[0] ?? d.name.trim(),
        last_name: parts.slice(1).join(' ') || '',
        email,
      })
      .select('id')
      .single();
    if (personErr || !created) {
      console.error('[membership/public/join] person insert failed', personErr);
      return c.json({ error: 'could not create your contact record' }, 500);
    }
    personId = created.id;
  }

  // Already an active member? Send them to sign-in instead of double-charging.
  const { data: existingMember } = await adminClient
    .from('membership_member')
    .select('id, status')
    .eq('workspace_id', ws.id)
    .eq('person_id', personId)
    .maybeSingle();
  if (existingMember && (existingMember.status === 'active' || existingMember.status === 'grace')) {
    return c.json({ already_member: true });
  }

  const feePercent = await platformFeePercent(ws.id);
  const base = `${MEMBERSHIP_APP_URL}/${encodeURIComponent(ws.slug)}`;
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        line_items: [
          {
            price_data: {
              currency: (tier.currency ?? 'EUR').toLowerCase(),
              product_data: { name: `${ws.name} membership — ${tier.name}` },
              unit_amount: amount,
              recurring: { interval: d.interval },
            },
            quantity: 1,
          },
        ],
        subscription_data: {
          ...(feePercent > 0 ? { application_fee_percent: feePercent } : {}),
          metadata: {
            workspace_id: ws.id,
            person_id: personId,
            tier_id: tier.id,
            ...(country ? { country } : {}),
            applied_pct: String(pct),
          },
        },
        customer_email: email,
        billing_address_collection: 'required',
        allow_promotion_codes: true,
        metadata: { workspace_id: ws.id, person_id: personId, tier_id: tier.id, request_id: d.request_id },
        success_url: `${base}/joined?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}?cancelled=1`,
      },
      { stripeAccount: account },
    );
  } catch (e) {
    console.error('[membership/public/join] checkout create failed', e);
    return c.json({ error: 'could not start checkout' }, 502);
  }

  return c.json({ url: session.url });
});

// ===========================================================================
// Stripe webhook (Connect events from workspaces' accounts).
// Own secret, NO fallback — the billing.ts rule: a webhook verifying
// against the wrong endpoint's secret is an outage dressed as security.
// ===========================================================================

// Both checkout.session.completed and the FIRST invoice.paid can create the
// member (webhook ordering is not guaranteed) — they converge here.
async function ensureMemberFromSubscription(
  account: string,
  subscriptionId: string,
): Promise<{ id: string; workspace_id: string; person_id: string; tier_id: string; status: string } | null> {
  const { data: existing } = await adminClient
    .from('membership_member')
    .select('id, workspace_id, person_id, tier_id, status')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();
  if (existing) return existing;

  const stripe = stripeOrNull();
  if (!stripe) return null;
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {}, { stripeAccount: account });
  const meta = sub.metadata ?? {};
  if (!meta.workspace_id || !meta.person_id || !meta.tier_id) {
    console.error('[membership webhook] subscription without membership metadata', subscriptionId);
    return null;
  }

  const periodEnd = sub.items.data[0]?.current_period_end ?? null;
  const renewsAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null;

  // Rejoin reuses the (workspace, person) row — history survives the lapse.
  const { data: prior } = await adminClient
    .from('membership_member')
    .select('id, status')
    .eq('workspace_id', meta.workspace_id)
    .eq('person_id', meta.person_id)
    .maybeSingle();

  if (prior) {
    await adminClient
      .from('membership_member')
      .update({
        tier_id: meta.tier_id,
        status: 'active',
        renews_at: renewsAt,
        lapsed_at: null,
        deleted_at: null,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customer,
        ...(meta.country ? { country: meta.country } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', prior.id);
    const rejoining = prior.status === 'lapsed' || prior.status === 'cancelled';
    await logMemberActivity(
      meta.workspace_id,
      meta.person_id,
      rejoining ? 'membership_rejoined' : 'membership_joined',
      rejoining ? 'Rejoined' : 'Joined',
    );
    await reconcileMemberAccess(prior.id);
    return { id: prior.id, workspace_id: meta.workspace_id, person_id: meta.person_id, tier_id: meta.tier_id, status: 'active' };
  }

  const { data: created, error } = await adminClient
    .from('membership_member')
    .insert({
      workspace_id: meta.workspace_id,
      person_id: meta.person_id,
      tier_id: meta.tier_id,
      status: 'active',
      renews_at: renewsAt,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customer,
      ...(meta.country ? { country: meta.country } : {}),
    })
    .select('id, workspace_id, person_id, tier_id, status')
    .single();
  if (error) {
    // 23505 = a concurrent webhook created it — read it back.
    if (error.code === '23505') {
      const { data: raced } = await adminClient
        .from('membership_member')
        .select('id, workspace_id, person_id, tier_id, status')
        .eq('workspace_id', meta.workspace_id)
        .eq('person_id', meta.person_id)
        .maybeSingle();
      return raced ?? null;
    }
    console.error('[membership webhook] member insert failed', error);
    return null;
  }

  const { data: tier } = await adminClient
    .from('membership_tier')
    .select('name')
    .eq('id', meta.tier_id)
    .maybeSingle();
  await logMemberActivity(meta.workspace_id, meta.person_id, 'membership_joined', `Joined · ${tier?.name ?? 'membership'}`);
  await reconcileMemberAccess(created.id);

  // Welcome email, workspace-branded.
  try {
    const [{ data: person }, { data: ws }, brand] = await Promise.all([
      adminClient.from('person').select('first_name, email').eq('id', meta.person_id).maybeSingle(),
      adminClient.from('workspace').select('name').eq('id', meta.workspace_id).maybeSingle(),
      getWorkspaceBrand(meta.workspace_id),
    ]);
    if (person?.email) {
      const msg = membershipWelcome({
        name: person.first_name ?? 'there',
        communityName: ws?.name ?? 'the community',
        tierName: tier?.name ?? 'membership',
        renewsAt,
        brand: { logoUrl: brand.logoUrl, name: brand.fromName },
      });
      await sendEmail({
        to: person.email,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(brand.fromName ? { fromName: brand.fromName } : {}),
        ...(brand.fromAddress ? { fromAddress: brand.fromAddress } : {}),
        ...(brand.replyTo ? { replyTo: brand.replyTo } : {}),
      });
    }
  } catch (e) {
    console.warn('[membership webhook] welcome email failed', e);
  }

  return created;
}


// Subscription id off an invoice — the field moved across Stripe API
// versions (top-level → parent.subscription_details), so read defensively.
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const inv = invoice as unknown as {
    subscription?: string | { id?: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id?: string } | null } | null } | null;
  };
  const raw = inv.subscription ?? inv.parent?.subscription_details?.subscription ?? null;
  if (!raw) return null;
  return typeof raw === 'string' ? raw : raw.id ?? null;
}

async function memberForInvoice(
  account: string,
  invoice: Stripe.Invoice,
): Promise<{ id: string; workspace_id: string; person_id: string; tier_id: string; status: string } | null> {
  const subId = invoiceSubscriptionId(invoice);
  if (subId) {
    const member = await ensureMemberFromSubscription(account, subId);
    if (member) return member;
  }
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return null;
  const { data } = await adminClient
    .from('membership_member')
    .select('id, workspace_id, person_id, tier_id, status')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return data;
}

async function warnOnCardCountryMismatch(
  account: string,
  invoice: Stripe.Invoice,
  member: { id: string; workspace_id: string; person_id: string },
): Promise<void> {
  const { data: m } = await adminClient
    .from('membership_member')
    .select('country')
    .eq('id', member.id)
    .maybeSingle();
  const declared = m?.country?.toUpperCase();
  if (!declared) return;

  const stripe = stripeOrNull();
  if (!stripe) return;
  const chargeId = (invoice as unknown as { charge?: string | { id?: string } | null }).charge;
  const chargeRef = typeof chargeId === 'string' ? chargeId : chargeId?.id;
  if (!chargeRef) return;
  const charge = await stripe.charges.retrieve(chargeRef, {}, { stripeAccount: account });
  const cardCountry = charge.payment_method_details?.card?.country?.toUpperCase();
  if (!cardCountry || cardCountry === declared) return;

  // One warning per invoice.
  const { error: dedupErr } = await adminClient
    .from('membership_reminder_send')
    .insert({ member_id: member.id, reminder_kind: 'card_country_mismatch', period_ref: invoice.id ?? 'unknown' });
  if (dedupErr) return; // 23505 = already warned

  const [{ data: person }, { data: admins }, brand] = await Promise.all([
    adminClient.from('person').select('first_name, last_name, email').eq('id', member.person_id).maybeSingle(),
    adminClient
      .from('workspace_member')
      .select('user:user_id (email)')
      .eq('workspace_id', member.workspace_id)
      .in('workspace_role', ['admin', 'super_admin']),
    getWorkspaceBrand(member.workspace_id),
  ]);
  const name = [person?.first_name, person?.last_name].filter(Boolean).join(' ') || person?.email || 'A member';
  for (const row of admins ?? []) {
    const u = Array.isArray(row.user) ? row.user[0] : row.user;
    if (!u?.email) continue;
    await sendEmail({
      to: u.email,
      subject: `Pricing check: ${name} declared ${declared}, paid with a ${cardCountry} card`,
      text: `${name} joined with country ${declared} (which sets their membership price) but paid with a card issued in ${cardCountry}.

Nothing was blocked — this is a heads-up so you can review the membership if it looks off. You can change their country on the member (it reprices from the next renewal).`,
      html: '',
      ...(brand.fromName ? { fromName: brand.fromName } : {}),
    });
  }
}

async function membershipInvoicePaid(account: string, invoice: Stripe.Invoice): Promise<void> {
  const member = await memberForInvoice(account, invoice);
  if (!member) {
    // A connected account's invoice that isn't a membership (workspaces use
    // Stripe for their own things too) — not ours, not an error.
    return;
  }

  const [{ data: tier }, { data: person }, { data: ws }] = await Promise.all([
    adminClient.from('membership_tier').select('name').eq('id', member.tier_id).maybeSingle(),
    adminClient.from('person').select('first_name, last_name, email').eq('id', member.person_id).maybeSingle(),
    adminClient.from('workspace').select('name').eq('id', member.workspace_id).maybeSingle(),
  ]);

  const periodEnd = invoice.lines?.data?.[0]?.period?.end;
  const renewsAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
  const isRenewal = invoice.billing_reason === 'subscription_cycle';

  const patch: Record<string, unknown> = { status: 'active', updated_at: new Date().toISOString() };
  if (renewsAt) patch.renews_at = renewsAt;
  await adminClient.from('membership_member').update(patch).eq('id', member.id);
  if (isRenewal) {
    await logMemberActivity(member.workspace_id, member.person_id, 'membership_renewed', `Renewed · ${tier?.name ?? ''}`);
    await reconcileMemberAccess(member.id);
  }

  // The ledger row — one per billing period, keyed by the Stripe invoice.
  // Seller VAT (inclusive split) is stamped by recordPurchase itself.
  const addr = invoice.customer_address;
  const label = `${ws?.name ?? 'Community'} membership — ${tier?.name ?? ''}${
    periodEnd ? ` (until ${new Date(periodEnd * 1000).toISOString().slice(0, 10)})` : ''
  }`;
  const itemRef = invoice.id ?? `membership-invoice-${member.id}-${Date.now()}`;
  await recordPurchase({
    appSlug: 'membership',
    workspaceId: member.workspace_id,
    itemRef,
    personId: member.person_id,
    itemLabel: label,
    payerName:
      invoice.customer_name ?? [person?.first_name, person?.last_name].filter(Boolean).join(' '),
    payerEmail: invoice.customer_email ?? person?.email ?? null,
    amountCents: invoice.amount_paid ?? 0,
    currency: (invoice.currency ?? 'eur').toUpperCase(),
    method: 'stripe',
    status: 'paid',
    stripeInvoiceId: invoice.id ?? null,
    stripeInvoiceUrl: invoice.hosted_invoice_url ?? null,
    stripeAccountId: account,
    billing: {
      number: invoice.number ?? null,
      company: invoice.customer_name ?? null,
      address: addr?.line1 ?? null,
      postal_code: addr?.postal_code ?? null,
      city: addr?.city ?? null,
      country: addr?.country ?? null,
      period_end: renewsAt,
      pdf: invoice.invoice_pdf ?? null,
    },
  });

  // Card-country vs declared-country (§3.9 D3): mismatch WARNS the
  // workspace admins, never blocks. Once per invoice (dedup table).
  try {
    await warnOnCardCountryMismatch(account, invoice, member);
  } catch (e) {
    console.warn('[membership/webhook] card-country check failed', e);
  }

  // Receipt in the house style, the WORKSPACE as seller (no override —
  // sellerDetailsFor resolves the workspace's own invoice details).
  const { data: saved } = await adminClient
    .from('purchase')
    .select('payer_name, payer_email, item_label, amount_cents, currency, method, status, created_at, billing, stripe_invoice_url, organiser_user_id')
    .eq('stripe_invoice_id', invoice.id ?? '')
    .maybeSingle();
  if (saved) {
    void sendReceipt(member.workspace_id, saved as Record<string, unknown>).catch((e) =>
      console.error('[membership/webhook] receipt email failed', e),
    );
  }
}

async function membershipInvoiceFailed(account: string, invoice: Stripe.Invoice): Promise<void> {
  const member = await memberForInvoice(account, invoice);
  if (!member) return;
  if (member.status === 'active') {
    await adminClient
      .from('membership_member')
      .update({ status: 'grace', updated_at: new Date().toISOString() })
      .eq('id', member.id);
    await logMemberActivity(member.workspace_id, member.person_id, 'membership_payment_failed', 'Payment failed — grace period');
  }

  // One email per failed invoice (dedup on the invoice id).
  const { error: dedupErr } = await adminClient
    .from('membership_reminder_send')
    .insert({ member_id: member.id, reminder_kind: 'payment_failed', period_ref: invoice.id ?? 'unknown' });
  if (dedupErr) {
    if (dedupErr.code !== '23505') console.warn('[membership/webhook] dedup insert failed', dedupErr);
    return;
  }
  const [{ data: person }, { data: ws }, { data: tier }, brand] = await Promise.all([
    adminClient.from('person').select('first_name, email').eq('id', member.person_id).maybeSingle(),
    adminClient.from('workspace').select('name').eq('id', member.workspace_id).maybeSingle(),
    adminClient.from('membership_tier').select('name').eq('id', member.tier_id).maybeSingle(),
    getWorkspaceBrand(member.workspace_id),
  ]);
  if (person?.email) {
    const msg = membershipPaymentFailed({
      name: person.first_name ?? 'there',
      communityName: ws?.name ?? 'the community',
      tierName: tier?.name ?? 'membership',
      brand: { logoUrl: brand.logoUrl, name: brand.fromName },
    });
    await sendEmail({
      to: person.email,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      ...(brand.fromName ? { fromName: brand.fromName } : {}),
      ...(brand.fromAddress ? { fromAddress: brand.fromAddress } : {}),
      ...(brand.replyTo ? { replyTo: brand.replyTo } : {}),
    });
  }
}

async function membershipSubscriptionDeleted(account: string, sub: Stripe.Subscription): Promise<void> {
  const { data: member } = await adminClient
    .from('membership_member')
    .select('id, workspace_id, person_id, status')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle();
  if (!member || member.status === 'lapsed' || member.status === 'cancelled') return;

  await adminClient
    .from('membership_member')
    .update({ status: 'lapsed', lapsed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', member.id);
  await logMemberActivity(member.workspace_id, member.person_id, 'membership_lapsed', 'Membership lapsed');
  await reconcileMemberAccess(member.id);

  try {
    const [{ data: person }, { data: ws }, brand] = await Promise.all([
      adminClient.from('person').select('first_name, email').eq('id', member.person_id).maybeSingle(),
      adminClient.from('workspace').select('name, slug').eq('id', member.workspace_id).maybeSingle(),
      getWorkspaceBrand(member.workspace_id),
    ]);
    if (person?.email) {
      const msg = membershipLapsed({
        name: person.first_name ?? 'there',
        communityName: ws?.name ?? 'the community',
        joinUrl: ws?.slug ? `${MEMBERSHIP_APP_URL}/${encodeURIComponent(ws.slug)}` : null,
        brand: { logoUrl: brand.logoUrl, name: brand.fromName },
      });
      await sendEmail({
        to: person.email,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(brand.fromName ? { fromName: brand.fromName } : {}),
        ...(brand.fromAddress ? { fromAddress: brand.fromAddress } : {}),
        ...(brand.replyTo ? { replyTo: brand.replyTo } : {}),
      });
    }
  } catch (e) {
    console.warn('[membership/webhook] lapsed email failed', e);
  }
}

membershipRoutes.post('/stripe-webhook', async (c) => {
  const stripe = stripeOrNull();
  // Own secret, NO fallback (the billing.ts rule): a webhook verifying
  // against another endpoint's secret is an outage dressed as security.
  const secret = process.env.STRIPE_MEMBERSHIP_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    console.error('[membership/webhook] not configured (key or STRIPE_MEMBERSHIP_WEBHOOK_SECRET missing)');
    return c.json({ error: 'not configured' }, 503);
  }
  const sig = c.req.header('stripe-signature');
  if (!sig) return c.json({ error: 'missing signature' }, 400);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await c.req.text(), sig, secret);
  } catch (e) {
    console.error('[membership/webhook] signature verification failed', e);
    return c.json({ error: 'bad signature' }, 400);
  }

  // Membership charges live on CONNECTED accounts — this must be a Connect
  // endpoint. An event without .account is from the platform account and
  // belongs to another webhook.
  const account = (event as unknown as { account?: string }).account;
  if (!account) return c.json({ received: true, ignored: 'no connected account' });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;
        // Only sessions the join flow created (Thread's checkouts share
        // these accounts — metadata is the discriminator).
        if (!session.metadata?.tier_id || !session.metadata?.person_id) break;
        const subId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (subId) await ensureMemberFromSubscription(account, subId);
        break;
      }
      case 'invoice.paid':
        await membershipInvoicePaid(account, event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await membershipInvoiceFailed(account, event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.deleted':
        await membershipSubscriptionDeleted(account, event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.updated': {
        // Keep renews_at honest (plan changes, pauses, resumed dunning).
        const sub = event.data.object as Stripe.Subscription;
        const periodEnd = sub.items.data[0]?.current_period_end;
        if (periodEnd) {
          await adminClient
            .from('membership_member')
            .update({ renews_at: new Date(periodEnd * 1000).toISOString(), updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', sub.id);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    // 500 → Stripe retries. Every handler above is idempotent (member
    // upsert converges, ledger keyed on invoice id, emails deduped).
    console.error('[membership/webhook] handler failed', event.type, e);
    return c.json({ error: 'handler failed' }, 500);
  }

  return c.json({ received: true });
});

// ===========================================================================
// Renewal scheduler — rides the server.ts 5-minute tick (the
// maybeSyncVatRates pattern: added alongside, never forked).
// ===========================================================================

const REMINDER_DAYS_BEFORE = 14;
const MANUAL_GRACE_DAYS = 14;

export async function runMembershipScheduler(): Promise<{ reminded: number; graced: number; lapsed: number }> {
  const now = Date.now();
  const out = { reminded: 0, graced: 0, lapsed: 0 };

  // 1 · Upcoming-renewal reminders (active members, renews_at within 14d).
  const windowEnd = new Date(now + REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000).toISOString();
  const { data: upcoming } = await adminClient
    .from('membership_member')
    .select('id, workspace_id, person_id, tier_id, renews_at, stripe_subscription_id')
    .eq('status', 'active')
    .not('renews_at', 'is', null)
    .gt('renews_at', new Date(now).toISOString())
    .lte('renews_at', windowEnd)
    .is('deleted_at', null);

  for (const m of upcoming ?? []) {
    // Dedup per renewal cycle: the date being warned about IS the cycle key.
    const periodRef = `renewal:${(m.renews_at as string).slice(0, 10)}`;
    const { error: dedupErr } = await adminClient
      .from('membership_reminder_send')
      .insert({ member_id: m.id, reminder_kind: 'renewal_upcoming', period_ref: periodRef });
    if (dedupErr) {
      if (dedupErr.code !== '23505') console.warn('[membership/scheduler] dedup failed', dedupErr);
      continue;
    }
    try {
      const [{ data: person }, { data: ws }, { data: tier }, brand] = await Promise.all([
        adminClient.from('person').select('first_name, email').eq('id', m.person_id).maybeSingle(),
        adminClient.from('workspace').select('name').eq('id', m.workspace_id).maybeSingle(),
        adminClient
          .from('membership_tier')
          .select('name, price_cents_year, price_cents_month, currency')
          .eq('id', m.tier_id)
          .maybeSingle(),
        getWorkspaceBrand(m.workspace_id),
      ]);
      if (!person?.email) continue;
      const msg = membershipRenewalReminder({
        name: person.first_name ?? 'there',
        communityName: ws?.name ?? 'the community',
        tierName: tier?.name ?? 'membership',
        renewsAt: m.renews_at as string,
        amountCents: tier?.price_cents_year ?? tier?.price_cents_month ?? null,
        currency: tier?.currency ?? 'EUR',
        brand: { logoUrl: brand.logoUrl, name: brand.fromName },
      });
      await sendEmail({
        to: person.email,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(brand.fromName ? { fromName: brand.fromName } : {}),
        ...(brand.fromAddress ? { fromAddress: brand.fromAddress } : {}),
        ...(brand.replyTo ? { replyTo: brand.replyTo } : {}),
      });
      out.reminded += 1;
    } catch (e) {
      console.warn('[membership/scheduler] reminder failed for member', m.id, e);
    }
  }

  // 2 · Manually-added members (no Stripe subscription — invoice/comped):
  // past renews_at → grace; 14 days past → lapsed. Stripe-backed members
  // move through the webhook instead, never here.
  const { data: overdue } = await adminClient
    .from('membership_member')
    .select('id, workspace_id, person_id, status, renews_at')
    .in('status', ['active', 'grace'])
    .is('stripe_subscription_id', null)
    .not('renews_at', 'is', null)
    .lt('renews_at', new Date(now).toISOString())
    .is('deleted_at', null);

  for (const m of overdue ?? []) {
    const renewsAtMs = new Date(m.renews_at as string).getTime();
    const pastGrace = now - renewsAtMs > MANUAL_GRACE_DAYS * 24 * 60 * 60 * 1000;
    if (m.status === 'active') {
      await adminClient
        .from('membership_member')
        .update({ status: 'grace', updated_at: new Date().toISOString() })
        .eq('id', m.id);
      await logMemberActivity(m.workspace_id, m.person_id, 'membership_payment_failed', 'Renewal overdue — grace period');
      out.graced += 1;
    } else if (pastGrace) {
      await adminClient
        .from('membership_member')
        .update({ status: 'lapsed', lapsed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', m.id);
      await logMemberActivity(m.workspace_id, m.person_id, 'membership_lapsed', 'Membership lapsed');
      await reconcileMemberAccess(m.id);
      out.lapsed += 1;
    }
  }

  // 3 · Drain the access journal (Circle invites / removals, Fibre seats).
  try {
    await runCircleAccessSync();
  } catch (e) {
    console.error('[membership/scheduler] circle sync failed', e);
  }
  try {
    await runFibreSeatSync();
  } catch (e) {
    console.error('[membership/scheduler] fibre-seat sync failed', e);
  }

  return out;
}
