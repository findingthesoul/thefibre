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
  sort: number;
};

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
      sort: 0,
    }));
}

/** Group by the day it belongs to — what the panel renders. */
export type TaskGroups = {
  overdue: TaskItem[]; today: TaskItem[]; tomorrow: TaskItem[];
  this_week: TaskItem[]; later: TaskItem[]; no_date: TaskItem[];
};

export function groupByDay(items: TaskItem[], now = new Date()): TaskGroups {
  const today = isoDay(now);
  const tomorrow = isoDay(new Date(now.getTime() + DAY));
  const weekEnd = isoDay(new Date(now.getTime() + 7 * DAY));
  const out: TaskGroups = { overdue: [], today: [], tomorrow: [], this_week: [], later: [], no_date: [] };
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

  const db = userClient(ctx.jwt);
  const { data: rows, error } = await db
    .from('user_task')
    .select('id, title, due_on, app_id, subject_kind, subject_id, subject_label, href, source_app, source_ref, state, snoozed_until, done_at, sort, app:app_id (slug)')
    .eq('workspace_id', ctx.workspaceId)
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
    state: r.state as TaskItem['state'],
    snoozed_until: (r.snoozed_until as string | null) ?? null,
    done_at: (r.done_at as string | null) ?? null,
    sort: (r.sort as number) ?? 0,
  }));

  // The archive is simply the done half of the same list — ticked items stay
  // for seven days so a mistake can be untidied (Sjoerd, 2026-09-22).
  if (view === 'archive') {
    const done = mine.filter((i) => i.state === 'done');
    return c.json({ view, items: done, groups: { done } });
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
  const all = [...typed, ...composed].filter((i) => !appFilter || i.app === appFilter);
  return c.json({ view, items: all, groups: groupByDay(all) });
});

const NewTask = z.object({
  title: z.string().min(1).max(300),
  due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  app: z.string().max(60).nullable().optional(),
  subject_kind: z.enum(['person', 'organisation', 'thread', 'flow_run', 'booking', 'other']).nullable().optional(),
  subject_id: z.string().uuid().nullable().optional(),
  subject_label: z.string().max(200).nullable().optional(),
  href: z.string().max(500).nullable().optional(),
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
  const { data, error } = await adminClient
    .from('user_task')
    .insert({
      user_id: ctx.userId,
      workspace_id: ctx.workspaceId,
      title: body.data.title.trim(),
      due_on: body.data.due_on ?? null,
      app_id: appId,
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
  const { error } = await adminClient.from('user_task').upsert(
    {
      user_id: ctx.userId,
      workspace_id: ctx.workspaceId,
      title: body.data.title ?? body.data.subject_label ?? 'Task',
      source_app: body.data.source_app,
      source_ref: body.data.source_ref,
      app_id: appId,
      href: body.data.href ?? null,
      state,
      snoozed_until: body.data.snoozed_until ?? null,
      done_at: state === 'done' ? new Date().toISOString() : null,
      sort: body.data.sort ?? Date.now(),
    },
    { onConflict: 'user_id,source_app,source_ref' },
  );
  if (error) return c.json({ error: error.message }, 500);
  await passThroughCompletion(body.data.source_app, body.data.source_ref, ctx.userId, state === 'done');
  return c.json({ ok: true });
});

// DELETE /api/v1/me/tasks/:id — a typed row the person no longer wants.
myTasksRoutes.delete('/:id', async (c) => {
  const ctx = c.get('ctx');
  const { error } = await adminClient
    .from('user_task')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('user_id', ctx.userId)
    .is('source_app', null);
  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

/**
 * Ticked items are kept for seven days, then dropped (Sjoerd: "there is an
 * archive… cleaned after 7 days"). Idempotent, so the scheduler may call it
 * as often as it likes. A dropped row for an app's item is only the ANSWER;
 * the app's own row is untouched.
 */
export async function cleanFinishedTasks(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * DAY).toISOString();
  const { data, error } = await adminClient
    .from('user_task')
    .delete()
    .eq('state', 'done')
    .lt('done_at', cutoff)
    .select('id');
  if (error) {
    console.warn('[tasks] archive cleanup', error.message);
    return 0;
  }
  return (data ?? []).length;
}
