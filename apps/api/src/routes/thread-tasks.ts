// ===========================================================================
// A thread's to-do list, and the to-do TEMPLATES you lay onto one.
//
// Sjoerd, 2026-09-23: *"I want per thread a to do list... and people can
// insert a to do template. So templates needs a third group: to do's, with a
// list... Auto team if selected... In a thread, there should be a to do list
// button... so organisisers and hosts can see what needs to happen."*
//
// SHARED, which is why it is not the platform list. public.user_task is
// private by RLS (`user_id = current_user_id()`) and says so in its own
// migration: "not managerial". This list is the opposite — every organiser
// and host of the thread sees the same rows. So it is Thread's own content,
// like an engagement, and the platform list COMPOSES the rows assigned to
// you rather than owning them (routes/my-tasks.ts).
//
// NOT behind the Organisation-plan `todo` gate. That gate is on the cross-app
// personal list. A thread's own checklist ships with The Thread.
//
// A separate file from routes/thread.ts deliberately: that one is ~6000 lines
// and several sessions edit it at once. Mounted on the same /thread prefix in
// server.ts, so the paths read as if they lived there.
// ===========================================================================

import { Hono } from 'hono';
import { z } from 'zod';
import { userClient, adminClient } from '../db.js';
import { isWorkspaceMember, rowInWorkspace } from '../lib/workspace-refs.js';
import { filterVisibleTemplates } from '../lib/template-visibility.js';
import { can, needsPlan } from '../lib/plan.js';
import { safeHttpUrl } from '../lib/safe-url.js';

export const threadTaskRoutes = new Hono();

// A thread's to-do list is a plan feature (Sjoerd, 2026-09-23: "Can I check
// that decision with a checkbox? Maybe it is between starter and pro").
//
// ONE gate, at the top, so a workspace without the feature cannot read it,
// write it, template it or have a template applied to it. The affordances are
// hidden in the UI too — this is the half that holds when they are not, and
// the only half a script or a stale tab ever meets.
//
// Its own key, not `todo`: that one is the personal cross-app list, sold to
// different people. See lib/plan.ts.
threadTaskRoutes.use('*', async (c, next) => {
  const ctx = c.get('ctx');
  if (!(await can(ctx.workspaceId, 'thread_todo'))) {
    return c.json({ error: needsPlan("A thread's to-do list", 'Pro'), code: 'plan_gate_thread_todo' }, 402);
  }
  await next();
});

const TASK_SELECT =
  'id, thread_id, title, notes, due_on, link_url, assignee_user_id, team_id, status, done_at, done_by, position, source_template_id, created_by, created_at, updated_at';

/** The thread, if this caller may see it. RLS does the deciding — a thread in
 *  another workspace simply is not there. Returns its team and start date,
 *  the two things a to-do inherits. */
async function threadContext(
  jwt: string,
  threadId: string,
): Promise<{ id: string; workspace_id: string; team_id: string | null; starts_on: string | null } | null> {
  const db = userClient(jwt);
  const { data, error } = await db
    .from('thread_thread')
    .select('id, workspace_id, team_id, program:program_id (starts_on)')
    .eq('id', threadId)
    .maybeSingle();
  if (error) {
    console.warn('[thread-tasks] thread lookup', error.message);
    return null;
  }
  if (!data) return null;
  const prog = Array.isArray(data.program) ? data.program[0] : data.program;
  return {
    id: data.id as string,
    workspace_id: data.workspace_id as string,
    team_id: (data.team_id as string | null) ?? null,
    starts_on: ((prog as { starts_on?: string } | null)?.starts_on as string | null) ?? null,
  };
}

/** Names for the assignee chips, in one query rather than one per row.
 *
 *  The column is `full_name`. This said `name` when first written, which
 *  public."user" does not have — PostgREST answers that with a 400 at
 *  RUNTIME, which TypeScript never reads, and the catch below turned it into
 *  an empty map. So every assignee chip rendered blank while the list
 *  answered a perfectly healthy 200. Caught by a fixture that tried to INSERT
 *  a name, not by the tests, which only ever asserted that rows came back.
 *  There is now a test that asserts the name itself. */
async function namesFor(userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const { data, error } = await adminClient
    .from('user')
    .select('id, full_name, email')
    .in('id', ids);
  if (error) {
    console.error('[thread-tasks] assignee names', error.message);
    return new Map();
  }
  return new Map(
    (data ?? []).map((u) => [
      u.id as string,
      ((u.full_name as string) || (u.email as string) || '') as string,
    ]),
  );
}

// ---------------------------------------------------------------------------
// The list on a thread
// ---------------------------------------------------------------------------

// GET /thread/threads/:id/tasks
threadTaskRoutes.get('/threads/:id/tasks', async (c) => {
  const ctx = c.get('ctx');
  const thread = await threadContext(ctx.jwt, c.req.param('id'));
  if (!thread) return c.json({ error: 'not found' }, 404);

  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('thread_task')
    .select(TASK_SELECT)
    .eq('thread_id', thread.id)
    .is('deleted_at', null)
    .order('position', { ascending: true })
    .limit(500);
  // An error is NOT an empty list. Returning [] here would render "nothing to
  // do yet" over a list that exists (docs/testing-approach.md §1.7).
  if (error) {
    console.error('[thread-tasks] list', error.message);
    return c.json({ error: error.message }, 500);
  }

  const names = await namesFor((data ?? []).map((t) => t.assignee_user_id as string));
  const items = (data ?? []).map((t) => ({
    ...t,
    assignee_name: t.assignee_user_id ? names.get(t.assignee_user_id as string) ?? null : null,
  }));
  return c.json({
    items,
    open_count: items.filter((t) => t.status === 'open').length,
    thread_team_id: thread.team_id,
  });
});

const NewTask = z.object({
  title: z.string().min(1).max(300),
  notes: z.string().max(4000).nullable().optional(),
  due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  assignee_user_id: z.string().uuid().nullable().optional(),
  /** Where the work actually is. Validated below, not here: Zod can check
   *  the shape of a string but the question is which SCHEMES may reach an
   *  href, and that answer lives in one place (lib/safe-url.ts). */
  link_url: z.string().max(2000).nullable().optional(),
});

// POST /thread/threads/:id/tasks
threadTaskRoutes.post('/threads/:id/tasks', async (c) => {
  const ctx = c.get('ctx');
  const body = NewTask.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const thread = await threadContext(ctx.jwt, c.req.param('id'));
  if (!thread) return c.json({ error: 'not found' }, 404);

  // An assignee has to be somebody in this workspace. Checked here rather
  // than trusted from the browser — the id arrives from a picker, and a
  // picker is only as honest as the page it is on.
  if (body.data.assignee_user_id) {
    if (!(await isWorkspaceMember(thread.workspace_id, body.data.assignee_user_id))) {
      return c.json({ error: 'that person is not in this workspace' }, 403);
    }
  }

  const { data, error } = await adminClient
    .from('thread_task')
    .insert({
      workspace_id: thread.workspace_id,
      thread_id: thread.id,
      title: body.data.title.trim(),
      notes: body.data.notes ?? null,
      due_on: body.data.due_on ?? null,
      // An unsafe scheme is dropped rather than refused: the to-do itself is
      // worth keeping, and a silently-absent link is visible in the row the
      // moment somebody looks for it. A 400 would lose the whole item over
      // a paste that went wrong.
      link_url: safeHttpUrl(body.data.link_url),
      assignee_user_id: body.data.assignee_user_id ?? null,
      // "Auto team if selected" — the thread's team, without anyone choosing.
      team_id: thread.team_id,
      position: Date.now(),
      created_by: ctx.userId,
    })
    .select(TASK_SELECT)
    .single();
  if (error) {
    console.error('[thread-tasks] create', error.message);
    return c.json({ error: error.message }, 500);
  }
  return c.json(data, 201);
});

const TaskPatch = z.object({
  title: z.string().min(1).max(300).optional(),
  notes: z.string().max(4000).nullable().optional(),
  due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  assignee_user_id: z.string().uuid().nullable().optional(),
  link_url: z.string().max(2000).nullable().optional(),
  status: z.enum(['open', 'done']).optional(),
  position: z.number().optional(),
});

// PATCH /thread/tasks/:taskId
threadTaskRoutes.patch('/tasks/:taskId', async (c) => {
  const ctx = c.get('ctx');
  const body = TaskPatch.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  // The workspace check comes FIRST and by id: the update below runs on the
  // service client, which RLS never sees, so without this a task id from
  // another workspace would be writable (the class of hole found across five
  // Thread routes on 2026-09-13).
  if (!(await rowInWorkspace('thread_task', c.req.param('taskId'), ctx.workspaceId))) {
    return c.json({ error: 'not found' }, 404);
  }
  if (body.data.assignee_user_id) {
    if (!(await isWorkspaceMember(ctx.workspaceId, body.data.assignee_user_id))) {
      return c.json({ error: 'that person is not in this workspace' }, 403);
    }
  }

  const patch: Record<string, unknown> = {};
  for (const k of ['title', 'notes', 'due_on', 'assignee_user_id', 'position'] as const) {
    if (body.data[k] !== undefined) patch[k] = body.data[k];
  }
  // Present-but-unsafe becomes null, which is also how a link is CLEARED.
  if (body.data.link_url !== undefined) patch.link_url = safeHttpUrl(body.data.link_url);
  if (body.data.status) {
    patch.status = body.data.status;
    patch.done_at = body.data.status === 'done' ? new Date().toISOString() : null;
    patch.done_by = body.data.status === 'done' ? ctx.userId : null;
  }

  const { data, error } = await adminClient
    .from('thread_task')
    .update(patch)
    .eq('id', c.req.param('taskId'))
    .eq('workspace_id', ctx.workspaceId)
    .is('deleted_at', null)
    .select(TASK_SELECT)
    .maybeSingle();
  if (error) {
    console.error('[thread-tasks] patch', error.message);
    return c.json({ error: error.message }, 500);
  }
  if (!data) return c.json({ error: 'not found' }, 404);
  return c.json(data);
});

// DELETE /thread/tasks/:taskId — soft, because a to-do's title is free text
// and can name a real person (hard rule 4).
threadTaskRoutes.delete('/tasks/:taskId', async (c) => {
  const ctx = c.get('ctx');
  if (!(await rowInWorkspace('thread_task', c.req.param('taskId'), ctx.workspaceId))) {
    return c.json({ error: 'not found' }, 404);
  }
  const { error } = await adminClient
    .from('thread_task')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', c.req.param('taskId'))
    .eq('workspace_id', ctx.workspaceId);
  if (error) {
    console.error('[thread-tasks] delete', error.message);
    return c.json({ error: error.message }, 500);
  }
  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// To-do templates — the third group in Templates
// ---------------------------------------------------------------------------

const TODO_TEMPLATE_SELECT =
  'id, title, kind, scope, owner_user_id, owner_team_id, structure, created_by, created_at, updated_at';

/** One item inside a to-do template. `day_offset` is days from the thread's
 *  start — a template is reusable, so its dates are relative. */
const TemplateTask = z.object({
  title: z.string().min(1).max(300),
  notes: z.string().max(4000).nullable().optional(),
  day_offset: z.number().int().min(-3650).max(3650).nullable().optional(),
  /** The same link a thread to-do carries, saved with the template so a
   *  checklist can point at the same rehearsal schedule every time it is
   *  used (Sjoerd, 2026-09-23: "for worklists in other tools like google
   *  docs"). Sanitised where it is APPLIED, not where it is stored — a
   *  template is inert until it lands on a thread. */
  link: z.string().max(2000).nullable().optional(),
  position: z.number().optional(),
});

const TodoStructure = z.object({
  version: z.literal(1).default(1),
  tasks: z.array(TemplateTask).max(200).default([]),
});

threadTaskRoutes.get('/todo-templates', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('thread_template')
    .select(TODO_TEMPLATE_SELECT)
    .eq('kind', 'todo')
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('[thread-tasks] todo templates', error.message);
    return c.json({ error: error.message }, 500);
  }
  const visible = await filterVisibleTemplates(data ?? [], 'todo', ctx.userId);
  return c.json({ items: visible });
});

threadTaskRoutes.get('/todo-templates/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data } = await db
    .from('thread_template')
    .select(TODO_TEMPLATE_SELECT)
    .eq('id', c.req.param('id'))
    .eq('kind', 'todo')
    .maybeSingle();
  if (!data) return c.json({ error: 'not found' }, 404);
  const [visible] = await filterVisibleTemplates([data], 'todo', ctx.userId);
  if (!visible) return c.json({ error: 'not found' }, 404);
  return c.json(data);
});

const NewTodoTemplate = z.object({
  title: z.string().min(1).max(200),
  scope: z.enum(['personal', 'team', 'workspace']).default('personal'),
  owner_team_id: z.string().uuid().nullable().optional(),
  structure: TodoStructure.optional(),
});

threadTaskRoutes.post('/todo-templates', async (c) => {
  const ctx = c.get('ctx');
  const body = NewTodoTemplate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('thread_template')
    .insert({
      workspace_id: ctx.workspaceId,
      title: body.data.title.trim(),
      kind: 'todo',
      scope: body.data.scope,
      owner_user_id: body.data.scope === 'personal' ? ctx.userId : null,
      owner_team_id: body.data.scope === 'team' ? body.data.owner_team_id ?? null : null,
      structure: body.data.structure ?? { version: 1, tasks: [] },
      created_by: ctx.userId,
    })
    .select(TODO_TEMPLATE_SELECT)
    .single();
  if (error) {
    console.error('[thread-tasks] create todo template', error.message);
    return c.json({ error: error.message }, 500);
  }
  return c.json(data, 201);
});

const TodoTemplatePatch = z.object({
  title: z.string().min(1).max(200).optional(),
  scope: z.enum(['personal', 'team', 'workspace']).optional(),
  owner_team_id: z.string().uuid().nullable().optional(),
  structure: TodoStructure.optional(),
});

threadTaskRoutes.patch('/todo-templates/:id', async (c) => {
  const ctx = c.get('ctx');
  const body = TodoTemplatePatch.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const db = userClient(ctx.jwt);
  const patch: Record<string, unknown> = { ...body.data, updated_at: new Date().toISOString() };
  if (body.data.scope === 'personal') {
    patch.owner_user_id = ctx.userId;
    patch.owner_team_id = null;
  } else if (body.data.scope === 'workspace') {
    patch.owner_user_id = null;
    patch.owner_team_id = null;
  } else if (body.data.scope === 'team') {
    patch.owner_user_id = null;
  }
  const { data, error } = await db
    .from('thread_template')
    .update(patch)
    .eq('id', c.req.param('id'))
    .eq('kind', 'todo')
    .select(TODO_TEMPLATE_SELECT)
    .maybeSingle();
  if (error) {
    console.error('[thread-tasks] patch todo template', error.message);
    return c.json({ error: error.message }, 500);
  }
  if (!data) return c.json({ error: 'not found' }, 404);
  return c.json(data);
});

threadTaskRoutes.delete('/todo-templates/:id', async (c) => {
  const ctx = c.get('ctx');
  // Ownership first, then the delete and its share cleanup — the service
  // client below would otherwise wipe another workspace's grants even though
  // the RLS delete matched nothing (found on the certificate templates,
  // 2026-09-13).
  if (!(await rowInWorkspace('thread_template', c.req.param('id'), ctx.workspaceId))) {
    return c.json({ error: 'not found' }, 404);
  }
  const db = userClient(ctx.jwt);
  const { error } = await db
    .from('thread_template')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('kind', 'todo');
  if (error) {
    console.error('[thread-tasks] delete todo template', error.message);
    return c.json({ error: error.message }, 500);
  }
  await adminClient
    .from('thread_template_share')
    .delete()
    .eq('workspace_id', ctx.workspaceId)
    .eq('template_kind', 'todo')
    .eq('template_id', c.req.param('id'));
  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// Laying a template onto a thread
// ---------------------------------------------------------------------------

/** `starts_on` + n days, as a plain date string. Date-only arithmetic in UTC,
 *  so it cannot drift by a day across a timezone the way a timestamp does. */
function shiftDay(startsOn: string, days: number): string {
  const d = new Date(`${startsOn}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const ApplyTemplate = z.object({ template_id: z.string().uuid() });

// POST /thread/threads/:id/tasks/apply-template — insert a to-do template's
// list into this thread, rebasing each item onto the thread's start date.
//
// ADDS; it never replaces. Somebody applying a second checklist to a thread
// that already has one means "and also these", and a replace would silently
// destroy work already ticked off.
threadTaskRoutes.post('/threads/:id/tasks/apply-template', async (c) => {
  const ctx = c.get('ctx');
  const body = ApplyTemplate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const thread = await threadContext(ctx.jwt, c.req.param('id'));
  if (!thread) return c.json({ error: 'not found' }, 404);

  const db = userClient(ctx.jwt);
  const { data: tpl } = await db
    .from('thread_template')
    .select('id, title, kind, scope, owner_user_id, owner_team_id, structure, created_by')
    .eq('id', body.data.template_id)
    .eq('kind', 'todo')
    .maybeSingle();
  if (!tpl) return c.json({ error: 'template not found' }, 404);
  // Visible to this person, not merely present in the workspace.
  const [visible] = await filterVisibleTemplates([tpl], 'todo', ctx.userId);
  if (!visible) return c.json({ error: 'template not found' }, 404);

  const parsed = TodoStructure.safeParse(tpl.structure);
  if (!parsed.success) return c.json({ error: 'this template has no usable list' }, 400);
  const tasks = parsed.data.tasks;
  if (!tasks.length) return c.json({ items: [], added: 0 });

  // APPEND, in the template's own order.
  //
  // This used to write `t.position ?? base + i` — the template's STORED
  // position, which is 0,1,2,… and collides head-on with the positions of
  // to-dos already on the thread. Applying a checklist to a thread that had
  // three items interleaved the two lists: "Book the venue" landed above an
  // existing item, the dates jumped backwards and forwards down the list, and
  // nothing errored. Seen on the screen, not in a test — the API had
  // faithfully added five rows and said so.
  //
  // A template's positions only ever meant "the order WITHIN this list", so
  // they order the insert and do not survive it.
  const { data: last } = await adminClient
    .from('thread_task')
    .select('position')
    .eq('thread_id', thread.id)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const base = ((last?.position as number | undefined) ?? 0) + 1;
  const ordered = [...tasks].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const rows = ordered.map((t, i) => ({
    workspace_id: thread.workspace_id,
    thread_id: thread.id,
    title: t.title.trim(),
    notes: t.notes ?? null,
    // No start date on the thread yet means no dates on its to-dos — an
    // offset from nothing is not a date, and inventing today would put a
    // deadline on work nobody asked to be due.
    due_on:
      thread.starts_on && typeof t.day_offset === 'number'
        ? shiftDay(thread.starts_on, t.day_offset)
        : null,
    link_url: safeHttpUrl(t.link),
    // Unassigned on purpose: a template says what has to happen, never who
    // does it. Whoever applies it hands the items out afterwards.
    assignee_user_id: null,
    team_id: thread.team_id,
    position: base + i,
    source_template_id: tpl.id as string,
    created_by: ctx.userId,
  }));

  const { data, error } = await adminClient.from('thread_task').insert(rows).select(TASK_SELECT);
  if (error) {
    console.error('[thread-tasks] apply template', error.message);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ items: data ?? [], added: (data ?? []).length }, 201);
});

// POST /thread/threads/:id/tasks/save-as-template — the other direction:
// this thread's list becomes a template, with each date turned back into an
// offset from the thread's start.
const SaveTasksAsTemplate = z.object({
  title: z.string().min(1).max(200),
  scope: z.enum(['personal', 'team', 'workspace']).default('personal'),
});

threadTaskRoutes.post('/threads/:id/tasks/save-as-template', async (c) => {
  const ctx = c.get('ctx');
  const body = SaveTasksAsTemplate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const thread = await threadContext(ctx.jwt, c.req.param('id'));
  if (!thread) return c.json({ error: 'not found' }, 404);

  const db = userClient(ctx.jwt);
  const { data: tasks, error } = await db
    .from('thread_task')
    .select('title, notes, due_on, link_url, position')
    .eq('thread_id', thread.id)
    .is('deleted_at', null)
    .order('position', { ascending: true });
  if (error) {
    console.error('[thread-tasks] read for template', error.message);
    return c.json({ error: error.message }, 500);
  }

  const startMs = thread.starts_on ? Date.parse(`${thread.starts_on}T00:00:00Z`) : null;
  const structure = {
    version: 1 as const,
    tasks: (tasks ?? []).map((t, i) => ({
      title: t.title as string,
      notes: (t.notes as string | null) ?? null,
      link: (t.link_url as string | null) ?? null,
      day_offset:
        t.due_on && startMs != null
          ? Math.round((Date.parse(`${t.due_on as string}T00:00:00Z`) - startMs) / 86_400_000)
          : null,
      position: (t.position as number) ?? i,
    })),
  };

  const { data, error: insErr } = await db
    .from('thread_template')
    .insert({
      workspace_id: ctx.workspaceId,
      title: body.data.title.trim(),
      kind: 'todo',
      scope: body.data.scope,
      owner_user_id: body.data.scope === 'personal' ? ctx.userId : null,
      owner_team_id: body.data.scope === 'team' ? thread.team_id : null,
      structure,
      created_by: ctx.userId,
    })
    .select('id')
    .single();
  if (insErr) {
    console.error('[thread-tasks] save as template', insErr.message);
    return c.json({ error: insErr.message }, 500);
  }
  return c.json({ id: data.id, count: structure.tasks.length }, 201);
});
