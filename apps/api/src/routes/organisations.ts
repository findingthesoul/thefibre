import { Hono } from 'hono';
import { z } from 'zod';
import { userClient } from '../db.js';

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
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('organisation')
    .insert({ ...body.data, workspace_id: ctx.workspaceId })
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 500);
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
  city: z.string().max(100).nullable().optional(),
  region: z.string().max(100).nullable().optional(),
  country: z.string().length(2).nullable().optional(),
  sector: z.string().max(100).nullable().optional(),
  industry: z.string().max(100).nullable().optional(),
  org_type: z.enum(['private', 'public', 'ngo', 'cooperative', 'government', 'education']).nullable().optional(),
  size_band: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']).nullable().optional(),
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

// Apps-discovery: which apps have data on this org?
organisationsRoutes.get('/:id/apps', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const orgId = c.req.param('id');

  const [idQ, sysQ, relQ] = await Promise.all([
    db.from('org_identity').select('app:app_id (slug)').eq('org_id', orgId),
    db.from('org_system_context').select('app:app_id (slug)').eq('org_id', orgId),
    db.from('org_relationship').select('app:app_id (slug)').eq('org_id', orgId),
  ]);

  const slugs = new Set<string>();
  for (const q of [idQ, sysQ, relQ]) {
    for (const row of (q.data ?? []) as unknown as { app: { slug?: string } | { slug?: string }[] | null }[]) {
      const app = Array.isArray(row.app) ? row.app[0] : row.app;
      if (app?.slug) slugs.add(app.slug);
    }
  }
  return c.json({ apps: Array.from(slugs).sort() });
});
