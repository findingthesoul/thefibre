// ===========================================================================
// "To do" — GET/POST/PATCH /api/v1/tasks
//
// One person's own list, across the apps (docs/personal-todo-proposal.md).
//
// Mounted at /api/v1/tasks, NOT under /me: that prefix is a PUBLIC_PREFIX in
// middleware/app-context.ts for the visitor portal, where the participant JWT
// is checked inside the handler. A staff route under it never receives ctx.
//
// ---------------------------------------------------------------------------
// THE DATA WALL (brief §2) — read this before adding a source
// ---------------------------------------------------------------------------
// This route reads more than one app's schema, which apps are forbidden to do.
// It is allowed here for the same reason /me/portal is: the wall stops APPS
// reading each OTHER's data; this is the PLATFORM composing, for one user, a
// view of that user's own work. No app gains a read it did not have.
//
// Three rules keep that honest, and a new source must obey all three:
//
//   1. PER SEAT. A source's rows appear only for a user who holds that app's
//      membership (hasAppMembership). No seat, no row — otherwise the list
//      becomes a side door into an app.
//   2. REFERENCE AND LABEL, NEVER CONTENT. A row carries app, a short title,
//      a date and a link back. The discipline of the activity log: type and
//      subject, never the body.
//   3. YOURS ONLY. Every query is filtered to this user (assignee, host,
//      organiser). Never "everything in the workspace, for reference".
//
// State (ticked, snoozed, dragged) lives in public.user_task, keyed by
// (source_app, source_ref). The app's own row is never written by this file,
// with one deliberate exception: ticking a Flow task passes through to Flow,
// because a Flow task HAS a completion and two truths would be worse than one.
// ===========================================================================

import { Hono } from 'hono';
import { emptyTodoGroups, type TodoGroupKey } from '@thefibre/shared/todo-groups';
import { z } from 'zod';
import { userClient, adminClient } from '../db.js';

export const myTasksRoutes = new Hono();

/** A row as the list renders it — the same shape whatever it came from. */
export type TaskItem = {
  id: string | null;
  source: { app: string; ref: string } | null;
  title: string;
  due_on: string | null;
  app: string | null;
  subject: { kind: string; id: string | null; label: string | null } | null;
  href: string | null;
  state: 'open' | 'done' | 'snoozed';
  snoozed_until: string | null;
  done_at: string | null;
  /** Which team this is for — a label on your own row, never a share. */
  team: { id: string; name: string } | null;
  /** Filed out of the Archive view by the seven-day sweep; the row remains. */
  archived_at?: string | null;
  sort: number;
};

/** PostgREST hands an embedded row back as an object or a one-element array
 *  depending on the shape it infers; both mean the same thing here. */
function teamOf(v: unknown): { id: string; name: string } | null {
  const row = Array.isArray(v) ? v[0] : v;
  if (!row || typeof row !== 'object') return null;
  const { id, name } = row as { id?: string; name?: string };
  return id ? { id, name: name ?? '' } : null;
}

/** Teams in THIS workspace you are an active member of. The only teams you
 *  may file a to-do under: tagging it with a team you are not in would be
 *  claiming a place you do not hold. */
async function myTeams(userId: string, workspaceId: string): Promise<{ id: string; name: string }[]> {
  // `team` has is_active, NOT archived_at — and a select naming a column that
  // does not exist is a 400 PostgREST answers at RUNTIME, which TypeScript
  // never reads. Asking for archived_at here emptied the picker silently and
  // made every filed to-do a 403 (caught on staging before it shipped,
  // 2026-09-23; the same class of bug as the three latent 400s of 2026-09-15).
  const { data, error } = await adminClient
    .from('team_member')
    .select('team:team_id (id, name, workspace_id, is_active)')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) {
    console.warn('[tasks] my teams', error.message);
    return [];
  }
  type TeamRow = { id: string; name: string; workspace_id: string; is_active: boolean | null };
  return (data ?? [])
    .map((r) => (Array.isArray(r.team) ? r.team[0] : r.team) as TeamRow | null)
    .filter((t): t is TeamRow => !!t && t.workspace_id === workspaceId && t.is_active !== false)
    .map((t) => ({ id: t.id, name: t.name }));
}

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Does this user hold a seat for the app? Rule 1 above. */
async function hasAppMembership(userId: string, slug: string): Promise<boolean> {
  const { data: app } = await adminClient.from('app').select('id').eq('slug', slug).maybeSingle();
  if (!app) return false;
  const { count } = await adminClient
    .from('app_membership')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('app_id', app.id);
  return (count ?? 0) > 0;
}

/** Flow tasks assigned to this user — the one real task table in the system. */
async function flowTasks(userId: string, workspaceId: string): Promise<TaskItem[]> {
  const { data, error } = await adminClient
    .from('flow_task')
    .select('id, title, due_at, status, flow_run_id, run:flow_run_id (subject_label, workspace_id)')
    .eq('assignee_user_id', userId)
    .in('status', ['open', 'in_progress'])
    .is('deleted_at', null)
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) {
    console.warn('[tasks] flow tasks', error.message);
    return [];
  }
  return (data ?? [])
    .filter((t) => (t.run as { workspace_id?: string } | null)?.workspace_id === workspaceId)
    .map((t) => ({
      id: null,
      source: { app: 'fibre-flow', ref: t.id as string },
      title: (t.title as string) ?? 'Task',
      due_on: t.due_at ? isoDay(new Date(t.due_at as string)) : null,
      app: 'fibre-flow',
      subject: t.flow_run_id
        ? {
            kind: 'flow_run',
            id: t.flow_run_id as string,
            label: ((t.run as { subject_label?: string } | null)?.subject_label ?? null),
          }
        : null,
      href: t.flow_run_id ? `/runs/${t.flow_run_id}` : '/tasks',
      state: 'open' as const,
      snoozed_until: null,
      done_at: null,
      // A Flow task's team is Flow's to say, not ours; it carries none here
      // rather than one we inferred.
      team: null,
      sort: 0,
    }));
}

/** Group by the day it belongs to — what the panel renders. Derived from
 *  @thefibre/shared/todo-groups so the two sides cannot name them
 *  differently: a bucket the panel does not know is one it silently drops. */
export type TaskGroups = Record<TodoGroupKey, TaskItem[]>;

export function groupByDay(items: TaskItem[], now = new Date()): TaskGroups {
  const today = isoDay(now);
  const tomorrow = isoDay(new Date(now.getTime() + DAY));
  const weekEnd = isoDay(new Date(now.getTime() + 7 * DAY));
  // The bucket names live in @thefibre/shared/todo-groups, which the panel
  // also reads — see that file for why they are not typed twice.
  const out = emptyTodoGroups<TaskItem>();
  for (const i of items) {
    // A snoozed item belongs to the day it was pushed to, not its due date.
    const day = i.state === 'snoozed' ? i.snoozed_until : i.due_on;
    if (!day) out.no_date.push(i);
    else if (day < today) out.overdue.push(i);
    else if (day === today) out.today.push(i);
    else if (day === tomorrow) out.tomorrow.push(i);
    else if (day <= weekEnd) out.this_week.push(i);
    else out.later.push(i);
  }
  const order = (a: TaskItem, b: TaskItem) => a.sort - b.sort || (a.due_on ?? '').localeCompare(b.due_on ?? '');
  for (const list of Object.values(out)) list.sort(order);
  return out;
}

// GET /api/v1/me/tasks?view=open|archive&app=<slug>
myTasksRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  const view = c.req.query('view') === 'archive' ? 'archive' : 'open';
  const appFilter = c.req.query('app') ?? null;
  // '' means "no team" — a real choice, distinct from "any team" (absent).
  const teamFilter = c.req.query('team');

  const db = userClient(ctx.jwt);
  const { data: rows, error } = await db
    .from('user_task')
    .select('id, title, due_on, app_id, subject_kind, subject_id, subject_label, href, source_app, source_ref, state, snoozed_until, done_at, archived_at, sort, app:app_id (slug), team:team_id (id, name)')
    .eq('workspace_id', ctx.workspaceId)
    .is('deleted_at', null)
    .order('sort', { ascending: true })
    .limit(500);
  if (error) return c.json({ error: error.message }, 500);

  const mine = (rows ?? []).map((r) => ({
    id: r.id as string,
    source: r.source_app ? { app: r.source_app as string, ref: r.source_ref as string } : null,
    title: r.title as string,
    due_on: (r.due_on as string | null) ?? null,
    app: ((r.app as { slug?: string } | null)?.slug ?? null),
    subject: r.subject_kind
      ? { kind: r.subject_kind as string, id: (r.subject_id as string | null) ?? null, label: (r.subject_label as string | null) ?? null }
      : null,
    href: (r.href as string | null) ?? null,
    team: teamOf(r.team),
    state: r.state as TaskItem['state'],
    snoozed_until: (r.snoozed_until as string | null) ?? null,
    done_at: (r.done_at as string | null) ?? null,
    archived_at: (r.archived_at as string | null) ?? null,
    sort: (r.sort as number) ?? 0,
  }));

  // The archive is the done half of the same list — ticked items stay for
  // seven days so a mistake can be untidied (Sjoerd, 2026-09-22). After that
  // the sweep FILES them: they leave this view and stay in the table, because
  // "cleaned" means archived and not destroyed (Sjoerd, 2026-09-23).
  if (view === 'archive') {
    const done = mine.filter((i) => i.state === 'done' && !i.archived_at);
    return c.json({ view, items: done, groups: { done }, teams: await myTeams(ctx.userId, ctx.workspaceId) });
  }

  const answered = new Map(mine.filter((i) => i.source).map((i) => [`${i.source!.app}:${i.source!.ref}`, i]));
  const composed: TaskItem[] = [];
  if (await hasAppMembership(ctx.userId, 'fibre-flow')) {
    for (const item of await flowTasks(ctx.userId, ctx.workspaceId)) {
      const state = answered.get(`${item.source!.app}:${item.source!.ref}`);
      if (state?.state === 'done') continue;              // ticked off my list
      composed.push(state ? { ...item, ...state, title: item.title, href: item.href } : item);
    }
  }

  const typed = mine.filter((i) => !i.source && i.state !== 'done');
  const all = [...typed, ...composed]
    .filter((i) => !appFilter || i.app === appFilter)
    .filter((i) =>
      teamFilter === undefined ? true : teamFilter === '' ? !i.team : i.team?.id === teamFilter,
    );
  // The teams you may file under ride the list, so the panel needs no second
  // call to draw its picker.
  return c.json({ view, items: all, groups: groupByDay(all), teams: await myTeams(ctx.userId, ctx.workspaceId) });
});

const NewTask = z.object({
  title: z.string().min(1).max(300),
  due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  app: z.string().max(60).nullable().optional(),
  subject_kind: z.enum(['person', 'organisation', 'thread', 'flow_run', 'booking', 'other']).nullable().optional(),
  subject_id: z.string().uuid().nullable().optional(),
  subject_label: z.string().max(200).nullable().optional(),
  href: z.string().max(500).nullable().optional(),
  team_id: z.string().uuid().nullable().optional(),
});

// POST /api/v1/me/tasks — a to-do somebody typed.
myTasksRoutes.post('/', async (c) => {
  const ctx = c.get('ctx');
  const body = NewTask.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  let appId: string | null = null;
  if (body.data.app) {
    const { data: app } = await adminClient.from('app').select('id').eq('slug', body.data.app).maybeSingle();
    appId = (app?.id as string | undefined) ?? null;
  }
  // A team you are not an active member of is not yours to file under —
  // checked here rather than trusted from the browser.
  let teamId: string | null = null;
  if (body.data.team_id) {
    const allowed = await myTeams(ctx.userId, ctx.workspaceId);
    if (!allowed.some((t) => t.id === body.data.team_id)) {
      return c.json({ error: 'not a member of that team' }, 403);
    }
    teamId = body.data.team_id;
  }
  const { data, error } = await adminClient
    .from('user_task')
    .insert({
      user_id: ctx.userId,
      workspace_id: ctx.workspaceId,
      title: body.data.title.trim(),
      due_on: body.data.due_on ?? null,
      app_id: appId,
      team_id: teamId,
      subject_kind: body.data.subject_kind ?? null,
      subject_id: body.data.subject_id ?? null,
      subject_label: body.data.subject_label ?? null,
      href: body.data.href ?? null,
      sort: Date.now(),
    })
    .select('id')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ id: data.id }, 201);
});

const Answer = z.object({
  state: z.enum(['open', 'done', 'snoozed']).optional(),
  snoozed_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  title: z.string().min(1).max(300).optional(),
  sort: z.number().optional(),
  // For an item an app owns: which one. The row is created on first answer.
  source_app: z.string().max(60).optional(),
  source_ref: z.string().max(200).optional(),
  app: z.string().max(60).nullable().optional(),
  subject_label: z.string().max(200).nullable().optional(),
  href: z.string().max(500).nullable().optional(),
});

/** Ticking a Flow task means it is done in Flow too — one truth, not two. */
async function passThroughCompletion(sourceApp: string, ref: string, userId: string, done: boolean) {
  if (sourceApp !== 'fibre-flow') return;
  await adminClient
    .from('flow_task')
    .update(
      done
        ? { status: 'done', completed_at: new Date().toISOString(), completed_by: userId }
        : { status: 'open', completed_at: null, completed_by: null },
    )
    .eq('id', ref)
    .eq('assignee_user_id', userId);
}

// PATCH /api/v1/me/tasks/:id — a typed row, by id.
myTasksRoutes.patch('/:id', async (c) => {
  const ctx = c.get('ctx');
  const body = Answer.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const patch: Record<string, unknown> = {};
  for (const k of ['state', 'snoozed_until', 'due_on', 'title', 'sort'] as const) {
    if (body.data[k] !== undefined) patch[k] = body.data[k];
  }
  if (body.data.state === 'done') patch.done_at = new Date().toISOString();
  if (body.data.state === 'open') { patch.done_at = null; patch.snoozed_until = null; }

  const { data, error } = await adminClient
    .from('user_task')
    .update(patch)
    .eq('id', c.req.param('id'))
    .eq('user_id', ctx.userId)
    .select('source_app, source_ref, state')
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: 'not found' }, 404);
  if (data.source_app && body.data.state) {
    await passThroughCompletion(data.source_app as string, data.source_ref as string, ctx.userId, body.data.state === 'done');
  }
  return c.json({ ok: true });
});

// POST /api/v1/me/tasks/answer — tick or snooze something an app owns.
// Upsert on (user, source_app, source_ref): answering twice is one row.
myTasksRoutes.post('/answer', async (c) => {
  const ctx = c.get('ctx');
  const body = Answer.safeParse(await c.req.json().catch(() => null));
  if (!body.success || !body.data.source_app || !body.data.source_ref) {
    return c.json({ error: 'source_app and source_ref are required' }, 400);
  }
  let appId: string | null = null;
  if (body.data.app) {
    const { data: app } = await adminClient.from('app').select('id').eq('slug', body.data.app).maybeSingle();
    appId = (app?.id as string | undefined) ?? null;
  }
  const state = body.data.state ?? 'done';
  // Update, then insert if nothing was updated — not an upsert.
  //
  // The uniqueness that makes answering twice one row is now a PARTIAL unique
  // index (`where source_app is not null`, migration 20260923090000), because
  // as a plain constraint its NULLS NOT DISTINCT spelling also made every
  // to-do you typed collide with the last one. A bare ON CONFLICT cannot name
  // a partial index, so PostgREST's upsert can no longer be used here.
  //
  // Answering again also REVIVES a row that was filed or removed, which is why
  // both timestamps are cleared.
  const fields = {
    workspace_id: ctx.workspaceId,
    title: body.data.title ?? body.data.subject_label ?? 'Task',
    app_id: appId,
    href: body.data.href ?? null,
    state,
    snoozed_until: body.data.snoozed_until ?? null,
    done_at: state === 'done' ? new Date().toISOString() : null,
    archived_at: null,
    deleted_at: null,
    sort: body.data.sort ?? Date.now(),
  };
  const { data: updated, error: updErr } = await adminClient
    .from('user_task')
    .update(fields)
    .eq('user_id', ctx.userId)
    .eq('source_app', body.data.source_app)
    .eq('source_ref', body.data.source_ref)
    .select('id')
    .maybeSingle();
  if (updErr) return c.json({ error: updErr.message }, 500);
  if (!updated) {
    const { error } = await adminClient.from('user_task').insert({
      user_id: ctx.userId,
      source_app: body.data.source_app,
      source_ref: body.data.source_ref,
      ...fields,
    });
    if (error) return c.json({ error: error.message }, 500);
  }
  await passThroughCompletion(body.data.source_app, body.data.source_ref, ctx.userId, state === 'done');
  return c.json({ ok: true });
});

// DELETE /api/v1/me/tasks/:id — a typed row the person no longer wants.
//
// A SOFT delete: CLAUDE.md hard rule 4 is "soft delete only for personal
// data", and a to-do is personal data — its title is free text and its
// subject_label can carry another person's name. The row leaves every read;
// it does not leave the table.
myTasksRoutes.delete('/:id', async (c) => {
  const ctx = c.get('ctx');
  const { error } = await adminClient
    .from('user_task')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .eq('user_id', ctx.userId)
    .is('source_app', null)
    .is('deleted_at', null);
  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

/**
 * Ticked items sit in the Archive for seven days, then get FILED: they leave
 * the view and stay in the table.
 *
 * It used to delete them. Sjoerd was asked which he meant by "cleaned after
 * 7 days" and answered (2026-09-23): *"Should be part of the cleaning
 * practice. So I would say: archive - not delete... But there should be a
 * delete discipline."* So no timer in this system destroys a person's text.
 * The discipline he wants — somebody seeing what is old and deciding — is a
 * separate thing to build, and it needs these rows to still exist.
 *
 * Idempotent (it only touches rows not yet filed), so the scheduler may call
 * it as often as it likes. Filing an app item's row files only the ANSWER;
 * the app's own row is untouched.
 */
export async function fileFinishedTasks(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * DAY).toISOString();
  const { data, error } = await adminClient
    .from('user_task')
    .update({ archived_at: new Date().toISOString() })
    .eq('state', 'done')
    .lt('done_at', cutoff)
    .is('archived_at', null)
    .is('deleted_at', null)
    .select('id');
  if (error) {
    console.warn('[tasks] archive filing', error.message);
    return 0;
  }
  return (data ?? []).length;
}
