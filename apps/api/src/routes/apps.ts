// The app surface — registration, review, credentials, and the cross-app
// entity mapping endpoints apps use to:
//   * register themselves and be approved by an admin
//   * hold a key scoped to one workspace, with no user session present
//   * link their own records to platform persons / organisations / users
//   * look up a platform entity by their (app_record_id)
//   * declare/update the entity mappings in their manifest
//
// See docs/brief-external-apps.md, docs/third-party-app-guide.md and
// docs/cross-app-entity-mapping.md for the contract these implement.

import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { adminClient, userClient } from '../db.js';
import { invalidateAppSlugCache } from '../middleware/app-context.js';
import { APP_SCOPES, generateToken, partitionScopes } from '../lib/app-keys.js';
import { readManifestActivityTypes, readManifestScopes } from '../lib/app-manifest.js';
import { registerAppFlowRoutes } from './app-flow.js';

export const appsRoutes = new Hono();

const SLUG_RE = /^[a-z][a-z0-9-]{1,48}[a-z0-9]$/;

// Slugs the platform reserves for itself. The format check in the DB can't
// express this, and an app calling itself `fibre-platform` would be confusing
// at best.
const RESERVED_SLUGS = new Set(['fibre-platform', 'fibre', 'platform', 'admin', 'api']);

// ===========================================================================
// §1 — Registration and review.
//
// Registering an app used to be a schema migration against the platform
// database: drop the slug allow-list, insert, re-add it. That made the set of
// installable apps fixed at platform build time. Now it is a row with a
// lifecycle, reviewed the same way signup_request is.
// ===========================================================================

const RegisterBody = z.object({
  app_slug: z.string().regex(SLUG_RE, 'slug must be lowercase kebab-case, 3–50 chars'),
  app_name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  homepage_url: z.string().url().max(500).nullable().optional(),
  base_url: z.string().url().max(500).nullable().optional(),
  contact_email: z.string().email().toLowerCase(),
  scopes_requested: z.array(z.string().max(64)).max(20).optional(),
  manifest: z.record(z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// POST /api/v1/apps/register — public. An app registering itself has no
// credential yet, by definition. Lands a `pending` row; a super admin decides.
// ---------------------------------------------------------------------------
appsRoutes.post('/register', async (c) => {
  const body = RegisterBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const b = body.data;

  if (RESERVED_SLUGS.has(b.app_slug)) {
    return c.json({ error: `"${b.app_slug}" is reserved` }, 400);
  }

  const { data: existing } = await adminClient
    .from('app')
    .select('slug, status')
    .eq('slug', b.app_slug)
    .maybeSingle();
  if (existing) {
    // Re-submitting a pending registration is a no-op rather than an error —
    // an app retrying its install shouldn't have to special-case this.
    if (existing.status === 'pending') {
      return c.json({ ok: true, app_slug: b.app_slug, status: 'pending', already_registered: true });
    }
    return c.json({ error: `slug "${b.app_slug}" is already taken` }, 409);
  }

  const manifest = b.manifest ?? {
    app_slug: b.app_slug,
    app_name: b.app_name,
    scopes_requested: b.scopes_requested ?? [],
  };

  const { error } = await adminClient.from('app').insert({
    slug: b.app_slug,
    name: b.app_name,
    base_url: b.base_url ?? b.homepage_url ?? null,
    homepage_url: b.homepage_url ?? null,
    description: b.description ?? null,
    contact_email: b.contact_email,
    status: 'pending',
    kind: 'third_party',
    manifest,
    submitted_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === '23505') {
      return c.json({ error: `slug "${b.app_slug}" is already taken` }, 409);
    }
    console.error('[apps/register] insert failed', error);
    return c.json({ error: error.message }, 500);
  }

  return c.json(
    {
      ok: true,
      app_slug: b.app_slug,
      status: 'pending',
      next: 'A Fibre admin reviews the registration. Once approved, a workspace admin activates the app and mints a key.',
    },
    201,
  );
});

const APP_SELECT =
  'id, slug, name, base_url, homepage_url, description, contact_email, status, kind, manifest, owner_user_id, submitted_at, reviewed_at, reviewed_by, review_notes, created_at';

// ---------------------------------------------------------------------------
// GET /api/v1/apps — the catalogue. Super admins see every status; everyone
// else sees the approved ones (RLS says the same thing).
// ---------------------------------------------------------------------------
appsRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user') return c.json({ error: 'user session required' }, 403);
  const db = userClient(ctx.jwt);
  const status = c.req.query('status');

  let q = db.from('app').select(APP_SELECT).order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/apps/:slug — approve / suspend / reinstate. Super admin only.
//
// This is the gate the slug allow-list used to be: "has a human approved this
// app", administered rather than deployed.
// ---------------------------------------------------------------------------
const ReviewBody = z.object({
  action: z.enum(['approve', 'suspend', 'reinstate']),
  review_notes: z.string().max(2000).nullable().optional(),
});

appsRoutes.patch('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const body = ReviewBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const ctx = c.get('ctx');
  if (ctx.auth !== 'user') return c.json({ error: 'user session required' }, 403);

  const { data: me } = await adminClient
    .from('user')
    .select('is_super_admin')
    .eq('id', ctx.userId)
    .maybeSingle();
  if (!me?.is_super_admin) {
    return c.json({ error: 'super admin required' }, 403);
  }

  const { data: app } = await adminClient
    .from('app')
    .select('id, slug, kind, status')
    .eq('slug', slug)
    .maybeSingle();
  if (!app) return c.json({ error: 'unknown app' }, 404);
  if (app.kind === 'first_party' && body.data.action === 'suspend') {
    return c.json({ error: 'first-party apps cannot be suspended from here' }, 400);
  }

  const status = body.data.action === 'suspend' ? 'suspended' : 'approved';
  const { data: updated, error } = await adminClient
    .from('app')
    .update({
      status,
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
      review_notes: body.data.review_notes ?? null,
    })
    .eq('id', app.id)
    .select(APP_SELECT)
    .single();
  if (error) {
    console.error('[apps PATCH] review failed', error);
    return c.json({ error: error.message }, 500);
  }

  // The middleware caches approved slugs; a decision should bite immediately.
  invalidateAppSlugCache();

  // Suspending kills the app's keys implicitly (resolveAppKey checks status),
  // but deactivating it everywhere makes the state visible rather than silent.
  if (status === 'suspended') {
    await adminClient
      .from('workspace_app')
      .update({ deactivated_at: new Date().toISOString() })
      .eq('app_id', app.id)
      .is('deactivated_at', null);
  }

  return c.json({ ok: true, app: updated });
});

// ===========================================================================
// §2 — App keys. Minted by a workspace admin, scoped to (app × workspace).
// ===========================================================================

async function requireWorkspaceAdmin(ctx: { auth: string; userId: string; workspaceId: string }) {
  if (ctx.auth !== 'user') return 'user session required';
  const { data } = await adminClient
    .from('workspace_member')
    .select('workspace_role')
    .eq('user_id', ctx.userId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  const role = data?.workspace_role as string | undefined;
  if (role !== 'admin' && role !== 'super_admin') return 'workspace admin required';
  return null;
}

/** Resolve a slug to an app row the caller may act on. */
async function resolveApp(slug: string) {
  const { data } = await adminClient
    .from('app')
    .select('id, slug, name, status, manifest')
    .eq('slug', slug)
    .maybeSingle();
  return data;
}

// GET /api/v1/apps/whoami — an app verifying its own credential.
appsRoutes.get('/whoami', async (c) => {
  const ctx = c.get('ctx');
  return c.json({
    auth: ctx.auth,
    app_slug: ctx.appId,
    workspace_id: ctx.workspaceId,
    scopes: ctx.scopes,
  });
});

// GET /api/v1/apps/:slug/keys — list this workspace's keys for an app.
// Never returns a token: we only store its hash.
appsRoutes.get('/:slug/keys', async (c) => {
  const ctx = c.get('ctx');
  const denied = await requireWorkspaceAdmin(ctx);
  if (denied) return c.json({ error: denied }, 403);

  const app = await resolveApp(c.req.param('slug'));
  if (!app) return c.json({ error: 'unknown app' }, 404);

  const { data, error } = await adminClient
    .from('app_key')
    .select('id, name, token_prefix, scopes, created_at, created_by, last_used_at, revoked_at')
    .eq('app_id', app.id)
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});

// POST /api/v1/apps/:slug/keys — mint. The plaintext token is in this response
// and nowhere else, ever.
const MintBody = z.object({
  name: z.string().max(120).nullable().optional(),
  scopes: z.array(z.string().max(64)).min(1).max(20),
});

appsRoutes.post('/:slug/keys', async (c) => {
  const ctx = c.get('ctx');
  const denied = await requireWorkspaceAdmin(ctx);
  if (denied) return c.json({ error: denied }, 403);

  const body = MintBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const app = await resolveApp(c.req.param('slug'));
  if (!app) return c.json({ error: 'unknown app' }, 404);
  if (app.status !== 'approved') {
    return c.json({ error: `app "${app.slug}" is ${app.status}, not approved` }, 400);
  }

  // The app must be activated on this workspace — a key is a credential for a
  // relationship that exists, not a way to create one.
  const { data: activation } = await adminClient
    .from('workspace_app')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('app_id', app.id)
    .is('deactivated_at', null)
    .maybeSingle();
  if (!activation) {
    return c.json({ error: `"${app.slug}" is not activated on this workspace` }, 400);
  }

  const { valid, unknown } = partitionScopes(body.data.scopes);
  if (unknown.length) {
    return c.json(
      { error: `unknown scopes: ${unknown.join(', ')}`, known_scopes: APP_SCOPES },
      400,
    );
  }

  // A key can never carry more than the manifest asked for. This is what makes
  // scopes_requested load-bearing instead of decorative.
  const requested = readManifestScopes(app.manifest);
  if (requested) {
    const over = valid.filter((s) => !requested.includes(s));
    if (over.length) {
      return c.json(
        {
          error: `scopes not requested in ${app.slug}'s manifest: ${over.join(', ')}`,
          manifest_scopes: requested,
        },
        400,
      );
    }
  }

  const { token, prefix, hash } = generateToken();
  const { data: key, error } = await adminClient
    .from('app_key')
    .insert({
      app_id: app.id,
      workspace_id: ctx.workspaceId,
      name: body.data.name ?? null,
      token_prefix: prefix,
      token_hash: hash,
      scopes: valid,
      created_by: ctx.userId,
    })
    .select('id, name, token_prefix, scopes, created_at')
    .single();
  if (error) {
    console.error('[apps/keys POST] insert failed', error);
    return c.json({ error: error.message }, 500);
  }

  return c.json(
    {
      key,
      token,
      warning: 'Store this token now — it is not recoverable. Send it as Authorization: Bearer <token>.',
    },
    201,
  );
});

// DELETE /api/v1/apps/:slug/keys/:id — revoke.
appsRoutes.delete('/:slug/keys/:id', async (c) => {
  const ctx = c.get('ctx');
  const denied = await requireWorkspaceAdmin(ctx);
  if (denied) return c.json({ error: denied }, 403);

  const app = await resolveApp(c.req.param('slug'));
  if (!app) return c.json({ error: 'unknown app' }, 404);

  const { error } = await adminClient
    .from('app_key')
    .update({ revoked_at: new Date().toISOString(), revoked_by: ctx.userId })
    .eq('id', c.req.param('id'))
    .eq('app_id', app.id)
    .eq('workspace_id', ctx.workspaceId)
    .is('revoked_at', null);
  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

// ===========================================================================
// Manifest — declared entity mappings + activity types for this workspace.
// ===========================================================================

const ManifestBody = z.object({
  entity_mappings: z
    .array(
      z.object({
        app_entity: z.string().min(1).max(100),
        platform_entity: z.enum(['person', 'organisation', 'user', 'activity']),
        mapping_kind: z.enum(['identity', 'curator_data', 'reference']),
        match_on: z.array(z.string().max(64)).max(10).optional(),
        description: z.string().max(500).optional(),
      }),
    )
    .max(50)
    .optional(),
  activity_types: z
    .array(
      z.union([
        z.string().max(64),
        z.object({ type: z.string().max(64), subject: z.string().max(200).optional() }),
      ]),
    )
    .max(100)
    .optional(),
  scopes_requested: z.array(z.string().max(64)).max(20).optional(),
});

// ---------------------------------------------------------------------------
// PUT /api/v1/apps/:slug/manifest — install the manifest into this workspace.
// Writes app_entity_mapping rows and stores the declared activity types so
// POST /activities can validate against them.
// ---------------------------------------------------------------------------
appsRoutes.put('/:slug/manifest', async (c) => {
  const slug = c.req.param('slug');
  const body = ManifestBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');

  const app = await resolveApp(slug);
  if (!app) return c.json({ error: 'unknown app' }, 404);

  // A user must be a workspace admin; an app key acts for its own app only
  // (the middleware already checked the slug matches).
  if (ctx.auth === 'user') {
    const denied = await requireWorkspaceAdmin(ctx);
    if (denied) return c.json({ error: denied }, 403);
  }

  const mappings = body.data.entity_mappings ?? [];
  if (mappings.length) {
    const { error } = await adminClient.from('app_entity_mapping').upsert(
      mappings.map((m) => ({
        workspace_id: ctx.workspaceId,
        app_id: app.id,
        app_entity: m.app_entity,
        platform_entity: m.platform_entity,
        mapping_kind: m.mapping_kind,
        match_on: m.match_on ?? null,
      })),
      { onConflict: 'workspace_id,app_id,app_entity' },
    );
    if (error) {
      console.error('[apps/manifest PUT] mapping upsert failed', error);
      return c.json({ error: error.message }, 500);
    }
  }

  // Merge the declared activity types + scopes into the stored manifest.
  const stored = (app.manifest && typeof app.manifest === 'object' ? app.manifest : {}) as Record<
    string,
    unknown
  >;
  const nextManifest = {
    ...stored,
    ...(body.data.activity_types ? { activity_types: body.data.activity_types } : {}),
    ...(body.data.scopes_requested ? { scopes_requested: body.data.scopes_requested } : {}),
    ...(mappings.length ? { entity_mappings: mappings } : {}),
  };
  const { error: appErr } = await adminClient
    .from('app')
    .update({ manifest: nextManifest })
    .eq('id', app.id);
  if (appErr) {
    console.error('[apps/manifest PUT] app update failed', appErr);
    return c.json({ error: appErr.message }, 500);
  }

  return c.json({ ok: true, app_slug: slug, mappings_installed: mappings.length });
});

// ---------------------------------------------------------------------------
// GET /api/v1/apps/:slug/manifest — declared entity mappings for this app
// in the current workspace. Useful for admins reviewing what's installed.
// ---------------------------------------------------------------------------
appsRoutes.get('/:slug/manifest', async (c) => {
  const slug = c.req.param('slug');
  const ctx = c.get('ctx');

  const { data: app } = await adminClient
    .from('app')
    .select('id, name, slug, status, kind, manifest')
    .eq('slug', slug)
    .maybeSingle();
  if (!app) return c.json({ error: 'unknown app' }, 404);

  const { data: mappings } = await adminClient
    .from('app_entity_mapping')
    .select('app_entity, platform_entity, mapping_kind, match_on, registered_at')
    .eq('workspace_id', ctx.workspaceId)
    .eq('app_id', app.id)
    .order('app_entity', { ascending: true });

  return c.json({
    app: { id: app.id, slug: app.slug, name: app.name, status: app.status, kind: app.kind },
    mappings: mappings ?? [],
    activity_types: readManifestActivityTypes(app.manifest) ?? [],
  });
});

// ===========================================================================
// Record links — person AND organisation.
// ===========================================================================

const MatchOn = z.object({
  email: z.string().email().toLowerCase().optional(),
  name: z.string().max(200).optional(),
  domain: z.string().max(200).toLowerCase().optional(),
});

const LinkBody = z.object({
  app_entity: z.string().min(1).max(100),
  app_record_id: z.string().min(1).max(255),
  // Fields the app supplies to find / create the platform entity by.
  // Email is the primary key for persons; domain (then name) for orgs.
  match_on: MatchOn,
  // If create_if_missing=true and no entity matched, create one.
  create_if_missing: z.boolean().optional(),
});

type LinkInput = z.infer<typeof LinkBody>;
type LinkOutcome =
  | { ok: true; app_record_id: string; platform_id: string; platform_entity: string; action: 'linked' | 'created' }
  | { ok: false; app_record_id: string; error: string; status: number };

/**
 * One link. Shared by the single and bulk endpoints so the two can't drift —
 * the bulk endpoint is the same operation N times, not a second code path.
 */
async function linkOne(
  input: LinkInput,
  appId: string,
  appSlug: string,
  ctx: { workspaceId: string; userId: string; auth: string; scopes: readonly string[] | null },
): Promise<LinkOutcome> {
  const fail = (status: number, error: string): LinkOutcome => ({
    ok: false,
    app_record_id: input.app_record_id,
    error,
    status,
  });

  const { data: mapping } = await adminClient
    .from('app_entity_mapping')
    .select('platform_entity, mapping_kind, match_on')
    .eq('workspace_id', ctx.workspaceId)
    .eq('app_id', appId)
    .eq('app_entity', input.app_entity)
    .maybeSingle();
  if (!mapping) {
    return fail(400, `no entity mapping declared for ${appSlug}/${input.app_entity}`);
  }

  const target = mapping.platform_entity as string;
  if (target !== 'person' && target !== 'organisation') {
    return fail(400, `mapping targets "${target}"; only person and organisation can be linked here`);
  }

  // Scope check the route table couldn't make: it can't see the body, and the
  // target entity is a property of the declared mapping, not the URL.
  if (ctx.auth === 'app_key') {
    const needed = target === 'organisation' ? 'write:organisations' : 'write:persons';
    if (!(ctx.scopes ?? []).includes(needed)) {
      return fail(403, `this credential does not carry the "${needed}" scope`);
    }
  }

  const linkedBy = ctx.auth === 'user' && ctx.userId ? ctx.userId : null;
  let platformId: string;
  let action: 'linked' | 'created' = 'linked';

  if (target === 'person') {
    const email = input.match_on.email;
    if (!email) return fail(400, 'match_on.email is required for person mappings');

    const { data: person } = await adminClient
      .from('person')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('email', email)
      .is('deleted_at', null)
      .maybeSingle();

    if (person) {
      platformId = person.id as string;
    } else {
      if (!input.create_if_missing) {
        return fail(404, 'no matching person; pass create_if_missing=true to make one');
      }
      const parts = (input.match_on.name ?? '').trim().split(/\s+/).filter(Boolean);
      const { data: created, error } = await adminClient
        .from('person')
        .insert({
          workspace_id: ctx.workspaceId,
          email,
          first_name: parts[0] ?? null,
          last_name: parts.length > 1 ? parts.slice(1).join(' ') : null,
        })
        .select('id')
        .single();
      if (error || !created) {
        console.error('[apps/links] person create failed', error);
        return fail(500, error?.message ?? 'create failed');
      }
      platformId = created.id as string;
      action = 'created';
    }
  } else {
    // Organisation. Match on domain first (indexed, and the closest thing an
    // org has to a natural key), then fall back to an exact name match.
    const domain = input.match_on.domain;
    const name = input.match_on.name;
    if (!domain && !name) {
      return fail(400, 'match_on.domain or match_on.name is required for organisation mappings');
    }

    let org: { id: string } | null = null;
    if (domain) {
      const { data } = await adminClient
        .from('organisation')
        .select('id')
        .eq('workspace_id', ctx.workspaceId)
        .eq('domain', domain)
        .is('deleted_at', null)
        .maybeSingle();
      org = (data as { id: string } | null) ?? null;
    }
    if (!org && name) {
      const { data } = await adminClient
        .from('organisation')
        .select('id')
        .eq('workspace_id', ctx.workspaceId)
        .ilike('name', name)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();
      org = (data as { id: string } | null) ?? null;
    }

    if (org) {
      platformId = org.id;
    } else {
      if (!input.create_if_missing) {
        return fail(404, 'no matching organisation; pass create_if_missing=true to make one');
      }
      if (!name) {
        return fail(400, 'match_on.name is required to create an organisation');
      }
      const { data: created, error } = await adminClient
        .from('organisation')
        .insert({ workspace_id: ctx.workspaceId, name, domain: domain ?? null })
        .select('id')
        .single();
      if (error || !created) {
        console.error('[apps/links] organisation create failed', error);
        return fail(500, error?.message ?? 'create failed');
      }
      platformId = created.id as string;
      action = 'created';
    }
  }

  const { error: linkErr } = await adminClient.from('app_record_link').upsert(
    {
      workspace_id: ctx.workspaceId,
      app_id: appId,
      app_entity: input.app_entity,
      app_record_id: input.app_record_id,
      platform_entity: target,
      platform_id: platformId,
      linked_by: linkedBy,
    },
    { onConflict: 'workspace_id,app_id,app_entity,app_record_id' },
  );
  if (linkErr) {
    console.error('[apps/links] link insert failed', linkErr);
    return fail(500, linkErr.message);
  }

  return { ok: true, app_record_id: input.app_record_id, platform_id: platformId, platform_entity: target, action };
}

// ---------------------------------------------------------------------------
// POST /api/v1/apps/:slug/links — link one app record to a platform entity.
//
// Behaviour:
//   1. Look up an existing platform entity by `match_on` (email → person,
//      domain/name → organisation).
//   2. If found, record the link and return {platform_id, action:'linked'}.
//   3. If not found, optionally create the platform entity from the supplied
//      payload, then link. Returns {action:'created'}.
// ---------------------------------------------------------------------------
appsRoutes.post('/:slug/links', async (c) => {
  const slug = c.req.param('slug');
  const body = LinkBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');

  const app = await resolveApp(slug);
  if (!app) return c.json({ error: 'unknown app' }, 404);

  const result = await linkOne(body.data, app.id, app.slug, ctx);
  if (!result.ok) return c.json({ error: result.error }, result.status as 400 | 403 | 404 | 500);
  return c.json(
    { platform_id: result.platform_id, platform_entity: result.platform_entity, action: result.action },
    201,
  );
});

// ---------------------------------------------------------------------------
// POST /api/v1/apps/:slug/links:bulk — the same operation, N at a time.
//
// N parallel single POSTs works, but it isn't an integration story: a first
// sync of a few thousand records shouldn't be a few thousand round trips.
// Partial success is the honest result here, so every item reports its own
// outcome and the response is 207-shaped rather than all-or-nothing.
// ---------------------------------------------------------------------------
const BulkBody = z.object({ links: z.array(LinkBody).min(1).max(500) });

const bulkHandler = async (c: Context) => {
  const slug = c.req.param('slug') ?? '';
  const body = BulkBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');

  const app = await resolveApp(slug);
  if (!app) return c.json({ error: 'unknown app' }, 404);

  // Bounded concurrency: fast enough to matter, gentle enough on the pooler.
  const CONCURRENCY = 8;
  const inputs = body.data.links;
  const results: LinkOutcome[] = new Array(inputs.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, inputs.length) }, async () => {
      while (cursor < inputs.length) {
        const i = cursor++;
        results[i] = await linkOne(inputs[i]!, app.id, app.slug, ctx);
      }
    }),
  );

  const linked = results.filter((r) => r.ok).length;
  return c.json(
    {
      total: results.length,
      linked,
      failed: results.length - linked,
      results,
    },
    linked === results.length ? 201 : 207,
  );
};

// Both spellings route to the same handler: `links:bulk` is the custom-method
// form the brief specified, `links/bulk` the plain one. Neither is worth
// making a caller guess.
appsRoutes.post('/:slug/links:bulk', bulkHandler);
appsRoutes.post('/:slug/links/bulk', bulkHandler);

// ---------------------------------------------------------------------------
// GET /api/v1/apps/:slug/links/:app_entity/:app_record_id — reverse lookup.
// Returns the platform entity an app record is linked to.
// ---------------------------------------------------------------------------
appsRoutes.get('/:slug/links/:app_entity/:app_record_id', async (c) => {
  const slug = c.req.param('slug');
  const appEntity = c.req.param('app_entity');
  const appRecordId = c.req.param('app_record_id');
  const ctx = c.get('ctx');

  const app = await resolveApp(slug);
  if (!app) return c.json({ error: 'unknown app' }, 404);

  const { data: link } = await adminClient
    .from('app_record_link')
    .select('platform_entity, platform_id, linked_at')
    .eq('workspace_id', ctx.workspaceId)
    .eq('app_id', app.id)
    .eq('app_entity', appEntity)
    .eq('app_record_id', appRecordId)
    .maybeSingle();
  if (!link) return c.json({ error: 'no link found' }, 404);
  return c.json(link);
});

// ---------------------------------------------------------------------------
// GET /api/v1/apps/:slug/persons/:app_entity/:app_record_id
// GET /api/v1/apps/:slug/organisations/:app_entity/:app_record_id
// The full platform row behind an app link. Convenience over the reverse-lookup
// endpoint plus a separate fetch.
// ---------------------------------------------------------------------------
function makeResolver(table: 'person' | 'organisation') {
  return async (c: Context) => {
    const slug = c.req.param('slug') ?? '';
    const appEntity = c.req.param('app_entity') ?? '';
    const appRecordId = c.req.param('app_record_id') ?? '';
    const ctx = c.get('ctx');

    const app = await resolveApp(slug);
    if (!app) return c.json({ error: 'unknown app' }, 404);

    const { data: link } = await adminClient
      .from('app_record_link')
      .select('platform_entity, platform_id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('app_id', app.id)
      .eq('app_entity', appEntity)
      .eq('app_record_id', appRecordId)
      .maybeSingle();
    if (!link || link.platform_entity !== table) {
      return c.json({ error: `no ${table} link` }, 404);
    }
    const { data: row } = await adminClient
      .from(table)
      .select('*')
      .eq('id', link.platform_id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle();
    if (!row) return c.json({ error: `${table} not found` }, 404);
    return c.json(row);
  };
}

appsRoutes.get('/:slug/persons/:app_entity/:app_record_id', makeResolver('person'));
appsRoutes.get('/:slug/organisations/:app_entity/:app_record_id', makeResolver('organisation'));

// ===========================================================================
// §6 — Flow, consumed by an app key. Lives in its own file; the surface is
// large enough and the rules it enforces are specific to it.
// ===========================================================================
registerAppFlowRoutes(appsRoutes);
