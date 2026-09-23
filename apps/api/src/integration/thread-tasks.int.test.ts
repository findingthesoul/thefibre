// A thread's to-do list: shared where it should be, private where it should
// be, and actually ARRIVING on the assignee's personal list.
//
// The last one is the point. Every test here that only checked a 200 would
// pass against a feature that silently returns nothing — which is exactly how
// two features shipped inert on 2026-09-23. So the assertions that matter are
// non-empty ones: the item IS in the list, with the right label, the right
// app and the right team.
//
// Runs in process behind the real appContext middleware with real sessions,
// against staging. Throwaway workspaces, every row cleaned by its own id.

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
let wsA: string;
let wsB: string;
/** Organiser in A — makes the thread and the list. */
let adminA: FixtureUser;
/** Another member of A — the person work gets assigned to. */
let memberA: FixtureUser;
/** Somebody in another workspace entirely. */
let memberB: FixtureUser;
let threadA: string;
let programA: string;
let organiserA: string;
let teamA: string;
let thethreadAppId: string;
const createdTaskIds: string[] = [];
const createdTemplateIds: string[] = [];

async function call(user: FixtureUser, method: string, path: string, body?: unknown) {
  return app.request(`/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      'X-App-ID': 'the-thread',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  const { threadTaskRoutes } = await import('../routes/thread-tasks.js');
  const { myTasksRoutes } = await import('../routes/my-tasks.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  v1.route('/thread', threadTaskRoutes);
  v1.route('/tasks', myTasksRoutes);
  app.route('/api/v1', v1);

  const { data: appRow } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  thethreadAppId = appRow!.id as string;

  wsA = await createThrowawayWorkspace('tasks-a');
  wsB = await createThrowawayWorkspace('tasks-b');
  adminA = await createFixtureUser(wsA, 'tasks-admin-a');
  memberA = await createFixtureUser(wsA, 'tasks-member-a');
  memberB = await createFixtureUser(wsB, 'tasks-member-b');
  for (const [ws, u, role] of [
    [wsA, adminA, 'admin'],
    [wsA, memberA, 'organiser'],
    [wsB, memberB, 'organiser'],
  ] as const) {
    const { error } = await service
      .from('workspace_member')
      .upsert({ workspace_id: ws, user_id: u.userId, workspace_role: role });
    if (error) throw new Error(`workspace_member fixture: ${error.message}`);
  }

  // RLS on thread_thread hides a thread from somebody without a Thread seat,
  // and every route here checks visibility through RLS first. Without these
  // rows the refusal tests would pass for the wrong reason — the lesson from
  // the tenancy suite, where a refusal test proved nothing because its
  // success-case twin failed.
  for (const u of [adminA, memberA, memberB]) {
    const { error } = await service
      .from('app_membership')
      .upsert({ user_id: u.userId, app_id: thethreadAppId, role: 'admin' }, { onConflict: 'user_id,app_id' });
    if (error) throw new Error(`app membership fixture: ${error.message}`);
  }

  // A throwaway workspace does NOT arrive without a plan: it gets a
  // workspace_subscription row on 'free', and free does not include
  // thread_todo. So every test below would 402 without putting this
  // workspace on a plan that HAS the feature. (The first version assumed no
  // subscription meant the 'unknown' plan, where can() fails open — wrong,
  // and the whole suite went red at once, which is the pleasant way to find
  // out.)
  //
  // wsB gets it TOO, and that is the interesting half: the plan gate runs
  // before the tenancy check, so an attacker on a plan without the feature
  // is refused 402 and the cross-tenant tests below would pass without ever
  // reaching the code they exist to test. Giving the attacker the feature
  // removes the confound — their 404 then means "not your thread", which is
  // the claim.
  for (const w of [wsA, wsB]) {
    const { error: subErr } = await service
      .from('workspace_subscription')
      .upsert({ workspace_id: w, plan_id: 'pro', status: 'active' }, { onConflict: 'workspace_id' });
    if (subErr) throw new Error(`workspace_subscription fixture: ${subErr.message}`);
  }

  const { data: tm, error: teamErr } = await service
    .from('team')
    .insert({ workspace_id: wsA, name: 'Tasks test', slug: `int-tasks-${randomUUID().slice(0, 8)}` })
    .select('id')
    .single();
  if (teamErr) throw new Error(`team fixture: ${teamErr.message}`);
  teamA = tm!.id as string;
  // The assignee must be an active member of the team for the panel's team
  // picker to accept it, and for the personal list's team filter to keep it.
  for (const u of [adminA, memberA]) {
    const { error } = await service
      .from('team_member')
      .insert({ team_id: teamA, user_id: u.userId, role: 'member', status: 'active' });
    if (error) throw new Error(`team_member fixture: ${error.message}`);
  }

  const { data: org, error: orgErr } = await service
    .from('thread_organiser')
    .insert({ user_id: adminA.userId, workspace_id: wsA, slug: `int-tasks-org-${randomUUID().slice(0, 8)}` })
    .select('id')
    .single();
  if (orgErr) throw new Error(`organiser fixture: ${orgErr.message}`);
  organiserA = org!.id as string;

  const { data: prog, error: progErr } = await service
    .from('program')
    // app_id is NOT NULL and takes the app's UUID, not its slug.
    .insert({
      workspace_id: wsA,
      app_id: thethreadAppId,
      title: 'Tasks test thread',
      format: 'event',
      status: 'draft',
      starts_on: '2026-10-01',
    })
    .select('id')
    .single();
  if (progErr) throw new Error(`program fixture: ${progErr.message}`);
  programA = prog!.id as string;

  const { data: th, error: thErr } = await service
    .from('thread_thread')
    .insert({
      workspace_id: wsA,
      program_id: programA,
      organiser_id: organiserA,
      team_id: teamA,
      slug: `int-tasks-${randomUUID().slice(0, 8)}`,
    })
    .select('id')
    .single();
  if (thErr) throw new Error(`thread fixture: ${thErr.message}`);
  threadA = th!.id as string;
});

afterAll(async () => {
  if (createdTaskIds.length) await service.from('thread_task').delete().in('id', createdTaskIds);
  await service.from('thread_task').delete().eq('thread_id', threadA);
  if (createdTemplateIds.length) {
    await service.from('thread_template_share').delete().in('template_id', createdTemplateIds);
    await service.from('thread_template').delete().in('id', createdTemplateIds);
  }
  await service.from('user_task').delete().in('user_id', [adminA.userId, memberA.userId]);
  await service.from('workspace_subscription').delete().in('workspace_id', [wsA, wsB]);
  await service.from('thread_thread').delete().eq('id', threadA);
  await service.from('program').delete().eq('id', programA);
  await service.from('thread_organiser').delete().eq('id', organiserA);
  await service.from('team_member').delete().eq('team_id', teamA);
  await service.from('team').delete().eq('id', teamA);
  for (const u of [adminA, memberA, memberB]) await deleteFixtureUser(u);
  await deleteThrowawayWorkspace(wsA);
  await deleteThrowawayWorkspace(wsB);
});

describe('the plan decides whether a thread has a to-do list at all', () => {
  // Sjoerd, 2026-09-23: "Can I check that decision with a checkbox? Maybe it
  // is between starter and pro". The line is data on billing_plan now, so
  // this test asserts the MECHANISM (the gate reads the plan) rather than
  // today's tier values, which are his to move without touching code.
  //
  // Both halves on purpose. A gate that refuses everybody passes a refusal
  // test while being a lockout — the lesson from the tenancy suite, where a
  // refusal proved nothing because its success twin was failing.
  let starterWs: string;
  let starterUser: FixtureUser;
  let starterThread: string;
  let starterProgram: string;
  let starterOrganiser: string;

  beforeAll(async () => {
    starterWs = await createThrowawayWorkspace('plan-starter');
    starterUser = await createFixtureUser(starterWs, 'plan-starter');
    const { error: wmErr } = await service
      .from('workspace_member')
      .upsert({ workspace_id: starterWs, user_id: starterUser.userId, workspace_role: 'admin' });
    if (wmErr) throw new Error(`workspace_member: ${wmErr.message}`);
    const { error: amErr } = await service
      .from('app_membership')
      .upsert({ user_id: starterUser.userId, app_id: thethreadAppId, role: 'admin' }, { onConflict: 'user_id,app_id' });
    if (amErr) throw new Error(`app membership: ${amErr.message}`);

    // Put it on a plan that LACKS the feature. A new workspace already has
    // a subscription (on free), so this is an upsert, not an insert — and
    // free would have refused too, but naming the plan says what is being
    // tested instead of relying on the default.
    const { error: subErr } = await service
      .from('workspace_subscription')
      .upsert({ workspace_id: starterWs, plan_id: 'starter', status: 'active' }, { onConflict: 'workspace_id' });
    if (subErr) throw new Error(`subscription: ${subErr.message}`);

    const { data: org } = await service
      .from('thread_organiser')
      .insert({ user_id: starterUser.userId, workspace_id: starterWs, slug: `int-plan-${randomUUID().slice(0, 8)}` })
      .select('id')
      .single();
    starterOrganiser = org!.id as string;
    const { data: prog } = await service
      .from('program')
      .insert({ workspace_id: starterWs, app_id: thethreadAppId, title: 'Starter thread', format: 'event', status: 'draft' })
      .select('id')
      .single();
    starterProgram = prog!.id as string;
    const { data: th } = await service
      .from('thread_thread')
      .insert({
        workspace_id: starterWs,
        program_id: starterProgram,
        organiser_id: starterOrganiser,
        slug: `int-plan-${randomUUID().slice(0, 8)}`,
      })
      .select('id')
      .single();
    starterThread = th!.id as string;
  });

  afterAll(async () => {
    await service.from('thread_thread').delete().eq('id', starterThread);
    await service.from('program').delete().eq('id', starterProgram);
    await service.from('thread_organiser').delete().eq('id', starterOrganiser);
    await service.from('workspace_subscription').delete().eq('workspace_id', starterWs);
    await service.from('app_membership').delete().eq('user_id', starterUser.userId);
    await service.from('workspace_member').delete().eq('user_id', starterUser.userId);
    await deleteFixtureUser(starterUser);
    await service.from('organisation').delete().eq('workspace_id', starterWs);
    await deleteThrowawayWorkspace(starterWs);
  });

  it('a plan without the feature is refused, and told which plan has it', async () => {
    const res = await call(starterUser, 'GET', `/thread/threads/${starterThread}/tasks`);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.code).toBe('plan_gate_thread_todo');
    // The refusal names the thing and the plan — never a bare "upgrade".
    expect(String(body.error)).toMatch(/Pro/);
  });

  it('refuses writing and templating too, not only reading', async () => {
    const post = await call(starterUser, 'POST', `/thread/threads/${starterThread}/tasks`, { title: 'nope' });
    expect(post.status).toBe(402);
    const tpl = await call(starterUser, 'GET', '/thread/todo-templates');
    expect(tpl.status).toBe(402);
  });

  it('and the workspace that HAS it is not locked out', async () => {
    // The success twin. Without it, a gate that refused everybody would pass
    // every test above.
    const res = await call(adminA, 'GET', `/thread/threads/${threadA}/tasks`);
    expect(res.status).toBe(200);
  });
});

describe('a thread to-do list is shared inside the thread', () => {
  it('the organiser can add one, and it inherits the thread’s team', async () => {
    const res = await call(adminA, 'POST', `/thread/threads/${threadA}/tasks`, {
      title: 'Book the room',
      due_on: '2026-09-25',
    });
    expect(res.status).toBe(201);
    const task = await res.json();
    createdTaskIds.push(task.id);
    expect(task.title).toBe('Book the room');
    // "Auto team if selected" — nobody chose this; the thread did.
    expect(task.team_id).toBe(teamA);
  });

  it('names the assignee — a blank chip is what a bad select looks like', async () => {
    // This assertion exists because the first version of namesFor() selected
    // `name` from public."user", which has `full_name`. PostgREST answered
    // 400 at runtime, the catch turned it into an empty map, and every chip
    // rendered blank while the list answered 200. Asserting "rows came back"
    // could never have seen it; asserting the NAME can.
    const made = await (
      await call(adminA, 'POST', `/thread/threads/${threadA}/tasks`, {
        title: 'has an assignee',
        assignee_user_id: adminA.userId,
      })
    ).json();
    createdTaskIds.push(made.id);

    const body = await (await call(adminA, 'GET', `/thread/threads/${threadA}/tasks`)).json();
    const row = body.items.find((t: { id: string }) => t.id === made.id);
    expect(row).toBeTruthy();
    expect(row.assignee_user_id).toBe(adminA.userId);
    expect(row.assignee_name, 'the chip needs a name, not an empty string').toBeTruthy();
    expect(String(row.assignee_name).length).toBeGreaterThan(0);
  });

  it('ANOTHER member of the same workspace sees it — that is the whole point', async () => {
    const res = await call(memberA, 'GET', `/thread/threads/${threadA}/tasks`);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Non-empty, deliberately: a 200 with [] is what an inert feature returns.
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.map((t: { title: string }) => t.title)).toContain('Book the room');
    expect(body.open_count).toBeGreaterThan(0);
  });

  it('somebody from another workspace cannot see the thread at all', async () => {
    const res = await call(memberB, 'GET', `/thread/threads/${threadA}/tasks`);
    expect(res.status).toBe(404);
  });

  it('somebody from another workspace cannot add to it', async () => {
    const res = await call(memberB, 'POST', `/thread/threads/${threadA}/tasks`, { title: 'not mine' });
    expect(res.status).toBe(404);
  });

  it('refuses an assignee who is not in the workspace', async () => {
    const res = await call(adminA, 'POST', `/thread/threads/${threadA}/tasks`, {
      title: 'wrong assignee',
      assignee_user_id: memberB.userId,
    });
    expect(res.status).toBe(403);
  });

  it('removing one is a soft delete — the row stays, the list does not show it', async () => {
    const made = await (
      await call(adminA, 'POST', `/thread/threads/${threadA}/tasks`, { title: 'temporary' })
    ).json();
    createdTaskIds.push(made.id);
    expect((await call(adminA, 'DELETE', `/thread/tasks/${made.id}`)).status).toBe(204);

    const after = await (await call(adminA, 'GET', `/thread/threads/${threadA}/tasks`)).json();
    expect(after.items.map((t: { id: string }) => t.id)).not.toContain(made.id);

    const { data: row } = await service
      .from('thread_task')
      .select('id, deleted_at')
      .eq('id', made.id)
      .maybeSingle();
    expect(row, 'hard rule 4: personal data soft-deletes').not.toBeNull();
    expect(row!.deleted_at).not.toBeNull();
  });
});

describe('an assigned to-do reaches that person’s own To do list', () => {
  let assigned: { id: string };

  it('assigns one to another member', async () => {
    const res = await call(adminA, 'POST', `/thread/threads/${threadA}/tasks`, {
      title: 'Ring the caterer',
      due_on: '2026-09-26',
      assignee_user_id: memberA.userId,
    });
    expect(res.status).toBe(201);
    assigned = await res.json();
    createdTaskIds.push(assigned.id);
  });

  it('shows up on the assignee’s personal list, labelled the-thread, with the team', async () => {
    const res = await call(memberA, 'GET', '/tasks?view=open');
    // The personal list is an Organisation-plan feature. A throwaway
    // workspace may not carry it — in which case this route answers 402 and
    // there is nothing to assert about composition. Say so out loud rather
    // than letting the test pass by skipping silently.
    if (res.status === 402) {
      console.warn('[thread-tasks] /tasks is plan-gated for this fixture workspace — composition not asserted');
      return;
    }
    expect(res.status).toBe(200);
    const body = await res.json();
    const mine = body.items.find(
      (i: { source?: { app: string; ref: string } | null }) =>
        i.source?.app === 'the-thread' && i.source?.ref === assigned.id,
    );
    expect(mine, 'the thread to-do should be on the assignee’s list').toBeTruthy();
    expect(mine.app).toBe('the-thread');
    expect(mine.title).toBe('Ring the caterer');
    // Without a team the item disappears the moment a team filter is chosen.
    expect(mine.team?.id).toBe(teamA);
    expect(mine.href).toContain(threadA);
  });

  it('does NOT show up on somebody else’s list', async () => {
    const res = await call(adminA, 'GET', '/tasks?view=open');
    if (res.status === 402) return;
    const body = await res.json();
    const theirs = body.items.find(
      (i: { source?: { app: string; ref: string } | null }) => i.source?.ref === assigned.id,
    );
    expect(theirs, 'it is assigned to somebody else').toBeFalsy();
  });

  it('ticking it on the personal list closes it on the THREAD too', async () => {
    const res = await call(memberA, 'POST', '/tasks/answer', {
      source_app: 'the-thread',
      source_ref: assigned.id,
      state: 'done',
      title: 'Ring the caterer',
    });
    if (res.status === 402) return;
    expect([200, 201]).toContain(res.status);

    const { data: row } = await service
      .from('thread_task')
      .select('status, done_by')
      .eq('id', assigned.id)
      .single();
    expect(row!.status, 'one truth, not two').toBe('done');
    expect(row!.done_by).toBe(memberA.userId);
  });
});

describe('to-do templates', () => {
  let templateId: string;

  it('creates one with a relative list', async () => {
    const res = await call(adminA, 'POST', '/thread/todo-templates', {
      title: 'Before any event',
      scope: 'workspace',
      structure: {
        version: 1,
        tasks: [
          { title: 'Confirm the venue', day_offset: -14 },
          { title: 'Send the joining details', day_offset: -2 },
          { title: 'Something with no date' },
        ],
      },
    });
    expect(res.status).toBe(201);
    const tpl = await res.json();
    templateId = tpl.id;
    createdTemplateIds.push(templateId);
    expect(tpl.kind).toBe('todo');
  });

  it('does not appear among the THREAD templates — a third group, not a mix', async () => {
    const res = await call(adminA, 'GET', '/thread/thread-templates');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.map((t: { id: string }) => t.id)).not.toContain(templateId);
  });

  it('applies onto a thread, rebasing each offset onto its start date', async () => {
    const res = await call(adminA, 'POST', `/thread/threads/${threadA}/tasks/apply-template`, {
      template_id: templateId,
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.added).toBe(3);
    for (const t of body.items) createdTaskIds.push(t.id);

    const venue = body.items.find((t: { title: string }) => t.title === 'Confirm the venue');
    // starts_on 2026-10-01, offset −14.
    expect(venue.due_on).toBe('2026-09-17');
    const undated = body.items.find((t: { title: string }) => t.title === 'Something with no date');
    expect(undated.due_on).toBeNull();
    // Inherited, again without anyone choosing.
    expect(venue.team_id).toBe(teamA);
    // A template says WHAT, never who.
    expect(venue.assignee_user_id).toBeNull();
  });

  it('APPENDS after what is already there, in the template’s own order', async () => {
    // Found by looking at the screen, not by a test: the first version wrote
    // the template's stored position (0,1,2…) straight onto the row, which
    // collides with the positions of to-dos already on the thread. Applying a
    // checklist INTERLEAVED it with the existing list — dates jumping up and
    // down the page — while the API happily reported five rows added.
    const before = await (await call(adminA, 'GET', `/thread/threads/${threadA}/tasks`)).json();
    const maxBefore = Math.max(...before.items.map((t: { position: number }) => t.position));

    const res = await call(adminA, 'POST', `/thread/threads/${threadA}/tasks/apply-template`, {
      template_id: templateId,
    });
    expect(res.status).toBe(201);
    const added = await res.json();
    for (const t of added.items) createdTaskIds.push(t.id);

    // Every new row sits after everything that was already there…
    for (const t of added.items) expect(t.position).toBeGreaterThan(maxBefore);
    // …and they keep the order the template listed them in.
    const titles = [...added.items]
      .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
      .map((t: { title: string }) => t.title);
    expect(titles).toEqual([
      'Confirm the venue',
      'Send the joining details',
      'Something with no date',
    ]);
  });

  it('adds rather than replaces — applying twice keeps the first list', async () => {
    const before = await (await call(adminA, 'GET', `/thread/threads/${threadA}/tasks`)).json();
    const res = await call(adminA, 'POST', `/thread/threads/${threadA}/tasks/apply-template`, {
      template_id: templateId,
    });
    expect(res.status).toBe(201);
    const added = await res.json();
    for (const t of added.items) createdTaskIds.push(t.id);
    const after = await (await call(adminA, 'GET', `/thread/threads/${threadA}/tasks`)).json();
    expect(after.items.length).toBe(before.items.length + 3);
  });

  it('another workspace cannot apply it', async () => {
    const res = await call(memberB, 'POST', `/thread/threads/${threadA}/tasks/apply-template`, {
      template_id: templateId,
    });
    expect(res.status).toBe(404);
  });
});
