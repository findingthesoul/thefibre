// The app-facing Flow surface — docs/brief-flow-as-planner-engine.md.
//
// Why this file exists instead of allow-listing /api/v1/flow/*: every route in
// routes/flow.ts runs on `userClient(ctx.jwt)` and is bounded by RLS acting on
// a real signed-in user. There is no user behind an app key, so those routes
// would deny everything. This mirrors the choice already made for persons and
// organisations — the app-facing equivalents live under /apps/:slug/* and
// filter by workspace explicitly on the service-role client.
//
// The rules this surface enforces, none of which RLS can express for a
// credential with no user:
//
//   * App keys only. A human belongs in Flow's own UI; letting a user session
//     in here would hand any workspace member a way around Flow's app
//     membership and personal/team scoping.
//   * An app touches only the runs it owns — `source_app = <the key's app>`.
//     Never another app's runs, never a run a person started in Flow.
//   * Reading definitions is limited to workspace-scoped flows. Personal and
//     team flows are somebody's private working set, not a public capability.
//   * Authoring stays out. There is no route here that edits a flow, its
//     steps, transitions or gates — `read:flows` is a consume scope.
//
// Steps are addressed by `key`, not uuid: an external app should not have to
// carry platform identifiers it cannot interpret.
//
// ===========================================================================
// THE CONTRACT — read this before changing any response in this file.
// ===========================================================================
//
// This file is not an internal route module. It is a PUBLISHED CONTRACT that
// apps outside this repository are written against, and it is deliberately not
// the shape of Flow's tables. That indirection is the whole point: Flow's
// schema can be refactored — as it was in 0.16.0, when flow_task gained
// step_id and the derivation this file used to do was deleted — without any
// consumer noticing, because what goes over the wire is a shape we chose.
//
// The indirection only pays if the shape holds still. So:
//
//   ADDITIVE ONLY. Add a field. Never rename one, never remove one, never
//   change a field's type or the meaning of a value. A response key that has
//   shipped is permanent.
//
//   Renaming is the trap, because it looks harmless from in here. 0.15.0
//   returned `step_filed` from the create-task route and 0.16.0 renamed it to
//   `step_key`. Nothing consumed it yet, so nothing broke — but nothing
//   stopped it either. That is the mistake this comment exists to prevent.
//
//   Semantics count as shape. Making `status` mean something new, or letting
//   `tasks` exclude cancelled ones, breaks a caller exactly as hard as
//   deleting the field, and no type checker will tell you.
//
// If a change genuinely cannot be additive, do NOT quietly break it: add a
// second, versioned path alongside and let the manifest say which one an app
// expects. That has not been needed yet and should not be built until it is.
//
// scripts/verify-external-app.mjs asserts the response shape of every route
// here (see CONTRACT_SHAPES). If you remove or rename a key, that run fails.
// Fix the change, not the test — unless you are deliberately adding, in which
// case add the key to both.

import type { Context, Hono } from 'hono';
import { z } from 'zod';
import { adminClient } from '../db.js';
import { materialiseAllSteps, materialiseTasksForStep } from './flow.js';
import type { RequestContext } from '../middleware/app-context.js';

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * This surface is for app keys. A user session reaching it would bypass Flow's
 * RLS entirely (the handlers run on the service-role client), so refuse rather
 * than half-enforce.
 */
function appKeyOnly(c: Context): RequestContext | null {
  const ctx = c.get('ctx') as RequestContext;
  return ctx.auth === 'app_key' ? ctx : null;
}

function notForUsers(c: Context) {
  return c.json(
    {
      error:
        'this surface is for app keys; a signed-in user should use /api/v1/flow/* which is bounded by Flow’s own permissions',
    },
    403,
  );
}

/** The app's own run, or null. Every run-scoped handler starts here. */
async function ownRun(ctx: RequestContext, runId: string) {
  const { data } = await adminClient
    .from('flow_run')
    .select(
      'id, flow_id, flow_version_id, person_id, organisation_id, subject_label, current_step_id, status, source_app, source_ref, entered_at',
    )
    .eq('id', runId)
    .eq('workspace_id', ctx.workspaceId)
    .eq('source_app', ctx.appId)
    .is('deleted_at', null)
    .maybeSingle();
  return data;
}

async function stepByKey(versionId: string, key: string) {
  const { data } = await adminClient
    .from('flow_step')
    .select('id, key, name, kind, ordinal')
    .eq('flow_version_id', versionId)
    .eq('key', key)
    .maybeSingle();
  return data;
}

async function resolveAppRow(slug: string) {
  const { data } = await adminClient.from('app').select('id').eq('slug', slug).maybeSingle();
  return data;
}

/**
 * Step keys by step id, for one version. `flow_task.step_id` is a stored fact
 * since 0.16.0 — this used to reconstruct it through whichever template made
 * the task, which left a manually added task belonging to no step at all.
 */
async function stepKeyMap(versionId: string): Promise<Map<string, string>> {
  const { data } = await adminClient
    .from('flow_step')
    .select('id, key')
    .eq('flow_version_id', versionId);
  return new Map((data ?? []).map((s) => [s.id as string, s.key as string]));
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const StartRun = z
  .object({
    person_id: z.string().uuid().optional().nullable(),
    organisation_id: z.string().uuid().optional().nullable(),
    subject_label: z.string().min(1).max(200).optional().nullable(),
    /** The app's own id for the thing this run tracks. Makes creation idempotent. */
    source_ref: z.string().uuid().optional().nullable(),
  })
  .refine((v) => v.person_id || v.organisation_id || v.subject_label, {
    message: 'a run needs a subject: person_id, organisation_id, or subject_label',
  });

const MoveRun = z.object({ step_key: z.string().min(1) });

const NewTask = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(4000).optional().nullable(),
  step_key: z.string().min(1).optional().nullable(),
});

const PatchTask = z.object({
  status: z.enum(['open', 'in_progress', 'done', 'cancelled']).optional(),
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(4000).optional().nullable(),
});

const NoteBody = z.object({ body: z.string().max(20000) });

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
export function registerAppFlowRoutes(appsRoutes: Hono) {
  // -------------------------------------------------------------------------
  // GET /apps/:slug/flow/flows — the workspace flows this app may consume.
  // -------------------------------------------------------------------------
  appsRoutes.get('/:slug/flow/flows', async (c) => {
    const ctx = appKeyOnly(c);
    if (!ctx) return notForUsers(c);

    const { data, error } = await adminClient
      .from('flow_definition')
      .select('id, name, description, lifecycle, progression, system_key, current_version_id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('scope', 'workspace')
      .is('deleted_at', null)
      .not('current_version_id', 'is', null)
      .order('name');
    if (error) {
      console.error('[app-flow] list flows', error);
      return c.json({ error: error.message }, 500);
    }
    return c.json({ flows: data ?? [] });
  });

  // -------------------------------------------------------------------------
  // GET /apps/:slug/flow/flows/:id — the published shape: steps in order, with
  // the task templates each one seeds. Enough to render the whole process.
  // -------------------------------------------------------------------------
  appsRoutes.get('/:slug/flow/flows/:id', async (c) => {
    const ctx = appKeyOnly(c);
    if (!ctx) return notForUsers(c);

    const { data: flow } = await adminClient
      .from('flow_definition')
      .select('id, name, description, lifecycle, progression, system_key, current_version_id, scope')
      .eq('id', c.req.param('id'))
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!flow || flow.scope !== 'workspace') return c.json({ error: 'flow not found' }, 404);
    if (!flow.current_version_id) return c.json({ error: 'flow has no published version' }, 400);

    const { data: steps } = await adminClient
      .from('flow_step')
      .select('id, key, name, description, kind, ordinal')
      .eq('flow_version_id', flow.current_version_id)
      .order('ordinal');

    const stepIds = (steps ?? []).map((s) => s.id);
    const { data: defaults } = stepIds.length
      ? await adminClient
          .from('flow_step_default_task')
          .select('id, step_id, title, description, actor_type, ordinal')
          .in('step_id', stepIds)
          .order('ordinal')
      : { data: [] as Record<string, unknown>[] };

    const byStep = new Map<string, unknown[]>();
    for (const d of defaults ?? []) {
      const arr = byStep.get(d.step_id as string) ?? [];
      arr.push({ title: d.title, description: d.description, actor_type: d.actor_type });
      byStep.set(d.step_id as string, arr);
    }

    return c.json({
      id: flow.id,
      name: flow.name,
      description: flow.description,
      lifecycle: flow.lifecycle,
      // 'open' = every step's tasks exist from run creation and nothing is
      // ever overdue. 'gated' = the state machine; tasks arrive with the run.
      progression: flow.progression,
      system_key: flow.system_key,
      version_id: flow.current_version_id,
      steps: (steps ?? []).map((s) => ({
        key: s.key,
        name: s.name,
        description: s.description,
        kind: s.kind,
        ordinal: s.ordinal,
        default_tasks: byStep.get(s.id) ?? [],
      })),
    });
  });

  // -------------------------------------------------------------------------
  // POST /apps/:slug/flow/flows/:id/runs — start a run this app owns.
  //
  // Idempotent on source_ref: the unique index on
  // (flow_id, source_app, source_ref) means a retried create returns the run
  // that already exists rather than a duplicate or a 409.
  // -------------------------------------------------------------------------
  appsRoutes.post('/:slug/flow/flows/:id/runs', async (c) => {
    const ctx = appKeyOnly(c);
    if (!ctx) return notForUsers(c);
    const body = StartRun.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const flowId = c.req.param('id');
    const { data: flow } = await adminClient
      .from('flow_definition')
      .select('id, name, scope, team_id, current_version_id, lifecycle, progression')
      .eq('id', flowId)
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!flow || flow.scope !== 'workspace') return c.json({ error: 'flow not found' }, 404);
    if (!flow.current_version_id) {
      return c.json({ error: 'flow has no published version — publish it first' }, 400);
    }
    if (flow.lifecycle === 'closed' || flow.lifecycle === 'archived') {
      return c.json({ error: `flow is ${flow.lifecycle} — no new runs can start` }, 400);
    }

    if (body.data.source_ref) {
      const existing = await adminClient
        .from('flow_run')
        .select('id')
        .eq('flow_id', flowId)
        .eq('source_app', ctx.appId)
        .eq('source_ref', body.data.source_ref)
        .is('deleted_at', null)
        .maybeSingle();
      if (existing.data) return c.json({ id: existing.data.id, created: false });
    }

    const { data: entry } = await adminClient
      .from('flow_step')
      .select('id, name')
      .eq('flow_version_id', flow.current_version_id)
      .eq('kind', 'entry')
      .maybeSingle();
    if (!entry) return c.json({ error: 'published version has no entry step' }, 500);

    const { data: run, error: rErr } = await adminClient
      .from('flow_run')
      .insert({
        workspace_id: ctx.workspaceId,
        flow_id: flowId,
        flow_version_id: flow.current_version_id,
        person_id: body.data.person_id ?? null,
        organisation_id: body.data.organisation_id ?? null,
        subject_label: body.data.subject_label ?? null,
        current_step_id: entry.id,
        owner_user_id: null, // an app owns this run, not a person
        source_app: ctx.appId,
        source_ref: body.data.source_ref ?? null,
        status: 'active',
      })
      .select('id')
      .single();
    if (rErr || !run) {
      console.error('[app-flow] start run', rErr);
      return c.json({ error: rErr?.message ?? 'could not start run' }, 500);
    }

    // An open flow gets its whole sequence now: every step reachable, every
    // step with a real status, no due dates anywhere.
    const seed = {
      workspaceId: ctx.workspaceId,
      runId: run.id,
      personId: body.data.person_id ?? null,
      versionId: flow.current_version_id,
      ownerUserId: null,
      teamId: flow.team_id,
      createdBy: null,
    };
    if (flow.progression === 'open') {
      await materialiseAllSteps(adminClient, seed);
    } else {
      await materialiseTasksForStep(adminClient, { ...seed, stepId: entry.id });
    }

    // The data wall: type + subject only, and only when there is a person to
    // hang it on (activity.person_id is not null by design).
    if (body.data.person_id) {
      const app = await resolveAppRow(ctx.appId);
      if (app) {
        const { error } = await adminClient.from('activity').insert({
          workspace_id: ctx.workspaceId,
          person_id: body.data.person_id,
          app_id: app.id,
          type: 'flow.run.started',
          subject: `Added to ${flow.name}`,
          occurred_at: new Date().toISOString(),
          created_by: null,
        });
        if (error) console.error('[app-flow] activity', error);
      }
    }

    return c.json({ id: run.id, created: true }, 201);
  });

  // -------------------------------------------------------------------------
  // GET /apps/:slug/flow/runs — this app's runs. Never anyone else's.
  // -------------------------------------------------------------------------
  appsRoutes.get('/:slug/flow/runs', async (c) => {
    const ctx = appKeyOnly(c);
    if (!ctx) return notForUsers(c);

    let q = adminClient
      .from('flow_run')
      .select(
        'id, flow_id, person_id, organisation_id, subject_label, current_step_id, status, source_ref, entered_at',
      )
      .eq('workspace_id', ctx.workspaceId)
      .eq('source_app', ctx.appId)
      .is('deleted_at', null)
      .order('entered_at', { ascending: false })
      .limit(200);
    const flowId = c.req.query('flow_id');
    if (flowId) q = q.eq('flow_id', flowId);

    const { data, error } = await q;
    if (error) {
      console.error('[app-flow] list runs', error);
      return c.json({ error: error.message }, 500);
    }
    return c.json({ runs: data ?? [] });
  });

  // -------------------------------------------------------------------------
  // GET /apps/:slug/flow/runs/:id — the run, its tasks grouped by step, and
  // this app's note per step. The shape a step-by-step UI actually renders.
  // -------------------------------------------------------------------------
  appsRoutes.get('/:slug/flow/runs/:id', async (c) => {
    const ctx = appKeyOnly(c);
    if (!ctx) return notForUsers(c);
    const run = await ownRun(ctx, c.req.param('id'));
    if (!run) return c.json({ error: 'run not found' }, 404);

    const { data: steps } = await adminClient
      .from('flow_step')
      .select('id, key, name, description, kind, ordinal')
      .eq('flow_version_id', run.flow_version_id)
      .order('ordinal');

    const { data: tasks } = await adminClient
      .from('flow_task')
      .select('id, title, description, status, due_at, step_id, completed_at')
      .eq('flow_run_id', run.id)
      .is('deleted_at', null)
      .order('created_at');

    const app = await resolveAppRow(ctx.appId);
    const { data: notes } = app
      ? await adminClient
          .from('flow_run_note')
          .select('step_id, body, created_at')
          .eq('flow_run_id', run.id)
          .eq('app_id', app.id)
          .is('deleted_at', null)
      : { data: [] as { step_id: string | null; body: string }[] };

    const keyByStepId = await stepKeyMap(run.flow_version_id);
    const noteByStep = new Map(
      (notes ?? []).map((n) => [n.step_id as string, n.body as string]),
    );
    const currentKey = (steps ?? []).find((s) => s.id === run.current_step_id)?.key ?? null;

    const byStepKey = new Map<string, unknown[]>();
    const unfiled: unknown[] = [];
    for (const t of tasks ?? []) {
      const shaped = {
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        due_at: t.due_at,
        completed_at: t.completed_at,
      };
      const key = t.step_id ? keyByStepId.get(t.step_id) : undefined;
      if (!key) {
        unfiled.push(shaped);
        continue;
      }
      const arr = byStepKey.get(key) ?? [];
      arr.push(shaped);
      byStepKey.set(key, arr);
    }

    return c.json({
      id: run.id,
      flow_id: run.flow_id,
      person_id: run.person_id,
      organisation_id: run.organisation_id,
      subject_label: run.subject_label,
      source_ref: run.source_ref,
      status: run.status,
      entered_at: run.entered_at,
      // Where the run last was. A companion-style app can ignore it: every
      // step is reachable, and per-step status comes from the task counts.
      current_step_key: currentKey,
      steps: (steps ?? []).map((s) => {
        const st = (byStepKey.get(s.key) ?? []) as { status: string }[];
        const done = st.filter((t) => t.status === 'done' || t.status === 'cancelled').length;
        return {
          key: s.key,
          name: s.name,
          description: s.description,
          kind: s.kind,
          ordinal: s.ordinal,
          tasks: st,
          note: noteByStep.get(s.id) ?? null,
          // none done → not_started, some → in_progress, all → done.
          status: st.length === 0 ? 'not_started' : done === 0 ? 'not_started' : done === st.length ? 'done' : 'in_progress',
        };
      }),
      // Tasks with no step. Only legacy rows whose step could not be
      // recovered at backfill time land here; anything created since 0.16.0
      // carries a step_id.
      unfiled_tasks: unfiled,
    });
  });

  // -------------------------------------------------------------------------
  // POST /apps/:slug/flow/runs/:id/move — reposition to any step.
  //
  // Deliberately the /move semantics, not /transition: no gate, no edge
  // required. A companion app lets people wander.
  // -------------------------------------------------------------------------
  appsRoutes.post('/:slug/flow/runs/:id/move', async (c) => {
    const ctx = appKeyOnly(c);
    if (!ctx) return notForUsers(c);
    const body = MoveRun.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const run = await ownRun(ctx, c.req.param('id'));
    if (!run) return c.json({ error: 'run not found' }, 404);
    if (run.status !== 'active') return c.json({ error: `run is ${run.status}` }, 400);

    const target = await stepByKey(run.flow_version_id, body.data.step_key);
    if (!target) return c.json({ error: 'step not found in this flow version' }, 404);
    if (target.id === run.current_step_id) return c.json({ ok: true, step_key: target.key });

    const { error } = await adminClient
      .from('flow_run')
      .update({ current_step_id: target.id, current_step_entered_at: new Date().toISOString() })
      .eq('id', run.id);
    if (error) {
      console.error('[app-flow] move run', error);
      return c.json({ error: error.message }, 500);
    }

    // No task materialisation on arrival. An app-owned run gets its tasks when
    // it is created; re-entering a step must not seed a second copy.
    return c.json({ ok: true, step_key: target.key });
  });

  // -------------------------------------------------------------------------
  // POST /apps/:slug/flow/runs/:id/tasks — a task the organiser added.
  // -------------------------------------------------------------------------
  appsRoutes.post('/:slug/flow/runs/:id/tasks', async (c) => {
    const ctx = appKeyOnly(c);
    if (!ctx) return notForUsers(c);
    const body = NewTask.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const run = await ownRun(ctx, c.req.param('id'));
    if (!run) return c.json({ error: 'run not found' }, 404);

    let stepId: string | null = null;
    if (body.data.step_key) {
      const step = await stepByKey(run.flow_version_id, body.data.step_key);
      if (!step) return c.json({ error: 'step not found in this flow version' }, 404);
      stepId = step.id;
    }

    const { data, error } = await adminClient
      .from('flow_task')
      .insert({
        workspace_id: ctx.workspaceId,
        flow_run_id: run.id,
        step_id: stepId,
        title: body.data.title,
        description: body.data.description ?? null,
        actor_type: 'personal',
        contact_id: run.person_id,
        status: 'open',
        due_at: null, // companion apps do not set deadlines
        created_by: null,
      })
      .select('id')
      .single();
    if (error || !data) {
      console.error('[app-flow] create task', error);
      return c.json({ error: error?.message ?? 'could not create task' }, 500);
    }
    return c.json({ id: data.id, step_key: body.data.step_key ?? null }, 201);
  });

  // -------------------------------------------------------------------------
  // PATCH /apps/:slug/flow/tasks/:id — check it off (or back on).
  // -------------------------------------------------------------------------
  appsRoutes.patch('/:slug/flow/tasks/:id', async (c) => {
    const ctx = appKeyOnly(c);
    if (!ctx) return notForUsers(c);
    const body = PatchTask.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    // The task must belong to a run this app owns.
    const { data: task } = await adminClient
      .from('flow_task')
      .select('id, flow_run_id')
      .eq('id', c.req.param('id'))
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!task?.flow_run_id) return c.json({ error: 'task not found' }, 404);
    if (!(await ownRun(ctx, task.flow_run_id))) return c.json({ error: 'task not found' }, 404);

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.data.title !== undefined) patch.title = body.data.title;
    if (body.data.description !== undefined) patch.description = body.data.description;
    if (body.data.status !== undefined) {
      patch.status = body.data.status;
      patch.completed_at = body.data.status === 'done' ? new Date().toISOString() : null;
      patch.completed_by = null;
    }

    const { error } = await adminClient.from('flow_task').update(patch).eq('id', task.id);
    if (error) {
      console.error('[app-flow] patch task', error);
      return c.json({ error: error.message }, 500);
    }
    return c.json({ ok: true });
  });

  // -------------------------------------------------------------------------
  // The reflection note — GET/PUT one body per (run, step) for THIS app.
  //
  // Item 3 of the brief. flow_run_note's RLS requires
  // has_app_membership('fibre-flow'), which an app key has no way to satisfy,
  // so the policy is expressed here instead: the note is reachable iff the run
  // is one this app owns. app_id keeps an app's single rewritten reflection
  // separate from the append log a person keeps in Flow.
  // -------------------------------------------------------------------------
  appsRoutes.get('/:slug/flow/runs/:id/steps/:step_key/note', async (c) => {
    const ctx = appKeyOnly(c);
    if (!ctx) return notForUsers(c);
    const run = await ownRun(ctx, c.req.param('id'));
    if (!run) return c.json({ error: 'run not found' }, 404);
    const step = await stepByKey(run.flow_version_id, c.req.param('step_key'));
    if (!step) return c.json({ error: 'step not found in this flow version' }, 404);
    const app = await resolveAppRow(ctx.appId);
    if (!app) return c.json({ error: 'app not found' }, 500);

    const { data } = await adminClient
      .from('flow_run_note')
      .select('body, created_at')
      .eq('flow_run_id', run.id)
      .eq('step_id', step.id)
      .eq('app_id', app.id)
      .is('deleted_at', null)
      .maybeSingle();
    return c.json({ step_key: step.key, body: data?.body ?? null, updated_at: data?.created_at ?? null });
  });

  appsRoutes.put('/:slug/flow/runs/:id/steps/:step_key/note', async (c) => {
    const ctx = appKeyOnly(c);
    if (!ctx) return notForUsers(c);
    const body = NoteBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);

    const run = await ownRun(ctx, c.req.param('id'));
    if (!run) return c.json({ error: 'run not found' }, 404);
    const step = await stepByKey(run.flow_version_id, c.req.param('step_key'));
    if (!step) return c.json({ error: 'step not found in this flow version' }, 404);
    const app = await resolveAppRow(ctx.appId);
    if (!app) return c.json({ error: 'app not found' }, 500);

    // Empty body clears the note rather than storing a blank one.
    if (body.data.body.trim() === '') {
      await adminClient
        .from('flow_run_note')
        .update({ deleted_at: new Date().toISOString() })
        .eq('flow_run_id', run.id)
        .eq('step_id', step.id)
        .eq('app_id', app.id)
        .is('deleted_at', null);
      return c.json({ ok: true, body: null });
    }

    const { data: existing } = await adminClient
      .from('flow_run_note')
      .select('id')
      .eq('flow_run_id', run.id)
      .eq('step_id', step.id)
      .eq('app_id', app.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      const { error } = await adminClient
        .from('flow_run_note')
        .update({ body: body.data.body })
        .eq('id', existing.id);
      if (error) {
        console.error('[app-flow] update note', error);
        return c.json({ error: error.message }, 500);
      }
      return c.json({ ok: true, body: body.data.body });
    }

    const { error } = await adminClient.from('flow_run_note').insert({
      workspace_id: ctx.workspaceId,
      flow_run_id: run.id,
      step_id: step.id,
      app_id: app.id,
      body: body.data.body,
      created_by: null,
    });
    if (error) {
      console.error('[app-flow] insert note', error);
      return c.json({ error: error.message }, 500);
    }
    return c.json({ ok: true, body: body.data.body }, 201);
  });
}
