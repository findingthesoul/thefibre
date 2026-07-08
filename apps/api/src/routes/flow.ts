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
const StepKind = z.enum(['entry', 'normal', 'end_positive', 'end_negative', 'loop']);
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
  // Canvas coordinates from the visual builder (Phase G). Optional so the
  // JSON editor (which omits them) still validates.
  canvas_x: z.number().optional().nullable(),
  canvas_y: z.number().optional().nullable(),
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

  // Which of these the caller has favourited.
  const favs = new Set<string>();
  if (ids.length) {
    const { data: favRows } = await db
      .from('flow_favorite')
      .select('flow_id')
      .eq('user_id', ctx.userId)
      .in('flow_id', ids);
    for (const f of favRows ?? []) favs.add(f.flow_id);
  }

  let items = (data ?? []).map((f) => ({
    ...f,
    active_run_count: counts[f.id] ?? 0,
    is_favorite: favs.has(f.id),
  }));
  if (c.req.query('favorite') === '1') items = items.filter((f) => f.is_favorite);

  return c.json({ items });
});

// ---------------------------------------------------------------------------
// PUT / DELETE /flows/:id/favorite — star / unstar a flow for the caller.
// ---------------------------------------------------------------------------
flowRoutes.put('/flows/:id/favorite', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');
  const { error } = await db
    .from('flow_favorite')
    .upsert({ user_id: ctx.userId, flow_id: id }, { onConflict: 'user_id,flow_id' });
  if (error) {
    console.error('[flow] favorite', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ ok: true, is_favorite: true });
});

flowRoutes.delete('/flows/:id/favorite', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');
  const { error } = await db
    .from('flow_favorite')
    .delete()
    .eq('user_id', ctx.userId)
    .eq('flow_id', id);
  if (error) {
    console.error('[flow] unfavorite', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ ok: true, is_favorite: false });
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
    canvas_x: s.canvas_x ?? null,
    canvas_y: s.canvas_y ?? null,
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
  // App-owned flows can't be deleted while the owning app is active — the
  // Pipeline flow is what Fibre Pulse's cashflow reads (system_key marks it).
  const { data: sys } = await db
    .from('flow_definition')
    .select('system_key')
    .eq('id', id)
    .maybeSingle();
  if (sys?.system_key === 'pulse_pipeline') {
    return c.json(
      { error: 'This flow is the Pulse pipeline — the cashflow tool reads it. Deactivate Fibre Pulse before deleting it.' },
      409,
    );
  }
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

// ===========================================================================
// Phase D — runtime: flow_run + flow_task. Putting contacts into flows and
// moving them through steps with gate validation.
// ===========================================================================

type Db = ReturnType<typeof userClient>;

// Resolve the calling app's slug → app.id (for activity rows).
async function resolveAppId(db: Db, slug: string): Promise<string | null> {
  const { data } = await db.from('app').select('id').eq('slug', slug).single();
  return data?.id ?? null;
}

// Append an activity event (type + subject only — never content body).
async function writeActivity(
  db: Db,
  appId: string | null,
  workspaceId: string,
  userId: string,
  personId: string,
  type: string,
  subject: string,
) {
  if (!appId) return;
  const { error } = await db.from('activity').insert({
    workspace_id: workspaceId,
    person_id: personId,
    app_id: appId,
    type,
    subject,
    occurred_at: new Date().toISOString(),
    created_by: userId,
  });
  if (error) console.error('[flow] writeActivity', type, error);
}

// Materialise the tasks for a step a run has just entered:
//   - the step's default tasks
//   - the gate tasks on every transition leaving the step (the things that
//     must be done to move on).
async function materialiseTasksForStep(
  db: Db,
  opts: {
    workspaceId: string;
    runId: string;
    personId: string;
    stepId: string;
    versionId: string;
    ownerUserId: string | null;
    teamId: string | null;
    createdBy: string;
  },
) {
  const { workspaceId, runId, personId, stepId, versionId, ownerUserId, teamId, createdBy } = opts;

  function assignee(actorType: string) {
    if (actorType === 'personal') return { assignee_user_id: ownerUserId, assignee_team_id: null, contact_id: null };
    if (actorType === 'team') return { assignee_user_id: null, assignee_team_id: teamId, contact_id: null };
    return { assignee_user_id: null, assignee_team_id: null, contact_id: personId }; // contact
  }

  const rows: Record<string, unknown>[] = [];

  // Step default tasks.
  const { data: defaults } = await db
    .from('flow_step_default_task')
    .select('*')
    .eq('step_id', stepId)
    .order('ordinal');
  for (const d of defaults ?? []) {
    const due =
      d.due_days_after_entry != null
        ? new Date(Date.now() + d.due_days_after_entry * 86400000).toISOString()
        : null;
    rows.push({
      workspace_id: workspaceId,
      flow_run_id: runId,
      step_default_task_id: d.id,
      title: d.title,
      description: d.description,
      actor_type: d.actor_type,
      ...assignee(d.actor_type),
      due_at: due,
      created_by: createdBy,
    });
  }

  // Gate tasks on transitions leaving this step.
  const { data: transitions } = await db
    .from('flow_transition')
    .select('id')
    .eq('flow_version_id', versionId)
    .eq('from_step_id', stepId);
  const transIds = (transitions ?? []).map((t) => t.id);
  if (transIds.length) {
    const { data: gates } = await db
      .from('flow_gate_task')
      .select('*')
      .in('transition_id', transIds)
      .order('ordinal');
    for (const g of gates ?? []) {
      rows.push({
        workspace_id: workspaceId,
        flow_run_id: runId,
        gate_task_id: g.id,
        title: g.title,
        description: g.description,
        actor_type: g.actor_type,
        ...assignee(g.actor_type),
        contact_id: g.actor_type === 'contact' ? personId : assignee(g.actor_type).contact_id,
        due_at: null,
        created_by: createdBy,
      });
    }
  }

  if (rows.length) {
    const { error } = await db.from('flow_task').insert(rows);
    if (error) console.error('[flow] materialiseTasksForStep', error);
  }
}

// ---------------------------------------------------------------------------
// POST /flows/:id/runs — add a person to a flow (start a run at the entry step).
// ---------------------------------------------------------------------------
const StartRun = z.object({ person_id: z.string().uuid() });

flowRoutes.post('/flows/:id/runs', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const flowId = c.req.param('id');
  const body = StartRun.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const { data: flow } = await db
    .from('flow_definition')
    .select('id, name, scope, team_id, owner_user_id, current_version_id, lifecycle')
    .eq('id', flowId)
    .is('deleted_at', null)
    .single();
  if (!flow) return c.json({ error: 'flow not found' }, 404);
  if (!flow.current_version_id) {
    return c.json({ error: 'flow has no published version — publish it first' }, 400);
  }
  if (flow.lifecycle === 'closed' || flow.lifecycle === 'archived') {
    return c.json({ error: `flow is ${flow.lifecycle} — no new contacts can enter` }, 400);
  }

  // Entry step of the published version.
  const { data: entry } = await db
    .from('flow_step')
    .select('id, name')
    .eq('flow_version_id', flow.current_version_id)
    .eq('kind', 'entry')
    .single();
  if (!entry) return c.json({ error: 'published version has no entry step' }, 500);

  const { data: run, error: rErr } = await db
    .from('flow_run')
    .insert({
      workspace_id: ctx.workspaceId,
      flow_id: flowId,
      flow_version_id: flow.current_version_id,
      person_id: body.data.person_id,
      current_step_id: entry.id,
      owner_user_id: ctx.userId,
      status: 'active',
    })
    .select('id')
    .single();
  if (rErr || !run) {
    console.error('[flow] start run', rErr);
    return c.json({ error: rErr?.message ?? 'could not start run' }, 500);
  }

  await materialiseTasksForStep(db, {
    workspaceId: ctx.workspaceId,
    runId: run.id,
    personId: body.data.person_id,
    stepId: entry.id,
    versionId: flow.current_version_id,
    ownerUserId: ctx.userId,
    teamId: flow.team_id,
    createdBy: ctx.userId,
  });

  const appId = await resolveAppId(db, ctx.appId);
  await writeActivity(db, appId, ctx.workspaceId, ctx.userId, body.data.person_id, 'flow.run.started', `Added to ${flow.name}`);

  return c.json({ id: run.id }, 201);
});

// ---------------------------------------------------------------------------
// GET /flows/:id/runs — runs in a flow, with person + current step.
// ---------------------------------------------------------------------------
flowRoutes.get('/flows/:id/runs', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const flowId = c.req.param('id');
  const { data, error } = await db
    .from('flow_run')
    .select(
      'id, status, entered_at, current_step_entered_at, completed_at, person:person_id (id, first_name, last_name, email), step:current_step_id (id, key, name, kind)',
    )
    .eq('flow_id', flowId)
    .is('deleted_at', null)
    .order('entered_at', { ascending: false });
  if (error) {
    console.error('[flow] list runs', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ items: data ?? [] });
});

// ---------------------------------------------------------------------------
// Compute, for a transition, whether its gate is satisfied given the run's
// current task states.
// ---------------------------------------------------------------------------
function gateSatisfied(
  gateLogic: string,
  gateTaskIds: string[],
  doneGateTaskIds: Set<string>,
  requiredByGateTaskId: Map<string, boolean>,
): boolean {
  const required = gateTaskIds.filter((id) => requiredByGateTaskId.get(id));
  if (required.length === 0) return true; // no required tasks → always passable
  if (gateLogic === 'any') return required.some((id) => doneGateTaskIds.has(id));
  return required.every((id) => doneGateTaskIds.has(id)); // 'all'
}

// ---------------------------------------------------------------------------
// GET /runs/:id — run detail: current step, open tasks, available transitions
// with per-transition gate satisfaction.
// ---------------------------------------------------------------------------
flowRoutes.get('/runs/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');

  const { data: run, error } = await db
    .from('flow_run')
    .select(
      'id, flow_id, flow_version_id, status, entered_at, current_step_entered_at, completed_at, withdrawn_reason, owner_user_id, person:person_id (id, first_name, last_name, email), step:current_step_id (id, key, name, kind, description)',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (error || !run) return c.json({ error: 'run not found' }, 404);

  const step = Array.isArray(run.step) ? run.step[0] : run.step;

  // Tasks for this run.
  const { data: tasks } = await db
    .from('flow_task')
    .select('*')
    .eq('flow_run_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  // Per-step notes (step resolved to its key so the UI can group them).
  const { data: notes } = await db
    .from('flow_run_note')
    .select('id, body, created_at, step:step_id (key), author:created_by (full_name, email)')
    .eq('flow_run_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  const doneGate = new Set<string>();
  for (const t of tasks ?? []) {
    if (t.gate_task_id && t.status === 'done') doneGate.add(t.gate_task_id);
  }

  // Available transitions out of the current step.
  let transitions: unknown[] = [];
  if (step?.id) {
    const { data: trans } = await db
      .from('flow_transition')
      .select('id, label, gate_logic, to_step_id, ordinal, to_step:to_step_id (key, name, kind)')
      .eq('flow_version_id', run.flow_version_id)
      .eq('from_step_id', step.id)
      .order('ordinal');
    const transIds = (trans ?? []).map((t) => t.id);
    const gatesByTransition = new Map<string, { id: string; required: boolean }[]>();
    if (transIds.length) {
      const { data: gates } = await db
        .from('flow_gate_task')
        .select('id, transition_id, required, title, actor_type')
        .in('transition_id', transIds);
      for (const g of gates ?? []) {
        const arr = gatesByTransition.get(g.transition_id) ?? [];
        arr.push({ id: g.id, required: g.required });
        gatesByTransition.set(g.transition_id, arr);
      }
    }
    transitions = (trans ?? []).map((t) => {
      const gts = gatesByTransition.get(t.id) ?? [];
      const reqMap = new Map(gts.map((g) => [g.id, g.required]));
      const satisfied = gateSatisfied(
        t.gate_logic,
        gts.map((g) => g.id),
        doneGate,
        reqMap,
      );
      return {
        id: t.id,
        label: t.label,
        gate_logic: t.gate_logic,
        to_step: Array.isArray(t.to_step) ? t.to_step[0] : t.to_step,
        gate_satisfied: satisfied,
        gate_task_count: gts.length,
      };
    });
  }

  // Full graph of the run's version, for visual layout in the contact popup.
  const graph = await loadGraph(db, run.flow_version_id);

  return c.json({ run: { ...run, step }, tasks: tasks ?? [], notes: notes ?? [], transitions, graph });
});

// ---------------------------------------------------------------------------
// POST /runs/:id/notes — leave a note on a (run, step) pair.
// ---------------------------------------------------------------------------
const CreateNote = z.object({
  step_key: z.string().min(1),
  body: z.string().min(1).max(2000),
});

flowRoutes.post('/runs/:id/notes', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');
  const parsed = CreateNote.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { data: run } = await db
    .from('flow_run')
    .select('id, flow_version_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (!run) return c.json({ error: 'run not found' }, 404);

  const { data: noteStep } = await db
    .from('flow_step')
    .select('id')
    .eq('flow_version_id', run.flow_version_id)
    .eq('key', parsed.data.step_key)
    .single();
  if (!noteStep) return c.json({ error: 'step not found in this flow version' }, 404);

  const { data: note, error: nErr } = await db
    .from('flow_run_note')
    .insert({
      workspace_id: ctx.workspaceId,
      flow_run_id: id,
      step_id: noteStep.id,
      body: parsed.data.body,
      created_by: ctx.userId,
    })
    .select('id')
    .single();
  if (nErr || !note) {
    console.error('[flow] create note', nErr);
    return c.json({ error: nErr?.message ?? 'note create failed' }, 500);
  }
  return c.json({ id: note.id }, 201);
});

// ---------------------------------------------------------------------------
// POST /runs/:id/transition — move the run along a transition.
// Validates the gate unless override_reason is supplied.
// ---------------------------------------------------------------------------
const DoTransition = z.object({
  transition_id: z.string().uuid(),
  override_reason: z.string().max(500).optional().nullable(),
});

flowRoutes.post('/runs/:id/transition', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');
  const body = DoTransition.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const { data: run } = await db
    .from('flow_run')
    .select('id, flow_id, flow_version_id, current_step_id, person_id, owner_user_id, status')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (!run) return c.json({ error: 'run not found' }, 404);
  if (run.status !== 'active') return c.json({ error: `run is ${run.status}` }, 400);

  const { data: trans } = await db
    .from('flow_transition')
    .select('id, label, gate_logic, from_step_id, to_step_id')
    .eq('id', body.data.transition_id)
    .single();
  if (!trans || trans.from_step_id !== run.current_step_id) {
    return c.json({ error: 'transition does not start from the current step' }, 400);
  }

  // Gate check.
  const { data: gates } = await db
    .from('flow_gate_task')
    .select('id, required')
    .eq('transition_id', trans.id);
  const gateTaskIds = (gates ?? []).map((g) => g.id);
  const reqMap = new Map((gates ?? []).map((g) => [g.id, g.required]));
  const { data: doneTasks } = await db
    .from('flow_task')
    .select('gate_task_id')
    .eq('flow_run_id', id)
    .eq('status', 'done')
    .not('gate_task_id', 'is', null);
  const doneSet = new Set((doneTasks ?? []).map((t) => t.gate_task_id as string));
  const satisfied = gateSatisfied(trans.gate_logic, gateTaskIds, doneSet, reqMap);
  if (!satisfied && !body.data.override_reason) {
    return c.json({ error: 'gate not satisfied — complete the required tasks or provide an override reason', code: 'gate_unsatisfied' }, 409);
  }

  // Destination step.
  const { data: toStep } = await db
    .from('flow_step')
    .select('id, name, kind')
    .eq('id', trans.to_step_id)
    .single();
  if (!toStep) return c.json({ error: 'destination step missing' }, 500);

  // Loop steps close a cycle: entering one bounces the run straight back to
  // the version's entry step (fresh entry tasks, logged as "looped back").
  let dest = toStep;
  let loopedVia: string | null = null;
  if (toStep.kind === 'loop') {
    const { data: entry } = await db
      .from('flow_step')
      .select('id, name, kind')
      .eq('flow_version_id', run.flow_version_id)
      .eq('kind', 'entry')
      .single();
    if (entry) {
      loopedVia = toStep.name;
      dest = entry;
    }
  }

  // Cancel open flow-generated tasks (gate + step-default) for this run; manual
  // tasks (no template link) are preserved.
  await db
    .from('flow_task')
    .update({ status: 'cancelled' })
    .eq('flow_run_id', id)
    .in('status', ['open', 'in_progress'])
    .or('gate_task_id.not.is.null,step_default_task_id.not.is.null');

  const isEnd = dest.kind === 'end_positive' || dest.kind === 'end_negative';
  const { error: uErr } = await db
    .from('flow_run')
    .update({
      current_step_id: dest.id,
      current_step_entered_at: new Date().toISOString(),
      status: isEnd ? 'completed' : 'active',
      completed_at: isEnd ? new Date().toISOString() : null,
    })
    .eq('id', id);
  if (uErr) {
    console.error('[flow] transition update', uErr);
    return c.json({ error: uErr.message }, 500);
  }

  // Materialise the destination step's tasks (unless it's a terminal step).
  if (!isEnd) {
    const { data: flow } = await db
      .from('flow_definition')
      .select('team_id')
      .eq('id', run.flow_id)
      .single();
    await materialiseTasksForStep(db, {
      workspaceId: ctx.workspaceId,
      runId: id,
      personId: run.person_id,
      stepId: dest.id,
      versionId: run.flow_version_id,
      ownerUserId: run.owner_user_id,
      teamId: flow?.team_id ?? null,
      createdBy: ctx.userId,
    });
  }

  const appId = await resolveAppId(db, ctx.appId);
  const overrideNote = !satisfied ? ' (override)' : '';
  await writeActivity(
    db,
    appId,
    ctx.workspaceId,
    ctx.userId,
    run.person_id,
    isEnd ? 'flow.run.completed' : 'flow.run.step_changed',
    isEnd
      ? `Completed via ${dest.name}`
      : loopedVia
        ? `Looped back to ${dest.name} via ${loopedVia}${overrideNote}`
        : `Moved to ${dest.name}${overrideNote}`,
  );

  return c.json({ ok: true, to_step: dest, completed: isEnd, looped_via: loopedVia });
});

// ---------------------------------------------------------------------------
// POST /runs/:id/move — manual reposition to ANY step in the run's version,
// bypassing transition/gate validation. This is the "revert / move back"
// (or sideways) path. Records the move as an activity, noting it was manual.
// ---------------------------------------------------------------------------
const ManualMove = z.object({ step_key: z.string().min(1), reason: z.string().max(500).optional().nullable() });

flowRoutes.post('/runs/:id/move', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');
  const body = ManualMove.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const { data: run } = await db
    .from('flow_run')
    .select('id, flow_id, flow_version_id, current_step_id, person_id, owner_user_id, status')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (!run) return c.json({ error: 'run not found' }, 404);

  // Resolve the target step within the run's version.
  const { data: target } = await db
    .from('flow_step')
    .select('id, name, kind')
    .eq('flow_version_id', run.flow_version_id)
    .eq('key', body.data.step_key)
    .single();
  if (!target) return c.json({ error: 'step not found in this flow version' }, 404);
  if (target.id === run.current_step_id) return c.json({ error: 'already at this step' }, 400);

  // Loop steps bounce straight back to the entry step (same as transitions).
  let dest = target;
  let loopedVia: string | null = null;
  if (target.kind === 'loop') {
    const { data: entry } = await db
      .from('flow_step')
      .select('id, name, kind')
      .eq('flow_version_id', run.flow_version_id)
      .eq('kind', 'entry')
      .single();
    if (entry) {
      loopedVia = target.name;
      dest = entry;
    }
  }

  // Cancel open flow-generated tasks; manual tasks survive.
  await db
    .from('flow_task')
    .update({ status: 'cancelled' })
    .eq('flow_run_id', id)
    .in('status', ['open', 'in_progress'])
    .or('gate_task_id.not.is.null,step_default_task_id.not.is.null');

  const isEnd = dest.kind === 'end_positive' || dest.kind === 'end_negative';
  const { error: uErr } = await db
    .from('flow_run')
    .update({
      current_step_id: dest.id,
      current_step_entered_at: new Date().toISOString(),
      status: isEnd ? 'completed' : 'active',
      completed_at: isEnd ? new Date().toISOString() : null,
    })
    .eq('id', id);
  if (uErr) {
    console.error('[flow] manual move', uErr);
    return c.json({ error: uErr.message }, 500);
  }

  if (!isEnd) {
    const { data: flow } = await db.from('flow_definition').select('team_id').eq('id', run.flow_id).single();
    await materialiseTasksForStep(db, {
      workspaceId: ctx.workspaceId,
      runId: id,
      personId: run.person_id,
      stepId: dest.id,
      versionId: run.flow_version_id,
      ownerUserId: run.owner_user_id,
      teamId: flow?.team_id ?? null,
      createdBy: ctx.userId,
    });
  }

  const appId = await resolveAppId(db, ctx.appId);
  await writeActivity(
    db,
    appId,
    ctx.workspaceId,
    ctx.userId,
    run.person_id,
    isEnd ? 'flow.run.completed' : 'flow.run.step_changed',
    isEnd
      ? `Completed at ${dest.name} (manual)`
      : loopedVia
        ? `Looped back to ${dest.name} via ${loopedVia} (manual)`
        : `Moved to ${dest.name} (manual)`,
  );

  return c.json({ ok: true, to_step: dest, completed: isEnd, looped_via: loopedVia });
});

// ---------------------------------------------------------------------------
// POST /runs/:id/withdraw — pull a contact out of a flow.
// ---------------------------------------------------------------------------
flowRoutes.post('/runs/:id/withdraw', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');
  const body = z
    .object({ reason: z.string().max(500).optional().nullable() })
    .safeParse(await c.req.json().catch(() => ({})));
  const reason = body.success ? body.data.reason ?? null : null;

  const { data: run } = await db
    .from('flow_run')
    .select('id, person_id, flow_id, status')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (!run) return c.json({ error: 'run not found' }, 404);

  const { error } = await db
    .from('flow_run')
    .update({ status: 'withdrawn', withdrawn_reason: reason, completed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return c.json({ error: error.message }, 500);

  await db
    .from('flow_task')
    .update({ status: 'cancelled' })
    .eq('flow_run_id', id)
    .in('status', ['open', 'in_progress']);

  const { data: flow } = await db.from('flow_definition').select('name').eq('id', run.flow_id).single();
  const appId = await resolveAppId(db, ctx.appId);
  await writeActivity(db, appId, ctx.workspaceId, ctx.userId, run.person_id, 'flow.run.withdrawn', `Withdrawn from ${flow?.name ?? 'flow'}`);

  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// PATCH /tasks/:id — update a task (typically mark done).
// ---------------------------------------------------------------------------
const PatchTask = z.object({
  status: z.enum(['open', 'in_progress', 'done', 'cancelled']).optional(),
  title: z.string().min(1).max(200).optional(),
  due_at: z.string().datetime().optional().nullable(),
});

flowRoutes.patch('/tasks/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');
  const body = PatchTask.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const patch: Record<string, unknown> = {};
  if (body.data.status !== undefined) {
    patch.status = body.data.status;
    if (body.data.status === 'done') {
      patch.completed_at = new Date().toISOString();
      patch.completed_by = ctx.userId;
    }
  }
  if (body.data.title !== undefined) patch.title = body.data.title;
  if (body.data.due_at !== undefined) patch.due_at = body.data.due_at;
  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing to update' }, 400);

  const { data: task, error } = await db
    .from('flow_task')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, status, contact_id, title')
    .single();
  if (error) {
    console.error('[flow] patch task', error);
    return c.json({ error: error.message }, 500);
  }

  if (body.data.status === 'done' && task?.contact_id) {
    const appId = await resolveAppId(db, ctx.appId);
    await writeActivity(db, appId, ctx.workspaceId, ctx.userId, task.contact_id, 'flow.task.completed', `Task done: ${task.title}`);
  }

  return c.json({ task });
});

// ---------------------------------------------------------------------------
// GET /tasks — caller's open tasks across flows (Phase E uses this too).
// ?scope=mine (default) | all
// ---------------------------------------------------------------------------
flowRoutes.get('/tasks', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const scope = c.req.query('scope') ?? 'mine';
  const status = c.req.query('status') ?? 'open';

  let q = db
    .from('flow_task')
    .select(
      'id, title, description, actor_type, status, due_at, flow_run_id, contact_id, assignee_user_id, contact:contact_id (first_name, last_name)',
    )
    .is('deleted_at', null)
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (status !== 'all') q = q.in('status', status === 'open' ? ['open', 'in_progress'] : [status]);
  if (scope === 'mine') q = q.eq('assignee_user_id', ctx.userId);

  const { data, error } = await q;
  if (error) {
    console.error('[flow] list tasks', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ items: data ?? [] });
});

// ---------------------------------------------------------------------------
// GET /contacts/:personId/runs — a person's runs across flows (contact tab).
// ---------------------------------------------------------------------------
flowRoutes.get('/contacts/:personId/runs', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const personId = c.req.param('personId');
  const { data, error } = await db
    .from('flow_run')
    .select(
      'id, status, entered_at, completed_at, flow:flow_id (id, name, scope), step:current_step_id (key, name, kind)',
    )
    .eq('person_id', personId)
    .is('deleted_at', null)
    .order('entered_at', { ascending: false });
  if (error) {
    console.error('[flow] contact runs', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ items: data ?? [] });
});

// ---------------------------------------------------------------------------
// GET /runs — all visible runs (for Contacts "in motion" + dashboard).
// ?status=active (default) | all
// ---------------------------------------------------------------------------
flowRoutes.get('/runs', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const status = c.req.query('status') ?? 'active';
  let q = db
    .from('flow_run')
    .select(
      'id, status, entered_at, current_step_entered_at, person:person_id (id, first_name, last_name, email), flow:flow_id (id, name), step:current_step_id (key, name, kind)',
    )
    .is('deleted_at', null)
    .order('current_step_entered_at', { ascending: false });
  if (status !== 'all') q = q.eq('status', status);
  const { data, error } = await q;
  if (error) {
    console.error('[flow] list all runs', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ items: data ?? [] });
});

// ---------------------------------------------------------------------------
// POST /tasks — create a manual task (assigned to the caller by default).
// ---------------------------------------------------------------------------
const CreateTask = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  due_at: z.string().datetime().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  flow_run_id: z.string().uuid().optional().nullable(),
});

flowRoutes.post('/tasks', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const body = CreateTask.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const { data, error } = await db
    .from('flow_task')
    .insert({
      workspace_id: ctx.workspaceId,
      flow_run_id: body.data.flow_run_id ?? null,
      title: body.data.title,
      description: body.data.description ?? null,
      actor_type: 'personal',
      assignee_user_id: ctx.userId,
      contact_id: body.data.contact_id ?? null,
      due_at: body.data.due_at ?? null,
      status: 'open',
      created_by: ctx.userId,
    })
    .select('id, title, status')
    .single();
  if (error) {
    console.error('[flow] create task', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ task: data }, 201);
});
