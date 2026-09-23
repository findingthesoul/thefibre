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
//      membership (seatsHeldBy). No seat, no row — otherwise the list
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
import { can, needsPlan } from '../lib/plan.js';
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
  /** The organisation the subject belongs to, when there is one. A LABEL. */
  org?: string | null;
  /** The subject's tags — labels, never the note that produced them. */
  tags?: string[];
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
/**
 * Every app slug this person holds a seat for — ONE query.
 *
 * This replaces `hasAppMembership(userId, slug)`, which cost two round trips
 * each (look the app up by slug, then count memberships) and was called once
 * per source. With three sources that was SIX sequential round trips before
 * the list itself was fetched, on every panel load, in every app, on every
 * page. My pattern, from when there was one source and it did not matter;
 * it stopped being true the moment there were three.
 *
 * The same reasoning as app-shell.ts, which exists because seven layouts each
 * made three sequential calls: the cost is the waiting, not the querying.
 */
async function seatsHeldBy(userId: string): Promise<Set<string>> {
  const { data, error } = await adminClient
    .from('app_membership')
    .select('app:app_id (slug)')
    .eq('user_id', userId);
  if (error) {
    // Loudly, and an empty set means "no seats" — which here shows the
    // person their own typed list and nothing composed, rather than pretending
    // the sources are empty (docs/testing-approach.md §1.9).
    console.error('[tasks] seats', error.message);
    return new Set();
  }
  const held = new Set<string>();
  for (const row of data ?? []) {
    const app = Array.isArray(row.app) ? row.app[0] : row.app;
    const slug = (app as { slug?: string } | null)?.slug;
    if (slug) held.add(slug);
  }
  return held;
}

/**
 * Tasks assigned to this user, from the one real task table in the system —
 * and WHICH APP EACH CAME FROM.
 *
 * `flow_task` is storage, not ownership. A follow-up set while writing a note
 * in Connect lands here too, pointed at by `flow_run_note.follow_up_task_id`,
 * and it is a Connect item: that is what the reader sees, what its link should
 * open, and which seat should gate it. Flow is the building block underneath
 * (Sjoerd, 2026-09-23), so the app a row belongs to is a question about where
 * it was MADE, answered by that pointer and never by the title.
 */
async function flowTasks(userId: string, workspaceId: string): Promise<TaskItem[]> {
  const { data, error } = await adminClient
    .from('flow_task')
    // The workspace comes from the TASK, not from its run. A task does not
    // need a run: a follow-up set on a note in Connect has none, and every
    // one of Sjoerd's five open items on production was of that kind. The
    // old filter compared `run.workspace_id` to the session's workspace, so
    // a task with no run compared `undefined` and was dropped — silently,
    // and for exactly the items this list exists to surface.
    .select('id, title, due_at, status, workspace_id, contact_id, flow_run_id, run:flow_run_id (subject_label)')
    .eq('assignee_user_id', userId)
    .eq('workspace_id', workspaceId)
    .in('status', ['open', 'in_progress'])
    .is('deleted_at', null)
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) {
    console.warn('[tasks] flow tasks', error.message);
    return [];
  }
  // Which of these a Connect note created, and about whom. One query for the
  // whole page rather than one per row.
  const fromConnect = new Map<string, string | null>();
  const ids = (data ?? []).map((t) => t.id as string);
  if (ids.length) {
    const { data: notes, error: ne } = await adminClient
      .from('flow_run_note')
      .select('follow_up_task_id, person_id')
      .in('follow_up_task_id', ids);
    if (ne) console.warn('[tasks] note follow-ups', ne.message);
    for (const n of notes ?? []) {
      fromConnect.set(n.follow_up_task_id as string, (n.person_id as string | null) ?? null);
    }
  }
  // Who these are ABOUT — the note's person, or the task's own contact. A row
  // that says only "Follow up" is the thing this fixes.
  const personIds = [
    ...new Set(
      (data ?? [])
        .map((t) => (fromConnect.get(t.id as string) ?? null) || (t.contact_id as string | null))
        .filter((v): v is string => !!v),
    ),
  ];
  const labels = await peopleLabels(personIds, workspaceId);

  return (data ?? [])
    .map((t) => {
      const id = t.id as string;
      const connectPerson = fromConnect.has(id) ? fromConnect.get(id) ?? null : undefined;
      const isConnect = connectPerson !== undefined;
      const personId = connectPerson || (t.contact_id as string | null) || null;
      const about = personId ? labels.get(personId) : undefined;
      const label =
        about?.name || ((t.run as { subject_label?: string } | null)?.subject_label ?? null);
      return {
      id: null,
      source: { app: 'fibre-flow', ref: id },
      title: (t.title as string) ?? 'Task',
      due_on: t.due_at ? isoDay(new Date(t.due_at as string)) : null,
      // The app it BELONGS to, which is where it was made.
      app: isConnect ? 'fibre-sales' : 'fibre-flow',
      subject: isConnect || personId
        ? { kind: 'person', id: personId, label }
        : t.flow_run_id
        ? {
            kind: 'flow_run',
            id: t.flow_run_id as string,
            label,
          }
        : null,
      // A Connect follow-up opens the person you owe it to, not a Flow run.
      href: isConnect
        ? (personId ? `/people/${personId}` : '/today')
        : t.flow_run_id ? `/runs/${t.flow_run_id}` : '/tasks',
      state: 'open' as const,
      snoozed_until: null,
      done_at: null,
      // A Flow task's team is Flow's to say, not ours; it carries none here
      // rather than one we inferred.
      team: null,
      org: about?.org ?? null,
      tags: about?.tags ?? [],
      sort: 0,
      };
    });
}

/**
 * To-dos on a thread that are ASSIGNED TO THIS PERSON.
 *
 * The thread's list is shared — every organiser and host of the thread sees
 * all of it (public.thread_task, migration 20260923150000). This list is not:
 * rule 3 above is "yours only", so what comes across is the rows with your
 * name on them. An unassigned thread to-do stays on the thread, where the
 * people who can act on it are already looking.
 *
 * Labelled `the-thread` and gated on a Thread seat, by the v0.108.0 rule: an
 * item belongs to the app it was MADE in.
 */
async function threadTasks(userId: string, workspaceId: string): Promise<TaskItem[]> {
  const { data, error } = await adminClient
    .from('thread_task')
    .select('id, title, due_on, thread_id, team:team_id (id, name)')
    .eq('assignee_user_id', userId)
    // The admin client has no RLS narrowing it — the workspace filter is
    // ours to write, on every query.
    .eq('workspace_id', workspaceId)
    .eq('status', 'open')
    .is('deleted_at', null)
    .order('due_on', { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) {
    // Loudly: a swallowed error returning [] is indistinguishable from
    // "nothing assigned to you", and that is how two features shipped inert
    // on 2026-09-23 (docs/testing-approach.md §1.7).
    console.error('[tasks] thread tasks', error.message);
    return [];
  }
  if (!data?.length) return [];

  // The thread's name, for the label and nothing else — reference and label,
  // never content. A second query rather than a two-level embed, so a select
  // string TypeScript cannot read stays simple enough to be obviously right.
  const threadIds = [...new Set(data.map((t) => t.thread_id as string))];
  const titles = new Map<string, string>();
  const { data: threads, error: te } = await adminClient
    .from('thread_thread')
    .select('id, program:program_id (title)')
    .in('id', threadIds);
  if (te) console.error('[tasks] thread titles', te.message);
  for (const t of threads ?? []) {
    const prog = Array.isArray(t.program) ? t.program[0] : t.program;
    titles.set(t.id as string, ((prog as { title?: string } | null)?.title as string) ?? '');
  }

  return data.map((t) => ({
    id: null,
    source: { app: 'the-thread', ref: t.id as string },
    title: (t.title as string) ?? 'To do',
    due_on: (t.due_on as string | null) ?? null,
    app: 'the-thread',
    subject: {
      kind: 'thread',
      id: t.thread_id as string,
      label: titles.get(t.thread_id as string) ?? null,
    },
    href: `/threads/${t.thread_id as string}`,
    state: 'open' as const,
    snoozed_until: null,
    done_at: null,
    // The thread's team, carried through. Without it the item vanishes the
    // moment a team is chosen in the panel's filter — which looks exactly
    // like the source not working.
    team: teamOf(t.team),
    sort: 0,
  }));
}

/**
 * Names, organisations and tags for a set of people — THREE queries for the
 * whole page, never one per row.
 *
 * Sjoerd, 2026-09-23: *"Would also be nice to get more content than just:
 * follow up. A person or organisation connected, a hashtag used?"* — a row
 * reading only "Follow up" says nothing about who it is about.
 *
 * Every field here is a LABEL or a REFERENCE: a name, an organisation's name,
 * a tag. Not the note that produced them. That is the rule at the top of this
 * file and this is deliberately the side of it that stays true — the tags
 * exist as rows on the person precisely because Connect already turned the
 * note's hashtags into them, so nothing here reads anybody's prose.
 */
async function peopleLabels(
  ids: string[],
  workspaceId: string,
): Promise<Map<string, { name: string; org: string | null; tags: string[] }>> {
  const out = new Map<string, { name: string; org: string | null; tags: string[] }>();
  if (!ids.length) return out;
  const [people, orgs, tags] = await Promise.all([
    adminClient
      .from('person')
      .select('id, first_name, last_name')
      .in('id', ids)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null),
    adminClient
      .from('org_membership')
      .select('person_id, organisation:organisation_id (name)')
      .in('person_id', ids),
    adminClient.from('person_tag').select('person_id, tag:tag_id (name)').in('person_id', ids),
  ]);
  if (people.error) console.error('[tasks] people labels', people.error.message);
  if (orgs.error) console.error('[tasks] org labels', orgs.error.message);
  if (tags.error) console.error('[tasks] tag labels', tags.error.message);

  for (const p of people.data ?? []) {
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
    out.set(p.id as string, { name, org: null, tags: [] });
  }
  for (const row of orgs.data ?? []) {
    const entry = out.get(row.person_id as string);
    if (!entry || entry.org) continue; // the first is enough for one line
    const o = Array.isArray(row.organisation) ? row.organisation[0] : row.organisation;
    entry.org = ((o as { name?: string } | null)?.name ?? null);
  }
  for (const row of tags.data ?? []) {
    const entry = out.get(row.person_id as string);
    if (!entry) continue;
    const t = Array.isArray(row.tag) ? row.tag[0] : row.tag;
    const name = (t as { name?: string } | null)?.name;
    if (name && entry.tags.length < 3) entry.tags.push(name);
  }
  return out;
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
// To do is an Organisation-plan feature (Sjoerd, 2026-09-23). One gate, at
// the top of every route, so a workspace without it cannot read, write or
// have a sweep act on a list it does not have. The button is hidden too (the
// flag rides /auth/me) — this is the half that holds when it is not.
myTasksRoutes.use('*', async (c, next) => {
  const ctx = c.get('ctx');
  if (!(await can(ctx.workspaceId, 'todo'))) {
    return c.json({ error: needsPlan('The To do list', 'Organisation') }, 402);
  }
  await next();
});

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
  // Gate by WHERE THE ITEM CAME FROM, not by which table it lives in.
  //
  // Sjoerd, 2026-09-23: *"Flows as a tech should be available in all apps -
  // but not as an app people can select (more as a building block for
  // apps)."* So a Flow seat is not a thing to ask about. A follow-up you set
  // on a note in Connect is a CONNECT item that happens to be stored as a
  // flow_task; it needs a Connect seat. A task made inside Flow itself needs
  // the Flow seat while that app still exists.
  //
  // Before this, every one of these was hidden behind `fibre-flow` — so
  // somebody who uses Connect and not Flow never saw their own follow-ups,
  // which looks exactly like the feature not working.
  const held = await seatsHeldBy(ctx.userId);
  const seats = {
    connect: held.has('fibre-sales'),
    flow: held.has('fibre-flow'),
    thread: held.has('the-thread'),
  };
  if (seats.connect || seats.flow) {
    for (const item of await flowTasks(ctx.userId, ctx.workspaceId)) {
      const from = item.app === 'fibre-sales' ? 'connect' : 'flow';
      if (!seats[from]) continue;
      const state = answered.get(`${item.source!.app}:${item.source!.ref}`);
      if (state?.state === 'done') continue;              // ticked off my list
      composed.push(state ? { ...item, ...state, title: item.title, href: item.href } : item);
    }
  }

  // A thread's to-dos, the ones with this person's name on them.
  //
  // Gated on the workspace's `thread_todo` feature as well as the seat. A
  // workspace can hold `todo` (this list) without holding `thread_todo` (the
  // thread checklist) — they are separate keys on purpose — and composing
  // rows from a feature they do not have would be the side door by another
  // door.
  if (seats.thread && (await can(ctx.workspaceId, 'thread_todo'))) {
    for (const item of await threadTasks(ctx.userId, ctx.workspaceId)) {
      const state = answered.get(`${item.source!.app}:${item.source!.ref}`);
      if (state?.state === 'done') continue;
      composed.push(
        state ? { ...item, ...state, title: item.title, href: item.href, team: item.team } : item,
      );
    }
  }

  // What you ticked TODAY, for the foot of the list (Sjoerd, 2026-09-23:
  // "see at the bottom a todo checked of this day"). Both kinds — something
  // you typed and something an app owns that you answered — because both are
  // things you did today. Newest first: the last thing ticked is the one you
  // are most likely to have ticked by mistake.
  const today = isoDay(new Date());
  const doneToday = mine
    .filter((i) => i.state === 'done' && i.done_at && isoDay(new Date(i.done_at)) === today)
    .sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''));

  const typed = mine.filter((i) => !i.source && i.state !== 'done');
  const all = [...typed, ...composed]
    .filter((i) => !appFilter || i.app === appFilter)
    .filter((i) =>
      teamFilter === undefined ? true : teamFilter === '' ? !i.team : i.team?.id === teamFilter,
    );
  // The teams you may file under ride the list, so the panel needs no second
  // call to draw its picker.
  return c.json({
    view,
    items: all,
    groups: groupByDay(all),
    done_today: doneToday,
    teams: await myTeams(ctx.userId, ctx.workspaceId),
  });
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

/**
 * Ticking an item here means it is done where it LIVES too — one truth, not
 * two. Both directions: people un-tick, and an answer that only travels one
 * way leaves the app's row done forever.
 *
 * Every branch is constrained by assignee, so the pass-through can only ever
 * complete a row that is this person's to complete.
 */
async function passThroughCompletion(sourceApp: string, ref: string, userId: string, done: boolean) {
  if (sourceApp === 'fibre-flow') {
    const { error } = await adminClient
      .from('flow_task')
      .update(
        done
          ? { status: 'done', completed_at: new Date().toISOString(), completed_by: userId }
          : { status: 'open', completed_at: null, completed_by: null },
      )
      .eq('id', ref)
      .eq('assignee_user_id', userId);
    if (error) console.error('[tasks] flow pass-through', error.message);
    return;
  }
  // A thread's to-do list is shared, so ticking it in the panel has to show
  // on the thread — otherwise the item leaves your list while the organiser
  // still sees it outstanding, and nothing anywhere says so.
  if (sourceApp === 'the-thread') {
    const { error } = await adminClient
      .from('thread_task')
      .update(
        done
          ? { status: 'done', done_at: new Date().toISOString(), done_by: userId }
          : { status: 'open', done_at: null, done_by: null },
      )
      .eq('id', ref)
      .eq('assignee_user_id', userId)
      .is('deleted_at', null);
    if (error) console.error('[tasks] thread pass-through', error.message);
  }
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
