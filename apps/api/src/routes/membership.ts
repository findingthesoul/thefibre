import { Hono } from 'hono';
import { z } from 'zod';
import { userClient, adminClient } from '../db.js';

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
});

// Grant kinds are a deploy-time vocabulary (like app-key scopes) — the DB
// deliberately has no CHECK so adding one here is enough.
const GrantKind = z.enum(['circle', 'thread']);
const CreateGrant = z.object({
  tier_id: z.string().uuid(),
  kind: GrantKind,
  // Non-secret targeting only ({space_id} / {thread_slug}). Credentials go
  // in membership_settings, service-role only.
  config: z.record(z.string(), z.unknown()).default({}),
});

const PutSettings = z.object({
  circle_api_token: z.string().max(500).optional().nullable(),
  circle_community_url: z.string().url().max(500).optional().nullable(),
  join_page: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(c: any, where: string, error: { message: string; code?: string; details?: string; hint?: string }) {
  console.error(`[membership] ${where}`, error);
  return c.json({ error: error.message, code: error.code }, 500);
}

// membership_settings is service-role-only (it holds the Circle token), so
// RLS can't gate it — check the role explicitly, the workspace_member way.
async function isWorkspaceAdmin(workspaceId: string, userId: string): Promise<boolean> {
  if (!userId) return false;
  const { data } = await adminClient
    .from('workspace_member')
    .select('workspace_role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  return data?.workspace_role === 'admin' || data?.workspace_role === 'super_admin';
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

  const { data: grants } = await adminClient
    .from('membership_access_grant')
    .select('id')
    .eq('tier_id', member.tier_id);

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
      if (!grantIds.includes(row.access_grant_id) && (row.status === 'granted' || row.status === 'pending')) {
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
      .eq('status', 'pending');
  }
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
    .select('id, person_id, tier_id, status, tier:tier_id (name)')
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
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Access grants
// ---------------------------------------------------------------------------

membershipRoutes.get('/grants', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_access_grant')
    .select('id, tier_id, kind, config, created_at, tier:tier_id (name)')
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
  return c.json({ id: data.id }, 201);
});

membershipRoutes.delete('/grants/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  // Grants aren't personal data — hard delete is fine; the journal rows
  // cascade. Members keep external access until a future sync sweep; v1
  // treats grant removal as configuration, not revocation.
  const { error } = await db.from('membership_access_grant').delete().eq('id', c.req.param('id'));
  if (error) return fail(c, 'delete grant', error);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Settings (service-role-only table — explicit admin check, token masked)
// ---------------------------------------------------------------------------

membershipRoutes.get('/settings', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isWorkspaceAdmin(ctx.workspaceId, ctx.userId))) {
    return c.json({ error: 'admin only' }, 403);
  }
  const { data, error } = await adminClient
    .from('membership_settings')
    .select('workspace_id, circle_api_token, circle_community_url, join_page, updated_at')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (error) return fail(c, 'get settings', error);
  return c.json({
    circle_community_url: data?.circle_community_url ?? null,
    // The token never leaves the API — only whether one is set.
    circle_api_token_set: Boolean(data?.circle_api_token),
    join_page: data?.join_page ?? {},
  });
});

membershipRoutes.put('/settings', async (c) => {
  const body = PutSettings.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  if (!(await isWorkspaceAdmin(ctx.workspaceId, ctx.userId))) {
    return c.json({ error: 'admin only' }, 403);
  }
  const row: Record<string, unknown> = { workspace_id: ctx.workspaceId, updated_at: new Date().toISOString() };
  if (body.data.circle_api_token !== undefined) row.circle_api_token = body.data.circle_api_token;
  if (body.data.circle_community_url !== undefined) row.circle_community_url = body.data.circle_community_url;
  if (body.data.join_page !== undefined) row.join_page = body.data.join_page;
  const { error } = await adminClient
    .from('membership_settings')
    .upsert(row, { onConflict: 'workspace_id' });
  if (error) return fail(c, 'put settings', error);
  return c.json({ ok: true });
});
