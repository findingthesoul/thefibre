import { Hono } from 'hono';
import { z } from 'zod';
import { userClient } from '../db.js';

// ===========================================================================
// Fibre Flow — Phase C: the definition layer.
//
// Flows are state machines. This file is CRUD for the *definitions*:
// flow_definition → flow_version → (flow_step, flow_transition,
// flow_gate_task, flow_step_default_task). The runtime (flow_run, flow_task)
// lands in Phase D.
//
// RLS does the heavy lifting: every query runs through userClient(jwt), so a
// user only ever sees/edits flows their workspace + scope + membership allow.
// We log full Postgres errors to stderr (feedback_api_logs_first).
// ===========================================================================

export const flowRoutes = new Hono();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const StepKind = z.enum(['entry', 'normal', 'end_positive', 'end_negative']);
const ActorType = z.enum(['personal', 'team', 'contact']);
const GateLogic = z.enum(['all', 'any']);

const CreateFlow = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  scope: z.enum(['personal', 'team', 'workspace']),
  team_id: z.string().uuid().optional().nullable(),
});

const PatchFlow = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  lifecycle: z.enum(['draft', 'active', 'closed', 'archived']).optional(),
  visibility: z.enum(['members_only', 'org_wide']).optional(),
});

// The JSON the builder (textarea in Phase C, canvas in Phase G) posts.
const GraphStep = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/, 'lowercase letters, digits, underscore'),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  kind: StepKind.default('normal'),
  expected_duration_days: z.number().int().positive().optional().nullable(),
  default_assignee_role: z.string().max(64).optional().nullable(),
});

const GraphGateTask = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  actor_type: ActorType,
  default_assignee_role: z.string().max(64).optional().nullable(),
  contact_action_type: z.string().max(120).optional().nullable(),
  required: z.boolean().default(true),
});

const GraphTransition = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().min(1).max(200),
  gate_logic: GateLogic.default('all'),
  gate_tasks: z.array(GraphGateTask).default([]),
});

const GraphStepDefaultTask = z.object({
  step: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  actor_type: ActorType,
  default_assignee_role: z.string().max(64).optional().nullable(),
  due_days_after_entry: z.number().int().positive().optional().nullable(),
});

const Graph = z.object({
  steps: z.array(GraphStep).min(1),
  transitions: z.array(GraphTransition).default([]),
  step_default_tasks: z.array(GraphStepDefaultTask).default([]),
});

// ---------------------------------------------------------------------------
// GET /flows — list flows the caller can see (RLS scopes them).
// Optional ?lifecycle= and ?scope= filters.
// ---------------------------------------------------------------------------
flowRoutes.get('/flows', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const lifecycle = c.req.query('lifecycle');
  const scope = c.req.query('scope');

  let q = db
    .from('flow_definition')
    .select(
      'id, name, description, scope, team_id, visibility, lifecycle, current_version_id, owner_user_id, created_at, updated_at',
    )
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  if (lifecycle) q = q.eq('lifecycle', lifecycle);
  if (scope) q = q.eq('scope', scope);

  const { data, error } = await q;
  if (error) {
    console.error('[flow] list flows', error);
    return c.json({ error: error.message }, 500);
  }

  // Counts of active runs per flow, for the library list. Best-effort.
  const ids = (data ?? []).map((f) => f.id);
  const counts: Record<string, number> = {};
  if (ids.length) {
    const { data: runs } = await db
      .from('flow_run')
      .select('flow_id')
      .in('flow_id', ids)
      .eq('status', 'active')
      .is('deleted_at', null);
    for (const r of runs ?? []) counts[r.flow_id] = (counts[r.flow_id] ?? 0) + 1;
  }

  return c.json({
    items: (data ?? []).map((f) => ({ ...f, active_run_count: counts[f.id] ?? 0 })),
  });
});

// ---------------------------------------------------------------------------
// POST /flows — create a draft flow + its first (empty) version.
// ---------------------------------------------------------------------------
flowRoutes.post('/flows', async (c) => {
  const ctx = c.get('ctx');
  const body = CreateFlow.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const { name, description, scope, team_id } = body.data;
  if (scope === 'team' && !team_id) {
    return c.json({ error: 'team_id is required for team-scoped flows' }, 400);
  }
  if (scope !== 'team' && team_id) {
    return c.json({ error: 'team_id only valid for team-scoped flows' }, 400);
  }

  const db = userClient(ctx.jwt);

  const { data: flow, error: fErr } = await db
    .from('flow_definition')
    .insert({
      workspace_id: ctx.workspaceId,
      name,
      description: description ?? null,
      scope,
      team_id: team_id ?? null,
      owner_user_id: ctx.userId,
      created_by: ctx.userId,
      lifecycle: 'draft',
    })
    .select('id')
    .single();
  if (fErr || !flow) {
    console.error('[flow] create flow', fErr);
    return c.json({ error: fErr?.message ?? 'create failed' }, 500);
  }

  const { data: version, error: vErr } = await db
    .from('flow_version')
    .insert({ flow_id: flow.id, version_number: 1, created_by: ctx.userId })
    .select('id')
    .single();
  if (vErr || !version) {
    console.error('[flow] create version', vErr);
    return c.json({ error: vErr?.message ?? 'version create failed' }, 500);
  }

  return c.json({ id: flow.id, draft_version_id: version.id }, 201);
});

// ---------------------------------------------------------------------------
// Helper: load the full graph of a version (steps, transitions+gates, defaults)
// keyed back to step `key`s so it round-trips with the editor JSON.
// ---------------------------------------------------------------------------
async function loadGraph(db: ReturnType<typeof userClient>, versionId: string) {
  const [{ data: steps }, { data: transitions }, { data: defaults }] = await Promise.all([
    db.from('flow_step').select('*').eq('flow_version_id', versionId).order('ordinal'),
    db.from('flow_transition').select('*').eq('flow_version_id', versionId).order('ordinal'),
    db
      .from('flow_step_default_task')
      .select('*, step:step_id (key)')
      .order('ordinal'),
  ]);

  const stepById = new Map((steps ?? []).map((s) => [s.id, s.key]));
  const stepIds = new Set((steps ?? []).map((s) => s.id));
  const transIds = (transitions ?? []).map((t) => t.id);

  let gates: Record<string, unknown>[] = [];
  if (transIds.length) {
    const { data: g } = await db
      .from('flow_gate_task')
      .select('*')
      .in('transition_id', transIds)
      .order('ordinal');
    gates = g ?? [];
  }
  const gatesByTransition = new Map<string, Record<string, unknown>[]>();
  for (const g of gates) {
    const arr = gatesByTransition.get(g.transition_id as string) ?? [];
    arr.push(g);
    gatesByTransition.set(g.transition_id as string, arr);
  }

  return {
    steps: (steps ?? []).map((s) => ({
      key: s.key,
      name: s.name,
      description: s.description,
      kind: s.kind,
      expected_duration_days: s.expected_duration_days,
      default_assignee_role: s.default_assignee_role,
      canvas_x: s.canvas_x,
      canvas_y: s.canvas_y,
    })),
    transitions: (transitions ?? []).map((t) => ({
      from: stepById.get(t.from_step_id),
      to: stepById.get(t.to_step_id),
      label: t.label,
      gate_logic: t.gate_logic,
      gate_tasks: (gatesByTransition.get(t.id) ?? []).map((g) => ({
        title: g.title,
        description: g.description,
        actor_type: g.actor_type,
        default_assignee_role: g.default_assignee_role,
        contact_action_type: g.contact_action_type,
        required: g.required,
      })),
    })),
    step_default_tasks: (defaults ?? [])
      .filter((d) => stepIds.has(d.step_id))
      .map((d) => ({
        step: (d.step as { key: string } | null)?.key,
        title: d.title,
        description: d.description,
        actor_type: d.actor_type,
        default_assignee_role: d.default_assignee_role,
        due_days_after_entry: d.due_days_after_entry,
      })),
  };
}

// ---------------------------------------------------------------------------
// GET /flows/:id — flow metadata + the editable (or current) version graph.
// ---------------------------------------------------------------------------
flowRoutes.get('/flows/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');

  const { data: flow, error } = await db
    .from('flow_definition')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (error || !flow) return c.json({ error: 'flow not found' }, 404);

  // Pick the version to show: the latest unpublished draft if one exists,
  // else the current (published) version.
  const { data: versions } = await db
    .from('flow_version')
    .select('id, version_number, published_at')
    .eq('flow_id', id)
    .order('version_number', { ascending: false });
  const draft = (versions ?? []).find((v) => !v.published_at);
  const shown = draft ?? (versions ?? [])[0] ?? null;

  const graph = shown ? await loadGraph(db, shown.id) : { steps: [], transitions: [], step_default_tasks: [] };

  return c.json({
    flow,
    version: shown,
    is_draft: !!draft,
    graph,
  });
});

// ---------------------------------------------------------------------------
// PATCH /flows/:id — metadata + lifecycle transitions.
// ---------------------------------------------------------------------------
flowRoutes.patch('/flows/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');
  const body = PatchFlow.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const patch: Record<string, unknown> = {};
  for (const k of ['name', 'description', 'lifecycle', 'visibility'] as const) {
    if (body.data[k] !== undefined) patch[k] = body.data[k];
  }
  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing to update' }, 400);

  const { data, error } = await db
    .from('flow_definition')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, lifecycle')
    .single();
  if (error) {
    console.error('[flow] patch flow', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ flow: data });
});

// ---------------------------------------------------------------------------
// Helper: the editable draft version for a flow. If the latest version is
// published, clone a fresh draft (version N+1). Returns the version id.
// ---------------------------------------------------------------------------
async function ensureDraftVersion(
  db: ReturnType<typeof userClient>,
  flowId: string,
  userId: string,
): Promise<{ id: string } | { error: string }> {
  const { data: versions, error } = await db
    .from('flow_version')
    .select('id, version_number, published_at')
    .eq('flow_id', flowId)
    .order('version_number', { ascending: false });
  if (error) return { error: error.message };

  const latest = (versions ?? [])[0];
  if (latest && !latest.published_at) return { id: latest.id };

  const nextNumber = (latest?.version_number ?? 0) + 1;
  const { data: created, error: cErr } = await db
    .from('flow_version')
    .insert({ flow_id: flowId, version_number: nextNumber, created_by: userId })
    .select('id')
    .single();
  if (cErr || !created) return { error: cErr?.message ?? 'draft create failed' };
  return { id: created.id };
}

// ---------------------------------------------------------------------------
// PUT /flows/:id/graph — replace the draft version's graph from JSON.
// Validates the graph, wipes the draft's steps (cascades to transitions +
// gates), and re-inserts everything. Idempotent for a given payload.
// ---------------------------------------------------------------------------
flowRoutes.put('/flows/:id/graph', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');

  const parsed = Graph.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const graph = parsed.data;

  // --- structural validation ---
  const keys = graph.steps.map((s) => s.key);
  const keySet = new Set(keys);
  if (keys.length !== keySet.size) {
    return c.json({ error: 'duplicate step keys' }, 400);
  }
  const entries = graph.steps.filter((s) => s.kind === 'entry');
  if (entries.length !== 1) {
    return c.json({ error: 'exactly one step must have kind "entry"' }, 400);
  }
  const hasEnd = graph.steps.some((s) => s.kind === 'end_positive' || s.kind === 'end_negative');
  if (!hasEnd) {
    return c.json({ error: 'at least one end step (end_positive/end_negative) is required' }, 400);
  }
  for (const t of graph.transitions) {
    if (!keySet.has(t.from)) return c.json({ error: `transition.from "${t.from}" is not a step key` }, 400);
    if (!keySet.has(t.to)) return c.json({ error: `transition.to "${t.to}" is not a step key` }, 400);
    for (const gt of t.gate_tasks) {
      if (gt.actor_type === 'contact' && !gt.contact_action_type) {
        return c.json({ error: `contact gate task "${gt.title}" needs contact_action_type` }, 400);
      }
      if (gt.actor_type !== 'contact' && gt.contact_action_type) {
        return c.json({ error: `non-contact gate task "${gt.title}" must not set contact_action_type` }, 400);
      }
    }
  }
  for (const d of graph.step_default_tasks) {
    if (!keySet.has(d.step)) return c.json({ error: `step_default_task.step "${d.step}" is not a step key` }, 400);
  }

  // Verify the flow exists + is visible (RLS) before mutating.
  const { data: flow } = await db
    .from('flow_definition')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (!flow) return c.json({ error: 'flow not found' }, 404);

  const draft = await ensureDraftVersion(db, id, ctx.userId);
  if ('error' in draft) {
    console.error('[flow] ensureDraftVersion', draft.error);
    return c.json({ error: draft.error }, 500);
  }
  const versionId = draft.id;

  // Wipe existing steps for this version (cascades to transitions + gate tasks
  // + step default tasks via FK on delete cascade).
  const { error: delErr } = await db.from('flow_step').delete().eq('flow_version_id', versionId);
  if (delErr) {
    console.error('[flow] wipe steps', delErr);
    return c.json({ error: delErr.message }, 500);
  }

  // Insert steps; map key → new id.
  const stepRows = graph.steps.map((s, i) => ({
    flow_version_id: versionId,
    key: s.key,
    name: s.name,
    description: s.description ?? null,
    kind: s.kind,
    expected_duration_days: s.expected_duration_days ?? null,
    default_assignee_role: s.default_assignee_role ?? null,
    ordinal: i,
  }));
  const { data: insertedSteps, error: sErr } = await db
    .from('flow_step')
    .insert(stepRows)
    .select('id, key');
  if (sErr || !insertedSteps) {
    console.error('[flow] insert steps', sErr);
    return c.json({ error: sErr?.message ?? 'step insert failed' }, 500);
  }
  const stepIdByKey = new Map(insertedSteps.map((s) => [s.key, s.id]));

  // Insert transitions; map index → id so we can attach gate tasks.
  const transRows = graph.transitions.map((t, i) => ({
    flow_version_id: versionId,
    from_step_id: stepIdByKey.get(t.from)!,
    to_step_id: stepIdByKey.get(t.to)!,
    label: t.label,
    gate_logic: t.gate_logic,
    ordinal: i,
  }));
  let insertedTransitions: { id: string }[] = [];
  if (transRows.length) {
    const { data, error: tErr } = await db.from('flow_transition').insert(transRows).select('id');
    if (tErr || !data) {
      console.error('[flow] insert transitions', tErr);
      return c.json({ error: tErr?.message ?? 'transition insert failed' }, 500);
    }
    insertedTransitions = data;
  }

  // Insert gate tasks, indexed to the transition they belong to.
  const gateRows: Record<string, unknown>[] = [];
  graph.transitions.forEach((t, i) => {
    const transitionId = insertedTransitions[i]?.id;
    if (!transitionId) return;
    t.gate_tasks.forEach((gt, j) => {
      gateRows.push({
        transition_id: transitionId,
        title: gt.title,
        description: gt.description ?? null,
        actor_type: gt.actor_type,
        default_assignee_role: gt.default_assignee_role ?? null,
        contact_action_type: gt.contact_action_type ?? null,
        required: gt.required,
        ordinal: j,
      });
    });
  });
  if (gateRows.length) {
    const { error: gErr } = await db.from('flow_gate_task').insert(gateRows);
    if (gErr) {
      console.error('[flow] insert gate tasks', gErr);
      return c.json({ error: gErr.message }, 500);
    }
  }

  // Insert step default tasks.
  const defaultRows = graph.step_default_tasks.map((d, i) => ({
    step_id: stepIdByKey.get(d.step)!,
    title: d.title,
    description: d.description ?? null,
    actor_type: d.actor_type,
    default_assignee_role: d.default_assignee_role ?? null,
    due_days_after_entry: d.due_days_after_entry ?? null,
    ordinal: i,
  }));
  if (defaultRows.length) {
    const { error: dErr } = await db.from('flow_step_default_task').insert(defaultRows);
    if (dErr) {
      console.error('[flow] insert step default tasks', dErr);
      return c.json({ error: dErr.message }, 500);
    }
  }

  const updated = await loadGraph(db, versionId);
  return c.json({ version_id: versionId, graph: updated });
});

// ---------------------------------------------------------------------------
// POST /flows/:id/publish — publish the draft version + activate the flow.
// ---------------------------------------------------------------------------
flowRoutes.post('/flows/:id/publish', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');

  const { data: versions } = await db
    .from('flow_version')
    .select('id, version_number, published_at')
    .eq('flow_id', id)
    .order('version_number', { ascending: false });
  const draft = (versions ?? []).find((v) => !v.published_at);
  if (!draft) return c.json({ error: 'no draft version to publish' }, 400);

  // A flow must have at least one step before it can be published.
  const { count } = await db
    .from('flow_step')
    .select('id', { count: 'exact', head: true })
    .eq('flow_version_id', draft.id);
  if (!count) return c.json({ error: 'cannot publish an empty flow — add steps first' }, 400);

  const { error: vErr } = await db
    .from('flow_version')
    .update({ published_at: new Date().toISOString() })
    .eq('id', draft.id);
  if (vErr) {
    console.error('[flow] publish version', vErr);
    return c.json({ error: vErr.message }, 500);
  }

  const { data: flow, error: fErr } = await db
    .from('flow_definition')
    .update({ current_version_id: draft.id, lifecycle: 'active' })
    .eq('id', id)
    .select('id, lifecycle, current_version_id')
    .single();
  if (fErr) {
    console.error('[flow] activate flow', fErr);
    return c.json({ error: fErr.message }, 500);
  }

  return c.json({ flow, published_version_id: draft.id });
});

// ---------------------------------------------------------------------------
// DELETE /flows/:id — soft delete.
// ---------------------------------------------------------------------------
flowRoutes.delete('/flows/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');
  const { error } = await db
    .from('flow_definition')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('[flow] soft delete', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ ok: true });
});
