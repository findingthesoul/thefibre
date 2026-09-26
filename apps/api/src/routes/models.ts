import { Hono } from 'hono';
import { z } from 'zod';
import { userClient, adminClient } from '../db.js';

// ===========================================================================
// Business Models (fibre-models) — storage for the generators.
//
// A model is a JSON definition plus the JSON of edited inputs; the arithmetic
// runs in the browser. RLS (20260925124033) decides who sees and edits what:
// a team's active members, or admins. This file adds the two things RLS
// cannot express well — who may CREATE for a team, and who may delete or
// change a definition (team leads and admins) versus who may only turn the
// dials (every active member).
// ===========================================================================

export const modelsRoutes = new Hono();

const MAX_DEFINITION_BYTES = 256 * 1024;
const MAX_INPUTS_BYTES = 64 * 1024;

const Named = z.object({ id: z.string().min(1).max(64) }).passthrough();

// Loose on purpose: the definition is the generator's contract, documented in
// the business-models repo, and it grows. The API guards shape and size; the
// engine in the browser ignores what it does not know.
const Definition = z
  .object({
    name: z.string().min(1).max(200),
    generators: z.array(Named).min(1).max(40),
    settings: z.array(Named).max(60).optional(),
    genericVariable: z.array(Named).max(20).optional(),
    fixedCosts: z.array(Named).max(60).optional(),
    investment: z.array(Named).max(60).optional(),
    tables: z.array(Named).max(40).optional(),
    horizon: z.number().int().min(12).max(240).optional(),
    breakEvenMonth: z.number().int().min(1).max(240).optional(),
  })
  .passthrough()
  .refine((d) => JSON.stringify(d).length <= MAX_DEFINITION_BYTES, 'definition too large');

const Inputs = z
  .record(z.unknown())
  .refine((i) => JSON.stringify(i).length <= MAX_INPUTS_BYTES, 'inputs too large');

const CreateModel = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9][a-z0-9-]*$/).optional(),
  tagline: z.string().max(300).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  team_id: z.string().uuid().optional().nullable(),
  definition: Definition,
});

const PatchModel = z.object({
  /** The updated_at the caller last saw. When the row moved on since, the
   *  patch is refused with 409 and the current row, so two people (or two
   *  assistants) cannot silently overwrite each other. Optional for now:
   *  older clients still save blind. */
  if_updated_at: z.string().optional(),
  name: z.string().min(1).max(200).optional(),
  tagline: z.string().max(300).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  team_id: z.string().uuid().optional().nullable(),
  definition: Definition.optional(),
  inputs: Inputs.optional(),
});

const LIST_SELECT =
  'id, slug, name, tagline, description, team_id, updated_at, created_at, team:team_id (id, name)';

type TeamRef = { id: string; name: string } | { id: string; name: string }[] | null;
const teamOf = (t: TeamRef) => (Array.isArray(t) ? (t[0] ?? null) : t);

function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'model';
}

async function isWorkspaceAdmin(userId: string, workspaceId: string): Promise<boolean> {
  if (!userId) return false;
  const { data } = await adminClient
    .from('workspace_member')
    .select('workspace_role')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return data?.workspace_role === 'admin' || data?.workspace_role === 'super_admin';
}

async function isTeamLead(userId: string, teamId: string | null): Promise<boolean> {
  if (!userId || !teamId) return false;
  const { data } = await adminClient
    .from('team_member')
    .select('role, status')
    .eq('user_id', userId)
    .eq('team_id', teamId)
    .maybeSingle();
  return data?.status === 'active' && data?.role === 'lead';
}

/** Admins and team leads shape a model (definition, team, deletion); members turn the dials. */
async function mayShape(userId: string, workspaceId: string, teamId: string | null): Promise<boolean> {
  return (await isWorkspaceAdmin(userId, workspaceId)) || (await isTeamLead(userId, teamId));
}

// GET /api/v1/models — the models the caller may see, with their team.
modelsRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('models_model')
    .select(LIST_SELECT)
    .is('deleted_at', null)
    .order('name', { ascending: true });
  if (error) {
    console.error('[models] list', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({
    items: (data ?? []).map((m) => ({ ...m, team: teamOf(m.team as TeamRef) })),
    is_admin: await isWorkspaceAdmin(ctx.userId, ctx.workspaceId),
  });
});

// GET /api/v1/models/teams — where the caller may put a model. Admins: every
// active team plus "whole workspace"; others: the teams they are active in.
modelsRoutes.get('/teams', async (c) => {
  const ctx = c.get('ctx');
  const admin = await isWorkspaceAdmin(ctx.userId, ctx.workspaceId);
  const { data: teams, error } = await adminClient
    .from('team')
    .select('id, name, is_active, members:team_member (user_id, role, status)')
    .eq('workspace_id', ctx.workspaceId)
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) {
    console.error('[models] teams', error);
    return c.json({ error: error.message }, 500);
  }
  const items = (teams ?? [])
    .map((t) => {
      const members = (Array.isArray(t.members) ? t.members : []) as { user_id: string; role: string; status: string }[];
      const mine = members.find((m) => m.user_id === ctx.userId && m.status === 'active');
      return { id: t.id as string, name: t.name as string, role: admin ? 'admin' : mine ? mine.role : null };
    })
    .filter((t) => t.role !== null);
  return c.json({ items, is_admin: admin });
});

// POST /api/v1/models — create. RLS admits admins and active team members;
// this route narrows creation to admins and leads, and mints the slug.
modelsRoutes.post('/', async (c) => {
  const body = CreateModel.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const teamId = body.data.team_id ?? null;
  if (!(await mayShape(ctx.userId, ctx.workspaceId, teamId))) {
    return c.json({ error: 'Only workspace admins and team leads can create a business model here.' }, 403);
  }

  const db = userClient(ctx.jwt);
  const base = body.data.slug ?? slugify(body.data.name);
  const { data: taken } = await adminClient
    .from('models_model')
    .select('slug')
    .eq('workspace_id', ctx.workspaceId)
    .is('deleted_at', null)
    .like('slug', `${base}%`);
  const used = new Set((taken ?? []).map((r) => r.slug as string));
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;

  const { data, error } = await db
    .from('models_model')
    .insert({
      workspace_id: ctx.workspaceId,
      team_id: teamId,
      slug,
      name: body.data.name,
      tagline: body.data.tagline ?? null,
      description: body.data.description ?? null,
      definition: body.data.definition,
      inputs: {},
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select(LIST_SELECT)
    .single();
  if (error) {
    console.error('[models] create', error);
    return c.json({ error: error.message }, error.code === '42501' ? 403 : 500);
  }
  return c.json({ ...data, team: teamOf(data.team as TeamRef) }, 201);
});

// GET /api/v1/models/:id — the whole model.
modelsRoutes.get('/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('models_model')
    .select(`${LIST_SELECT}, definition, inputs`)
    .eq('id', c.req.param('id'))
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    console.error('[models] get', error);
    return c.json({ error: error.message }, 500);
  }
  if (!data) return c.json({ error: 'not found' }, 404);
  return c.json({
    ...data,
    team: teamOf(data.team as TeamRef),
    may_shape: await mayShape(ctx.userId, ctx.workspaceId, data.team_id as string | null),
  });
});

// PATCH /api/v1/models/:id — inputs from any member; the rest from leads and admins.
modelsRoutes.patch('/:id', async (c) => {
  const body = PatchModel.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');

  const { data: current } = await db
    .from('models_model')
    .select('id, team_id, updated_at')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!current) return c.json({ error: 'not found' }, 404);

  const { inputs, if_updated_at, ...shape } = body.data;
  if (if_updated_at && new Date(if_updated_at).getTime() !== new Date(current.updated_at as string).getTime()) {
    const { data: fresh } = await db.from('models_model').select(`${LIST_SELECT}, definition, inputs`).eq('id', id).single();
    return c.json({ error: 'The model changed since you loaded it. Reload to see the latest version; your last change was not saved.', code: 'conflict', current: fresh ? { ...fresh, team: teamOf(fresh.team as TeamRef) } : null }, 409);
  }
  const shaping = Object.keys(shape).length > 0;
  if (shaping && !(await mayShape(ctx.userId, ctx.workspaceId, current.team_id as string | null))) {
    return c.json({ error: 'Only workspace admins and team leads can change the model itself. Everyone in the team can change the numbers.' }, 403);
  }
  if ('team_id' in shape && shape.team_id && !(await mayShape(ctx.userId, ctx.workspaceId, shape.team_id))) {
    return c.json({ error: 'You can only move a model to a team you lead.' }, 403);
  }

  const patch: Record<string, unknown> = { ...shape, updated_by: ctx.userId };
  if (inputs !== undefined) patch.inputs = inputs;
  const { data, error } = await db
    .from('models_model')
    .update(patch)
    .eq('id', id)
    .select(`${LIST_SELECT}, definition, inputs`)
    .single();
  if (error) {
    console.error('[models] patch', error);
    return c.json({ error: error.message }, error.code === '42501' ? 403 : 500);
  }
  return c.json({ ...data, team: teamOf(data.team as TeamRef) });
});

// The numbers blob: {settings, generators:{gid:{...}}, fixed, investment,
// transitions, periods:{gid:{month:n}}, periodRates, refMonth, horizon,
// scenarios:[...]}. A partial patch merges one level into the tables so an
// assistant can set two variables without knowing the rest.
const NumberTable = z.record(z.number().finite());
// A band table's numbers, replaced whole: bands are an ordered list.
const BandNumbers = z.object({
  bands: z.array(z.object({ upTo: z.number().finite().nullable(), value: z.number().finite().optional(), rate: z.number().finite().optional() })).min(1).max(40),
  cap: z.number().finite().nullable().optional(),
});
const NumbersPatch = z.object({
  settings: NumberTable.optional(),
  generators: z.record(NumberTable).optional(),
  fixed: NumberTable.optional(),
  investment: NumberTable.optional(),
  transitions: NumberTable.optional(),
  periods: z.record(NumberTable).optional(),
  periodRates: z.record(NumberTable).optional(),
  tables: z.record(BandNumbers).optional(),
  refMonth: z.number().int().min(1).max(240).optional(),
  horizon: z.number().int().min(12).max(240).optional(),
});
type Blob = Record<string, unknown>;
function mergeNumbers(current: Blob, patch: z.infer<typeof NumbersPatch>): Blob {
  const out: Blob = { ...current };
  (['settings', 'fixed', 'investment', 'transitions'] as const).forEach((k) => { if (patch[k]) out[k] = { ...((current[k] as Blob) ?? {}), ...patch[k] }; });
  (['generators', 'periods', 'periodRates'] as const).forEach((k) => {
    if (!patch[k]) return;
    const cur = (current[k] as Record<string, Blob>) ?? {};
    const next: Record<string, Blob> = { ...cur };
    Object.entries(patch[k]!).forEach(([id, table]) => { next[id] = { ...(cur[id] ?? {}), ...table }; });
    out[k] = next;
  });
  if (patch.tables) out.tables = { ...((current.tables as Blob) ?? {}), ...patch.tables };
  if (patch.refMonth != null) out.refMonth = patch.refMonth;
  if (patch.horizon != null) out.horizon = patch.horizon;
  return out;
}

// PUT /api/v1/models/:id/numbers — merge a partial numbers patch. Any active member.
modelsRoutes.put('/:id/numbers', async (c) => {
  const body = NumbersPatch.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');
  const { data: current } = await db.from('models_model').select('id, inputs').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!current) return c.json({ error: 'not found' }, 404);
  const inputs = mergeNumbers((current.inputs as Blob) ?? {}, body.data);
  if (JSON.stringify(inputs).length > MAX_INPUTS_BYTES) return c.json({ error: 'inputs too large' }, 400);
  const { data, error } = await db.from('models_model').update({ inputs, updated_by: ctx.userId }).eq('id', id).select(`${LIST_SELECT}, inputs`).single();
  if (error) { console.error('[models] numbers', error); return c.json({ error: error.message }, error.code === '42501' ? 403 : 500); }
  return c.json({ ...data, team: teamOf(data.team as TeamRef) });
});

// POST /api/v1/models/:id/scenarios — save the current numbers under a name,
// server side, so it cannot race the numbers being typed in the app.
const SaveScenario = z.object({ name: z.string().min(1).max(120) });
modelsRoutes.post('/:id/scenarios', async (c) => {
  const body = SaveScenario.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');
  const { data: current } = await db.from('models_model').select('id, inputs').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!current) return c.json({ error: 'not found' }, 404);
  const inputs = { ...((current.inputs as Blob) ?? {}) };
  const { scenarios: existing, ...numbers } = inputs as Blob & { scenarios?: unknown[] };
  const list = (Array.isArray(existing) ? existing : []).filter((x) => !(x && typeof x === 'object' && (x as Blob).name === body.data.name));
  const scenario = { id: crypto.randomUUID(), name: body.data.name, savedAt: new Date().toISOString(), inputs: numbers };
  const next = { ...inputs, scenarios: [...list, scenario] };
  if (JSON.stringify(next).length > MAX_INPUTS_BYTES) return c.json({ error: 'inputs too large: delete an older scenario first' }, 400);
  const { error } = await db.from('models_model').update({ inputs: next, updated_by: ctx.userId }).eq('id', id);
  if (error) { console.error('[models] scenario', error); return c.json({ error: error.message }, error.code === '42501' ? 403 : 500); }
  return c.json({ saved: true, scenario: { id: scenario.id, name: scenario.name, savedAt: scenario.savedAt }, scenarios: [...list, scenario].map((x) => ({ id: (x as Blob).id, name: (x as Blob).name, savedAt: (x as Blob).savedAt })) }, 201);
});

// POST /api/v1/models/:id/duplicate — a copy, definition and numbers, in a
// team the caller leads (or workspace wide for admins). Scenarios come along.
const Duplicate = z.object({ name: z.string().min(1).max(200).optional(), team_id: z.string().uuid().optional().nullable() });
modelsRoutes.post('/:id/duplicate', async (c) => {
  const body = Duplicate.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: src } = await db.from('models_model').select('id, name, tagline, description, team_id, definition, inputs').eq('id', c.req.param('id')).is('deleted_at', null).maybeSingle();
  if (!src) return c.json({ error: 'not found' }, 404);
  const teamId = body.data.team_id === undefined ? (src.team_id as string | null) : body.data.team_id;
  if (!(await mayShape(ctx.userId, ctx.workspaceId, teamId))) return c.json({ error: 'Only workspace admins and team leads can create a business model here.' }, 403);
  const name = body.data.name ?? `${src.name} (copy)`;
  const base = slugify(name);
  const { data: taken } = await adminClient.from('models_model').select('slug').eq('workspace_id', ctx.workspaceId).is('deleted_at', null).like('slug', `${base}%`);
  const used = new Set((taken ?? []).map((r) => r.slug as string));
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
  const definition = { ...(src.definition as Blob), name };
  const { data, error } = await db.from('models_model').insert({ workspace_id: ctx.workspaceId, team_id: teamId, slug, name, tagline: src.tagline, description: src.description, definition, inputs: src.inputs ?? {}, created_by: ctx.userId, updated_by: ctx.userId }).select(LIST_SELECT).single();
  if (error) { console.error('[models] duplicate', error); return c.json({ error: error.message }, error.code === '42501' ? 403 : 500); }
  return c.json({ ...data, team: teamOf(data.team as TeamRef), copied_from: src.id }, 201);
});

// DELETE /api/v1/models/:id — soft delete, leads and admins.
modelsRoutes.delete('/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');
  const { data: current } = await db
    .from('models_model')
    .select('id, team_id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!current) return c.json({ error: 'not found' }, 404);
  if (!(await mayShape(ctx.userId, ctx.workspaceId, current.team_id as string | null))) {
    return c.json({ error: 'Only workspace admins and team leads can delete a business model.' }, 403);
  }
  const { error } = await db
    .from('models_model')
    .update({ deleted_at: new Date().toISOString(), updated_by: ctx.userId })
    .eq('id', id);
  if (error) {
    console.error('[models] delete', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ ok: true });
});
