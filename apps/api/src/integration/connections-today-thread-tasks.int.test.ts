// Connect's Today shows a thread's to-dos — and only to someone who should
// see them.
//
// Sjoerd, 2026-09-23, on the per-thread to-do lists: "when do you get
// connections - can it then become integrated automatically?" The shared To
// do panel already carried them, being one platform list in every app;
// Today did not, because its OWED half reads its own sources.
//
// Why this test exists rather than a probe: every branch in that route
// THROWS on a query error and the handler answers 500, so a wrong column in
// the new select does not quietly drop a section — it takes down the whole
// Today page, agenda included, for everyone in the workspace. And a probe
// against a workspace with no to-dos returns 0 rows whether the filters are
// right or wrong. So: real rows, and assert they ARRIVE.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import {
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  service,
  type FixtureUser,
} from './staging.js';

let app: Hono;
let ws: string;
/** Holds a Thread seat — should see the thread's to-dos. */
let seated: FixtureUser;
/** Connect only, no Thread seat — must not see them. */
let unseated: FixtureUser;
let threadId: string;
let programId: string;
let organiserId: string;
let threadAppId: string;
let connectAppId: string;
const taskIds: string[] = [];

/** A plain day, n days from now. The route's windows are UTC day
 *  boundaries, so these line up with its segments. */
function day(offset: number): string {
  return new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Today, for one horizon.
 *
 * The horizon MATTERS and cost this test its first run: the route defaults to
 * `today`, and `segmentsFor` puts a row in `today` only when its moment is
 * before tomorrow starts. Every fixture row was dated tomorrow, so the page
 * answered 200 with an empty owed list and the assertions read as "the
 * feature does not work". The feature was fine; the dates were wrong. Which
 * is the same lesson as everything else here — an empty list is
 * indistinguishable from a broken one until you make it non-empty on purpose.
 */
async function today(user: FixtureUser, horizon?: string): Promise<Response> {
  const q = horizon ? `?horizon=${horizon}` : '';
  return app.request(`/api/v1/connections/today${q}`, {
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      'X-App-ID': 'fibre-sales',
    },
  });
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { connectionsTodayRoutes } = await import('../routes/connections-today.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/connections', connectionsTodayRoutes);
  app.route('/api/v1', v1);

  const { data: t } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  threadAppId = t!.id as string;
  const { data: c } = await service.from('app').select('id').eq('slug', 'fibre-sales').single();
  connectAppId = c!.id as string;

  ws = await createThrowawayWorkspace('today-tt');
  seated = await createFixtureUser(ws, 'today-seated');
  unseated = await createFixtureUser(ws, 'today-unseated');
  for (const u of [seated, unseated]) {
    const { error } = await service
      .from('workspace_member')
      .upsert({ workspace_id: ws, user_id: u.userId, workspace_role: 'admin' });
    if (error) throw new Error(`workspace_member: ${error.message}`);
    // Both need Connect, or the route itself is unreachable for them.
    const { error: cErr } = await service
      .from('app_membership')
      .upsert({ user_id: u.userId, app_id: connectAppId, role: 'admin' }, { onConflict: 'user_id,app_id' });
    if (cErr) throw new Error(`connect membership: ${cErr.message}`);
  }
  // Only ONE of them gets The Thread.
  const { error: tErr } = await service
    .from('app_membership')
    .upsert({ user_id: seated.userId, app_id: threadAppId, role: 'admin' }, { onConflict: 'user_id,app_id' });
  if (tErr) throw new Error(`thread membership: ${tErr.message}`);

  // A throwaway workspace arrives on the free plan, which does not include
  // thread_todo — Today gates the thread block on the workspace feature as
  // well as the seat, so without this every assertion below would be empty
  // for a reason that has nothing to do with what is being tested.
  {
    const { error: subErr } = await service
      .from('workspace_subscription')
      .upsert({ workspace_id: ws, plan_id: 'pro', status: 'active' }, { onConflict: 'workspace_id' });
    if (subErr) throw new Error(`workspace_subscription fixture: ${subErr.message}`);
  }

  const { data: org, error: oErr } = await service
    .from('thread_organiser')
    .insert({ user_id: seated.userId, workspace_id: ws, slug: `int-today-${randomUUID().slice(0, 8)}` })
    .select('id')
    .single();
  if (oErr) throw new Error(`organiser: ${oErr.message}`);
  organiserId = org!.id as string;

  const { data: prog, error: pErr } = await service
    .from('program')
    .insert({
      workspace_id: ws,
      app_id: threadAppId,
      title: 'Spring Intensive',
      format: 'event',
      status: 'draft',
      starts_on: '2026-12-01',
    })
    .select('id')
    .single();
  if (pErr) throw new Error(`program: ${pErr.message}`);
  programId = prog!.id as string;

  const { data: th, error: thErr } = await service
    .from('thread_thread')
    .insert({
      workspace_id: ws,
      program_id: programId,
      organiser_id: organiserId,
      slug: `int-today-${randomUUID().slice(0, 8)}`,
    })
    .select('id')
    .single();
  if (thErr) throw new Error(`thread: ${thErr.message}`);
  threadId = th!.id as string;

  const { data: tasks, error: ttErr } = await service
    .from('thread_task')
    .insert([
      // Assigned to the seated user, due TODAY — the default horizon.
      {
        workspace_id: ws,
        thread_id: threadId,
        title: 'Book the sound engineer',
        due_on: day(0),
        assignee_user_id: seated.userId,
        created_by: seated.userId,
      },
      // Nobody has picked this one up — the flow_task rule says it is mine too.
      {
        workspace_id: ws,
        thread_id: threadId,
        title: 'Nobody has picked this up',
        due_on: day(0),
        assignee_user_id: null,
        created_by: seated.userId,
      },
      // Somebody else's: must stay off the list.
      {
        workspace_id: ws,
        thread_id: threadId,
        title: 'Belongs to a colleague',
        due_on: day(0),
        assignee_user_id: unseated.userId,
        created_by: seated.userId,
      },
      // Due tomorrow: proves the row is SEGMENTED, not merely present.
      {
        workspace_id: ws,
        thread_id: threadId,
        title: 'Tomorrow, not today',
        due_on: day(1),
        assignee_user_id: seated.userId,
        created_by: seated.userId,
      },
      // No date: Today is a dated queue, so this one never appears.
      {
        workspace_id: ws,
        thread_id: threadId,
        title: 'Undated, so not on Today',
        due_on: null,
        assignee_user_id: seated.userId,
        created_by: seated.userId,
      },
    ])
    .select('id');
  if (ttErr) throw new Error(`thread_task: ${ttErr.message}`);
  taskIds.push(...tasks!.map((t) => t.id as string));
});

afterAll(async () => {
  if (taskIds.length) await service.from('thread_task').delete().in('id', taskIds);
  await service.from('thread_task').delete().eq('thread_id', threadId);
  await service.from('workspace_subscription').delete().eq('workspace_id', ws);
  await service.from('thread_thread').delete().eq('id', threadId);
  await service.from('program').delete().eq('id', programId);
  await service.from('thread_organiser').delete().eq('id', organiserId);
  for (const u of [seated, unseated]) {
    await service.from('app_membership').delete().eq('user_id', u.userId);
    await service.from('workspace_member').delete().eq('user_id', u.userId);
    await deleteFixtureUser(u);
  }
  // A workspace carries its own organisation row; the delete is refused
  // without this (organisation_workspace_id_fkey).
  await service.from('organisation').delete().eq('workspace_id', ws);
  await deleteThrowawayWorkspace(ws);
});

describe("a thread's to-dos reach Connect's Today", () => {
  it('answers at all — the whole page 500s if any query in it is wrong', async () => {
    const res = await today(seated);
    expect(res.status).toBe(200);
  });

  it('shows the one assigned to me, with the thread as its subject and a link', async () => {
    const body = await (await today(seated)).json();
    const row = body.owed.find((o: { title: string }) => o.title === 'Book the sound engineer');
    // Non-empty on purpose: a 200 with an empty owed list is exactly what an
    // inert integration returns.
    expect(row, 'the assigned to-do should be on Today').toBeTruthy();
    expect(row.subject_label, 'the thread names the row').toBe('Spring Intensive');
    expect(row.link).toEqual({ kind: 'thread', id: threadId });
    // Due today is not late.
    expect(row.overdue).toBe(false);
    // Midday, not midnight. The client turns due_at into a day count with
    // Math.round((due_at - now) / DAY), and against midnight that rounds down
    // for most of the day: a to-do due TODAY rendered "yesterday" from 12:00
    // UTC onwards. Pinned here because it is invisible to every assertion
    // about the row's content.
    expect(row.due_at.slice(11, 16)).toBe('12:00');
    const days = Math.round((new Date(row.due_at).getTime() - Date.now()) / 86_400_000);
    // Math.abs, because Math.round of a small NEGATIVE number is -0, and
    // vitest's toBe uses Object.is, under which -0 is not 0. The day count
    // was already correct; the assertion was wrong.
    expect(Math.abs(days), 'due today must read as today at any hour').toBe(0);
    // Reuses the `task` kind rather than adding one, so it must be estimated.
    expect(row.minutes).toBeGreaterThan(0);
  });

  it('shows one nobody has picked up — the flow_task rule, unchanged', async () => {
    const body = await (await today(seated)).json();
    const titles = body.owed.map((o: { title: string }) => o.title);
    expect(titles).toContain('Nobody has picked this up');
  });

  it("does NOT show a colleague's, and does not show undated work", async () => {
    const body = await (await today(seated)).json();
    const titles = body.owed.map((o: { title: string }) => o.title);
    expect(titles).not.toContain('Belongs to a colleague');
    expect(titles).not.toContain('Undated, so not on Today');
  });

  it('puts a row in the right horizon, not merely on the page', async () => {
    const onToday = await (await today(seated)).json();
    expect(onToday.owed.map((o: { title: string }) => o.title)).not.toContain('Tomorrow, not today');

    const onTomorrow = await (await today(seated, 'tomorrow')).json();
    expect(onTomorrow.owed.map((o: { title: string }) => o.title)).toContain('Tomorrow, not today');
  });

  it('shows NOTHING to a Connect user with no Thread seat', async () => {
    const res = await today(unseated);
    expect(res.status).toBe(200);
    const body = await res.json();
    const fromThread = body.owed.filter((o: { link?: { kind: string } | null }) => o.link?.kind === 'thread');
    // Including the one assigned to THEM: without the seat, this app's
    // content is not theirs to read here.
    expect(fromThread, 'no seat, no rows — rule 1').toEqual([]);
  });
});
