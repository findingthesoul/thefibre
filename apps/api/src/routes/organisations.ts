import { Hono } from 'hono';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { promises as dns } from 'node:dns';
import { userClient, adminClient } from '../db.js';

export const organisationsRoutes = new Hono();

const ListQuery = z.object({
  after: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().min(1).max(100).optional(),
});

organisationsRoutes.get('/', async (c) => {
  const parsed = ListQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { after, limit, q } = parsed.data;

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  let query = db
    .from('organisation')
    .select('id, name, domain, country, sector, org_type, created_at')
    .is('deleted_at', null)
    .order('id', { ascending: true })
    .limit(limit + 1);

  if (after) query = query.gt('id', after);
  if (q) query = query.or(`name.ilike.%${q}%,domain.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return c.json({ items, next: hasMore ? items[items.length - 1]?.id : null });
});

const OrgCreate = z.object({
  name: z.string().min(1).max(200),
  domain: z.string().max(255).optional(),
  country: z.string().length(2).optional(),
  sector: z.string().max(100).optional(),
  org_type: z.enum(['private', 'public', 'ngo', 'cooperative', 'government', 'education']).optional(),
});

organisationsRoutes.post('/', async (c) => {
  const body = OrgCreate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');

  // Create via adminClient with explicit workspace scoping — see the note
  // in persons.ts POST (same fix, 2026-07-08): insert-through-RLS failed
  // on the returning read even for admins; membership is guaranteed by
  // the middleware and reads stay RLS-gated.
  const { data, error } = await adminClient
    .from('organisation')
    .insert({ ...body.data, workspace_id: ctx.workspaceId })
    .select('*')
    .single();
  if (error) {
    console.error('[organisations POST] insert failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return c.json({ error: error.message, code: error.code }, 500);
  }
  return c.json(data, 201);
});

organisationsRoutes.get('/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('organisation')
    .select('*, org_identity(*), org_system_context(*), org_relationship(*)')
    .eq('id', c.req.param('id'))
    .is('deleted_at', null)
    .single();
  if (error) return c.json({ error: error.message }, 404);
  return c.json(data);
});

const OrgUpdate = z.object({
  name: z.string().min(1).max(200).optional(),
  legal_name: z.string().max(200).nullable().optional(),
  domain: z.string().max(255).nullable().optional(),
  // Accept any string (display layer prepends https://). Brief intent was a URL
  // but strict .url() validation rejects "thefibre.app" — bad UX.
  website: z.string().max(500).nullable().optional(),
  linkedin_url: z.string().max(500).nullable().optional(),
  vat_number: z.string().max(50).nullable().optional(),
  street: z.string().max(200).nullable().optional(),
  postal_code: z.string().max(20).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  region: z.string().max(100).nullable().optional(),
  country: z.string().length(2).nullable().optional(),
  sector: z.string().max(100).nullable().optional(),
  industry: z.string().max(100).nullable().optional(),
  org_type: z.enum(['private', 'public', 'ngo', 'cooperative', 'government', 'education']).nullable().optional(),
  size_band: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']).nullable().optional(),
  logo_url: z.string().max(2000).nullable().optional(),
});

organisationsRoutes.patch('/:id', async (c) => {
  const body = OrgUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('organisation')
    .update(body.data)
    .eq('id', c.req.param('id'))
    .is('deleted_at', null)
    .select('*')
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

organisationsRoutes.delete('/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  // Soft delete — brief §13.3.
  const { error } = await db
    .from('organisation')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .is('deleted_at', null);

  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

organisationsRoutes.get('/:id/members', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('org_membership')
    .select('id, title, department, is_primary, is_decision_maker, started_at, ended_at, person:person_id (id, first_name, last_name, email)')
    .eq('org_id', c.req.param('id'))
    .is('ended_at', null);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});

const MemberCreate = z.object({
  person_id: z.string().uuid(),
  title: z.string().max(200).nullable().optional(),
  department: z.string().max(200).nullable().optional(),
  employment_type: z.enum(['permanent', 'interim', 'consultant', 'board', 'volunteer']).nullable().optional(),
  influence_level: z.enum(['formal', 'informal', 'both']).nullable().optional(),
  is_primary: z.boolean().optional(),
  is_decision_maker: z.boolean().optional(),
  is_budget_holder: z.boolean().optional(),
  is_champion: z.boolean().optional(),
  started_at: z.string().date().nullable().optional(),
});

organisationsRoutes.post('/:id/members', async (c) => {
  const body = MemberCreate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('org_membership')
    .insert({ org_id: c.req.param('id'), ...body.data })
    .select('id')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

// End an active membership by stamping ended_at. We never hard-delete —
// historical context is part of the contact graph (brief §5.D3).
organisationsRoutes.post('/members/:membership_id/end', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { error } = await db
    .from('org_membership')
    .update({ ended_at: new Date().toISOString().slice(0, 10) })
    .eq('id', c.req.param('membership_id'))
    .is('ended_at', null);
  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

// ============================================================================
// Profile sub-resources — one row per organisation each.
// Same upsert-on-PATCH pattern as person profile tabs.
// ============================================================================

async function upsertOrgProfile<T extends Record<string, unknown>>(
  c: import('hono').Context,
  table: string,
  appSlug: 'fibre-platform' | 'fibre-meet' | 'the-thread' | 'fibre-sales' | 'fibre-learn',
  body: T,
) {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const orgId = c.req.param('id');

  const { data: org, error: oErr } = await db
    .from('organisation')
    .select('id')
    .eq('id', orgId)
    .is('deleted_at', null)
    .single();
  if (oErr || !org) {
    console.error('[upsertOrgProfile] org not found', { table, orgId, oErr });
    return c.json({ error: 'organisation not found' }, 404);
  }

  // Resolve the owning app's uuid. RLS gates by app_id since v0.4.
  const { data: app, error: aErr } = await db
    .from('app')
    .select('id')
    .eq('slug', appSlug)
    .single();
  if (aErr || !app) {
    console.error('[upsertOrgProfile] app not found', { table, appSlug, aErr });
    return c.json({ error: `app not found: ${appSlug}` }, 500);
  }

  const { data, error } = await db
    .from(table)
    .upsert({ org_id: orgId, app_id: app.id, ...body }, { onConflict: 'org_id' })
    .select('*')
    .single();

  if (error) {
    console.error('[upsertOrgProfile] upsert failed', { table, orgId, appSlug, body, error });
    return c.json({ error: error.message, code: error.code, details: error.details, hint: error.hint }, 500);
  }
  return c.json(data);
}

async function getOrgProfile(c: import('hono').Context, table: string) {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from(table)
    .select('*')
    .eq('org_id', c.req.param('id'))
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? null);
}

// --- org_identity ----------------------------------------------------------
const GOVERNANCE = ['hierarchical', 'flat', 'matrix', 'holacracy', 'cooperative'] as const;
const OWNERSHIP = ['private', 'public', 'family', 'employee', 'state', 'ngo'] as const;
const DECISION_STYLE = ['top_down', 'consultative', 'consensus', 'delegated'] as const;
const MATURITY = ['startup', 'growth', 'established', 'legacy', 'transitioning'] as const;

const IdentityUpdate = z.object({
  mission_statement: z.string().max(2000).nullable().optional(),
  vision_statement: z.string().max(2000).nullable().optional(),
  stated_values: z.array(z.string().max(100)).nullable().optional(),
  cultural_descriptors: z.array(z.string().max(100)).nullable().optional(),
  governance_model: z.enum(GOVERNANCE).nullable().optional(),
  ownership_type: z.enum(OWNERSHIP).nullable().optional(),
  decision_making_style: z.enum(DECISION_STYLE).nullable().optional(),
  languages_of_operation: z.array(z.string().max(50)).nullable().optional(),
  maturity_stage: z.enum(MATURITY).nullable().optional(),
  identity_notes: z.string().max(5000).nullable().optional(),
});

organisationsRoutes.get('/:id/identity', (c) => getOrgProfile(c, 'org_identity'));
organisationsRoutes.patch('/:id/identity', async (c) => {
  const body = IdentityUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  return upsertOrgProfile(c, 'org_identity', 'fibre-platform', body.data);
});

// --- org_system_context (political_landscape is sensitive — brief §5.D3) --
const TRANSFORMATION_STAGE = ['pre_awareness', 'exploring', 'committed', 'in_programme', 'sustaining', 'alumni'] as const;
const LEADERSHIP_STABILITY = ['stable', 'transitioning', 'turbulent'] as const;
const CHANGE_READINESS = ['not_ready', 'cautious', 'open', 'ready', 'driving'] as const;

const SystemContextUpdate = z.object({
  transformation_stage: z.enum(TRANSFORMATION_STAGE).nullable().optional(),
  active_change_themes: z.array(z.string().max(100)).nullable().optional(),
  structural_tensions: z.array(z.string().max(200)).nullable().optional(),
  strategic_priorities: z.string().max(2000).nullable().optional(),
  current_challenges: z.string().max(2000).nullable().optional(),
  political_landscape: z.string().max(5000).nullable().optional(),
  leadership_stability: z.enum(LEADERSHIP_STABILITY).nullable().optional(),
  change_readiness: z.enum(CHANGE_READINESS).nullable().optional(),
  previous_interventions: z.array(z.string().max(200)).nullable().optional(),
  lessons_from_previous_work: z.string().max(2000).nullable().optional(),
  blockers: z.array(z.string().max(200)).nullable().optional(),
  enablers: z.array(z.string().max(200)).nullable().optional(),
});

organisationsRoutes.get('/:id/system-context', (c) => getOrgProfile(c, 'org_system_context'));
organisationsRoutes.patch('/:id/system-context', async (c) => {
  const body = SystemContextUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  return upsertOrgProfile(c, 'org_system_context', 'fibre-meet', {
    ...body.data,
    notes_updated_at: new Date().toISOString(),
    notes_updated_by: ctx.userId,
  });
});

// --- org_relationship ------------------------------------------------------
const RELATIONSHIP_STAGE = ['prospect', 'engaged', 'active_client', 'alumni', 'dormant', 'lost'] as const;
const HEALTH_STATUS = ['active', 'at_risk', 'dormant', 'lost', 'never_converted'] as const;
const ENGAGEMENT_TYPE = ['facilitation', 'learning', 'advisory', 'speaking', 'mixed'] as const;

const OrgRelationshipUpdate = z.object({
  primary_owner: z.string().uuid().nullable().optional(),
  secondary_owner: z.string().uuid().nullable().optional(),
  relationship_stage: z.enum(RELATIONSHIP_STAGE).nullable().optional(),
  health_status: z.enum(HEALTH_STATUS).nullable().optional(),
  engagement_type: z.enum(ENGAGEMENT_TYPE).nullable().optional(),
  programmes_completed: z.array(z.string().max(200)).nullable().optional(),
  total_participants_reached: z.number().int().min(0).nullable().optional(),
  touchpoints_count: z.number().int().min(0).nullable().optional(),
  relationship_history: z.string().max(5000).nullable().optional(),
  next_opportunity: z.string().max(1000).nullable().optional(),
  last_touchpoint_at: z.string().date().nullable().optional(),
  next_planned_contact: z.string().date().nullable().optional(),
});

organisationsRoutes.get('/:id/relationship', (c) => getOrgProfile(c, 'org_relationship'));
organisationsRoutes.patch('/:id/relationship', async (c) => {
  const body = OrgRelationshipUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  return upsertOrgProfile(c, 'org_relationship', 'fibre-sales', body.data);
});

// --- org_billing (fibre-sales) ---------------------------------------------
const OrgBillingUpdate = z.object({
  legal_name: z.string().max(200).nullable().optional(),
  tax_id: z.string().max(50).nullable().optional(),
  billing_email: z.string().email().nullable().optional(),
  billing_street: z.string().max(200).nullable().optional(),
  billing_postal_code: z.string().max(20).nullable().optional(),
  billing_city: z.string().max(100).nullable().optional(),
  billing_region: z.string().max(100).nullable().optional(),
  billing_country: z.string().length(2).nullable().optional(),
  payment_terms_days: z.number().int().min(0).max(365).nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  po_required: z.boolean().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

organisationsRoutes.get('/:id/billing', (c) => getOrgProfile(c, 'org_billing'));
organisationsRoutes.patch('/:id/billing', async (c) => {
  const body = OrgBillingUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  return upsertOrgProfile(c, 'org_billing', 'fibre-sales', {
    ...body.data,
    updated_at: new Date().toISOString(),
  });
});

// Apps-discovery: which apps have data on this org?
organisationsRoutes.get('/:id/apps', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const orgId = c.req.param('id');

  const [idQ, sysQ, relQ, billQ] = await Promise.all([
    db.from('org_identity').select('app:app_id (slug)').eq('org_id', orgId),
    db.from('org_system_context').select('app:app_id (slug)').eq('org_id', orgId),
    db.from('org_relationship').select('app:app_id (slug)').eq('org_id', orgId),
    db.from('org_billing').select('app:app_id (slug)').eq('org_id', orgId),
  ]);

  const slugs = new Set<string>();
  for (const q of [idQ, sysQ, relQ, billQ]) {
    for (const row of (q.data ?? []) as unknown as { app: { slug?: string } | { slug?: string }[] | null }[]) {
      const app = Array.isArray(row.app) ? row.app[0] : row.app;
      if (app?.slug) slugs.add(app.slug);
    }
  }
  return c.json({ apps: Array.from(slugs).sort() });
});

// ===========================================================================
// Domain verification — TXT-challenge ownership proof.
//
// Flow:
//   1. Caller GETs /:id/domain-verification — returns existing challenge if
//      any, else null.
//   2. Caller POSTs /:id/domain-verification — generates (or rotates) a
//      challenge, returns { record_name, record_value }. UI shows these to
//      the user. User adds the TXT record to their DNS.
//   3. Caller POSTs /:id/domain-verification/check — server does
//      dns.resolveTxt(`_fibre-verify.<domain>`) and compares verbatim with
//      the stored challenge. On match: stamps domain_verified_at on the org
//      and verified_at on the challenge row, returns { verified: true }.
//
// The record lives under `_fibre-verify.<domain>` (not the root) so it
// doesn't clutter the org's apex TXT records (SPF/DKIM/etc) and is namespaced
// to us if multiple verification systems share the same DNS zone.
// ===========================================================================

const CHALLENGE_PREFIX = 'fibre-verify-';
const CHALLENGE_HOST = '_fibre-verify';

function newChallenge(): string {
  return CHALLENGE_PREFIX + randomBytes(24).toString('base64url');
}

organisationsRoutes.get('/:id/domain-verification', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const orgId = c.req.param('id');

  // Pull the org so we can return the current `domain` + `domain_verified_at`
  // alongside the challenge — saves the UI one round-trip.
  const { data: org, error: orgErr } = await db
    .from('organisation')
    .select('id, domain, domain_verified_at')
    .eq('id', orgId)
    .is('deleted_at', null)
    .single();
  if (orgErr || !org) return c.json({ error: 'org not found' }, 404);

  const { data: row } = await db
    .from('org_domain_verification')
    .select('domain, challenge, created_at, verified_at')
    .eq('org_id', orgId)
    .maybeSingle();

  return c.json({
    domain: org.domain,
    domain_verified_at: org.domain_verified_at,
    challenge: row && row.domain === org.domain
      ? {
          record_name: `${CHALLENGE_HOST}.${row.domain}`,
          record_value: row.challenge,
          created_at: row.created_at,
          verified_at: row.verified_at,
        }
      : null,
  });
});

organisationsRoutes.post('/:id/domain-verification', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const orgId = c.req.param('id');

  const { data: org, error: orgErr } = await db
    .from('organisation')
    .select('id, domain')
    .eq('id', orgId)
    .is('deleted_at', null)
    .single();
  if (orgErr || !org) return c.json({ error: 'org not found' }, 404);
  if (!org.domain || !org.domain.trim()) {
    return c.json(
      { error: 'org has no domain set — add one on the edit form first' },
      400,
    );
  }

  const challenge = newChallenge();
  const { error } = await db
    .from('org_domain_verification')
    .upsert(
      {
        org_id: orgId,
        workspace_id: ctx.workspaceId,
        domain: org.domain,
        challenge,
        created_at: new Date().toISOString(),
        verified_at: null,
      },
      { onConflict: 'org_id' },
    );
  if (error) {
    console.error('[org domain-verification] upsert failed', error);
    return c.json({ error: error.message }, 500);
  }

  return c.json({
    record_name: `${CHALLENGE_HOST}.${org.domain}`,
    record_value: challenge,
  });
});

organisationsRoutes.post('/:id/domain-verification/check', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const orgId = c.req.param('id');

  const { data: row, error: rowErr } = await db
    .from('org_domain_verification')
    .select('domain, challenge')
    .eq('org_id', orgId)
    .single();
  if (rowErr || !row) {
    return c.json(
      { verified: false, error: 'no challenge issued — call POST first' },
      400,
    );
  }

  const host = `${CHALLENGE_HOST}.${row.domain}`;
  let txtRecords: string[][] = [];
  try {
    // dns.resolveTxt returns string[][] — one record can be split into
    // multiple chunks; we join each record's chunks before compare.
    txtRecords = await dns.resolveTxt(host);
  } catch (e) {
    const code = (e as { code?: string }).code ?? 'unknown';
    return c.json({
      verified: false,
      error: `DNS lookup failed: ${code}`,
      record_name: host,
      record_value: row.challenge,
    });
  }

  const flat = txtRecords.map((parts) => parts.join(''));
  const matched = flat.some((v) => v.trim() === row.challenge);
  if (!matched) {
    return c.json({
      verified: false,
      error: 'TXT record found but value did not match',
      record_name: host,
      record_value: row.challenge,
      found: flat,
    });
  }

  const now = new Date().toISOString();
  // Stamp both rows: the challenge for audit, and the org for the live
  // "verified" badge.
  await db
    .from('org_domain_verification')
    .update({ verified_at: now })
    .eq('org_id', orgId);
  await db
    .from('organisation')
    .update({ domain_verified_at: now })
    .eq('id', orgId);

  return c.json({ verified: true, verified_at: now });
});

// ===========================================================================
// Backfill: snap existing persons to a verified-domain org.
//
// New persons are auto-linked on POST /persons (see persons.ts). This
// endpoint handles the back-population case: an org's domain was just
// verified, and several persons with @<domain> emails already exist in
// the workspace without an org_membership for that org.
//
// We add a membership row for each match that doesn't already have one.
// is_primary is set only when the person has *no other* primary org
// (single-org common case); we don't fight existing primaries.
// ===========================================================================

organisationsRoutes.post('/:id/domain-verification/backfill', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const orgId = c.req.param('id');

  const { data: org, error: orgErr } = await db
    .from('organisation')
    .select('id, name, domain, domain_verified_at')
    .eq('id', orgId)
    .is('deleted_at', null)
    .single();
  if (orgErr || !org) return c.json({ error: 'org not found' }, 404);
  if (!org.domain_verified_at) {
    return c.json(
      { error: 'org domain is not verified — run /check first' },
      400,
    );
  }
  if (!org.domain) return c.json({ error: 'org has no domain' }, 400);

  // Find candidate persons: same workspace, email ends with @<domain>,
  // not soft-deleted, and not already linked to this org.
  const domain = org.domain.toLowerCase();
  const { data: candidates, error: candErr } = await db
    .from('person')
    .select('id, email')
    .eq('workspace_id', ctx.workspaceId)
    .is('deleted_at', null)
    .ilike('email', `%@${domain}`);
  if (candErr) return c.json({ error: candErr.message }, 500);

  if (!candidates || candidates.length === 0) {
    return c.json({ linked: 0, skipped: 0, total: 0 });
  }

  // Existing memberships for this org so we don't double-insert.
  const candidateIds = candidates.map((p) => p.id);
  const { data: existing } = await db
    .from('org_membership')
    .select('person_id')
    .eq('org_id', orgId)
    .in('person_id', candidateIds);
  const linkedSet = new Set((existing ?? []).map((r) => r.person_id));

  // Which candidates already have *any* primary org? Those we link as
  // non-primary so we don't fight existing curation.
  const toLink = candidates.filter((p) => !linkedSet.has(p.id));
  if (toLink.length === 0) {
    return c.json({ linked: 0, skipped: candidates.length, total: candidates.length });
  }

  const { data: primaries } = await db
    .from('org_membership')
    .select('person_id')
    .in('person_id', toLink.map((p) => p.id))
    .is('ended_at', null)
    .eq('is_primary', true);
  const hasPrimary = new Set((primaries ?? []).map((r) => r.person_id));

  const today = new Date().toISOString().slice(0, 10);
  const rows = toLink.map((p) => ({
    person_id: p.id,
    org_id: orgId,
    is_primary: !hasPrimary.has(p.id),
    started_at: today,
  }));

  const { error: insErr } = await db.from('org_membership').insert(rows);
  if (insErr) {
    console.error('[org backfill] insert failed', insErr);
    return c.json({ error: insErr.message }, 500);
  }

  // Audit activity rows — one per linked person, batched insert.
  const { data: platformApp } = await db
    .from('app')
    .select('id')
    .eq('slug', 'fibre-platform')
    .single();
  if (platformApp) {
    const acts = toLink.map((p) => ({
      workspace_id: ctx.workspaceId,
      person_id: p.id,
      app_id: platformApp.id,
      type: 'user_created' as const,
      subject: `Backfill: linked to ${org.name} (verified domain ${domain})`,
      created_by: ctx.userId,
    }));
    await db.from('activity').insert(acts);
  }

  return c.json({
    linked: toLink.length,
    skipped: candidates.length - toLink.length,
    total: candidates.length,
  });
});
