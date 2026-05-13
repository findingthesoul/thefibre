import { Hono } from 'hono';
import { z } from 'zod';
import { userClient } from '../db.js';

export const personsRoutes = new Hono();

const ListQuery = z.object({
  after: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().min(1).max(100).optional(),
});

personsRoutes.get('/', async (c) => {
  const parsed = ListQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { after, limit, q } = parsed.data;

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  let query = db
    .from('person')
    .select('id, first_name, last_name, email, country, created_at')
    .is('deleted_at', null)
    .order('id', { ascending: true })
    .limit(limit + 1);

  if (after) query = query.gt('id', after);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return c.json({
    items,
    next: hasMore ? items[items.length - 1]?.id : null,
  });
});

const PersonCreate = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email(),
  preferred_name: z.string().max(100).optional(),
  country: z.string().length(2).optional(),
});

personsRoutes.post('/', async (c) => {
  const body = PersonCreate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('person')
    .insert({ ...body.data, workspace_id: ctx.workspaceId })
    .select('id, first_name, last_name, email, country, created_at')
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // Write a platform activity event. Non-fatal if it fails.
  const { data: platformApp } = await db
    .from('app')
    .select('id')
    .eq('slug', 'fibre-platform')
    .single();
  if (platformApp) {
    const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || data.email;
    await db.from('activity').insert({
      workspace_id: ctx.workspaceId,
      person_id: data.id,
      app_id: platformApp.id,
      type: 'user_created',
      subject: `Added ${name} to the workspace`,
      created_by: ctx.userId,
    });
  }

  return c.json(data, 201);
});

personsRoutes.get('/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('person')
    .select('*')
    .eq('id', c.req.param('id'))
    .is('deleted_at', null)
    .single();
  if (error) return c.json({ error: error.message }, 404);
  return c.json(data);
});

const PersonUpdate = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  preferred_name: z.string().max(100).nullable().optional(),
  pronouns: z.string().max(50).nullable().optional(),
  email: z.string().email().optional(),
  email_secondary: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  // Accept any string; display layer prepends https:// if needed.
  linkedin_url: z.string().max(500).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  region: z.string().max(100).nullable().optional(),
  country: z.string().length(2).nullable().optional(),
  preferred_language: z.string().max(10).nullable().optional(),
});

personsRoutes.patch('/:id', async (c) => {
  const body = PersonUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('person')
    .update(body.data)
    .eq('id', c.req.param('id'))
    .is('deleted_at', null)
    .select('*')
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

personsRoutes.delete('/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  // Soft delete only — brief §13.3.
  const { error } = await db
    .from('person')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .is('deleted_at', null);

  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

// ============================================================================
// Profile sub-resources — one row per person each.
// All four use the same upsert-on-PATCH pattern: if no row exists, create one;
// otherwise update. GET returns the row or null.
// ============================================================================

async function upsertProfile<T extends Record<string, unknown>>(
  c: import('hono').Context,
  table: string,
  body: T,
) {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const personId = c.req.param('id');

  // Confirm the person exists in this workspace (RLS already enforces, but
  // gives us a clean 404 if not).
  const { data: person, error: pErr } = await db
    .from('person')
    .select('id')
    .eq('id', personId)
    .is('deleted_at', null)
    .single();
  if (pErr || !person) {
    console.error('[upsertProfile] person not found', { table, personId, pErr });
    return c.json({ error: 'person not found' }, 404);
  }

  const { data, error } = await db
    .from(table)
    .upsert({ person_id: personId, ...body }, { onConflict: 'person_id' })
    .select('*')
    .single();

  if (error) {
    console.error('[upsertProfile] upsert failed', { table, personId, body, error });
    return c.json({ error: error.message, code: error.code, details: error.details, hint: error.hint }, 500);
  }
  return c.json(data);
}

async function getProfile(c: import('hono').Context, table: string) {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from(table)
    .select('*')
    .eq('person_id', c.req.param('id'))
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? null);
}

// --- person_professional ---------------------------------------------------
const SENIORITY = ['junior', 'mid', 'senior', 'lead', 'executive', 'board'] as const;
const CAREER_STAGE = ['early', 'established', 'senior', 'transitioning', 'portfolio'] as const;

const ProfessionalUpdate = z.object({
  current_title: z.string().max(200).nullable().optional(),
  current_department: z.string().max(200).nullable().optional(),
  seniority_level: z.enum(SENIORITY).nullable().optional(),
  sector: z.string().max(200).nullable().optional(),
  expertise_areas: z.array(z.string().max(100)).nullable().optional(),
  industries_worked_in: z.array(z.string().max(100)).nullable().optional(),
  years_of_experience: z.number().int().min(0).max(80).nullable().optional(),
  career_stage: z.enum(CAREER_STAGE).nullable().optional(),
  is_independent: z.boolean().nullable().optional(),
  certifications: z.array(z.string().max(200)).nullable().optional(),
  spoken_at_events: z.array(z.string().max(200)).nullable().optional(),
});

personsRoutes.get('/:id/professional', (c) => getProfile(c, 'person_professional'));
personsRoutes.patch('/:id/professional', async (c) => {
  const body = ProfessionalUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  return upsertProfile(c, 'person_professional', body.data);
});

// --- person_relationship_context -------------------------------------------
const REL_SOURCE = ['event_attendee', 'referral', 'cold_outreach', 'client_contact', 'inbound'] as const;
const REL_STRENGTH = ['weak', 'warm', 'strong', 'advocate'] as const;
const REL_COMM = ['email', 'phone', 'linkedin', 'in_person'] as const;

const RelationshipUpdate = z.object({
  source: z.enum(REL_SOURCE).nullable().optional(),
  source_detail: z.string().max(500).nullable().optional(),
  introduced_by: z.string().uuid().nullable().optional(),
  relationship_strength: z.enum(REL_STRENGTH).nullable().optional(),
  communication_preference: z.enum(REL_COMM).nullable().optional(),
  best_time_to_reach: z.string().max(200).nullable().optional(),
  is_key_contact: z.boolean().nullable().optional(),
  is_ambassador: z.boolean().nullable().optional(),
  first_contact_notes: z.string().max(2000).nullable().optional(),
  first_contact_at: z.string().datetime().nullable().optional(),
});

personsRoutes.get('/:id/relationship', (c) => getProfile(c, 'person_relationship_context'));
personsRoutes.patch('/:id/relationship', async (c) => {
  const body = RelationshipUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  return upsertProfile(c, 'person_relationship_context', body.data);
});

// --- person_change_context (facilitator_notes is sensitive — brief §5.D2) --
const CHANGE_ROLE = ['sponsor', 'champion', 'implementer', 'sceptic', 'bystander', 'gatekeeper'] as const;
const CHANGE_STANCE = ['driving', 'supporting', 'ambivalent', 'resistant'] as const;
const READINESS = ['not_ready', 'cautious', 'open', 'ready', 'driving'] as const;

const ChangeUpdate = z.object({
  role_in_change: z.enum(CHANGE_ROLE).nullable().optional(),
  stance_on_change: z.enum(CHANGE_STANCE).nullable().optional(),
  change_themes: z.array(z.string().max(100)).nullable().optional(),
  leadership_style: z.string().max(200).nullable().optional(),
  blockers: z.array(z.string().max(200)).nullable().optional(),
  motivators: z.array(z.string().max(200)).nullable().optional(),
  current_challenge: z.string().max(2000).nullable().optional(),
  facilitator_notes: z.string().max(5000).nullable().optional(),
  readiness_level: z.enum(READINESS).nullable().optional(),
});

personsRoutes.get('/:id/change', (c) => getProfile(c, 'person_change_context'));
personsRoutes.patch('/:id/change', async (c) => {
  const body = ChangeUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  return upsertProfile(c, 'person_change_context', {
    ...body.data,
    notes_updated_at: new Date().toISOString(),
    notes_updated_by: ctx.userId,
  });
});

// --- person_learning -------------------------------------------------------
const LEARNING_STYLE = ['visual', 'auditory', 'reading', 'kinaesthetic', 'reflective'] as const;
const GROUP_ROLE = ['connector', 'challenger', 'synthesiser', 'anchor', 'observer'] as const;

const LearningUpdate = z.object({
  learning_interests: z.array(z.string().max(100)).nullable().optional(),
  prior_programmes: z.array(z.string().max(200)).nullable().optional(),
  learning_style: z.enum(LEARNING_STYLE).nullable().optional(),
  group_role_tendency: z.enum(GROUP_ROLE).nullable().optional(),
  development_goals: z.string().max(2000).nullable().optional(),
  post_programme_reflection: z.string().max(5000).nullable().optional(),
  open_to_coaching: z.boolean().nullable().optional(),
  open_to_peer_exchange: z.boolean().nullable().optional(),
});

personsRoutes.get('/:id/learning', (c) => getProfile(c, 'person_learning'));
personsRoutes.patch('/:id/learning', async (c) => {
  const body = LearningUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  return upsertProfile(c, 'person_learning', body.data);
});
