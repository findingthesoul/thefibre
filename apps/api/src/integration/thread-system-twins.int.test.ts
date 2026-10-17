// The automatic welcome had to be deleted TWICE (Sjoerd, production,
// 2026-10-17, a new team thread "Fellowship - basic training"). Against
// staging, the real routes, a fixture organiser in a throwaway workspace.
//
// The cause, reproduced here first: a template saved before 2026-10-15
// carried its "You're enrolled" as an ORDINARY message (templates did not
// carry system_role yet), and the first editor load seeded the real one
// beside it — two identical-looking rows, both sent, only one with the
// ticket.
//
// Pinned:
//   · an OLD template: the copy is ADOPTED as the system message on the
//     first load — one row, carrying the role; one delete removes it for
//     good;
//   · a NEW template (system_role carried): one row, as before;
//   · a plain new thread: one seeded row, one delete;
//   · an organiser's own on_enrolment message with another title is left
//     alone and a system message is seeded beside it;
//   · a thread that ALREADY has both: nothing is changed, and the editor's
//     read flags the copy (system_twin_of) so the organiser can choose.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { createFixtureUser, createThrowawayWorkspace, deleteFixtureUser, deleteThrowawayWorkspace, service, type FixtureUser } from './staging.js';

let app: Hono;
let ws = '';
let u: FixtureUser | undefined;
let teamId = '';
const WELCOME = "You're enrolled: {title}";

const call = (method: string, path: string, body?: unknown) =>
  app.request(`/api/v1/thread${path}`, {
    method,
    headers: { Authorization: `Bearer ${u!.accessToken}`, 'X-App-ID': 'the-thread', 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

type Row = { id: string; system_role: string | null; title: string };
const rowsOf = async (threadId: string): Promise<Row[]> =>
  ((await service.from('thread_engagement').select('id, system_role, title').eq('thread_id', threadId).order('created_at')).data ?? []) as Row[];

async function fromTemplate(engagements: Record<string, unknown>[]): Promise<string> {
  const { data: tpl, error } = await service
    .from('thread_template')
    .insert({ workspace_id: ws, kind: 'thread', title: `T ${randomUUID().slice(0, 4)}`, scope: 'workspace', structure: { format: 'journey', engagements }, created_by: u!.userId })
    .select('id')
    .single();
  if (error) throw new Error(`template fixture: ${error.message}`);
  const r = await call('POST', `/thread-templates/${tpl!.id}/instantiate`, { title: 'Fellowship - basic training', slug: `fbt-${randomUUID().slice(0, 6)}` });
  expect(r.status, await r.clone().text()).toBe(201);
  return ((await r.json()) as { id: string }).id;
}

const welcome = (over: Record<string, unknown> = {}) => ({
  type: 'message', title: WELCOME, description: 'Welcome!', trigger_kind: 'on_enrolment', position: -2, status: 'published', show_in_agenda: false, ...over,
});

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);
  ws = await createThrowawayWorkspace('system-twins');
  u = await createFixtureUser(ws, 'systwins');
  await service.from('workspace_member').insert({ workspace_id: ws, user_id: u.userId, workspace_role: 'admin' });
  const threadApp = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id as string;
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: threadApp }, { onConflict: 'workspace_id,app_id' });
  await service.from('app_membership').upsert({ user_id: u.userId, app_id: threadApp, role: 'admin' }, { onConflict: 'user_id,app_id' });
  await service.from('thread_organiser').insert({ user_id: u.userId, workspace_id: ws, slug: `org-${randomUUID().slice(0, 6)}` });
  teamId = (await service.from('team').insert({ workspace_id: ws, name: 'Fellowship', slug: `fellow-${randomUUID().slice(0, 6)}` }).select('id').single()).data!.id as string;
  await service.from('team_member').insert({ team_id: teamId, user_id: u.userId, role: 'lead', status: 'active' });
}, 180_000);

afterAll(async () => {
  if (u) {
    await service.from('app_membership').delete().eq('user_id', u.userId);
    await service.from('team_member').delete().eq('user_id', u.userId);
    await service.from('workspace_member').delete().eq('user_id', u.userId);
    await deleteFixtureUser(u);
  }
  if (ws) await deleteThrowawayWorkspace(ws);
}, 180_000);

describe('the automatic welcome is one row, deleted once', () => {
  it('an OLD template: its copy is adopted on the first load, and one delete removes it for good', async () => {
    const id = await fromTemplate([welcome()]);
    await call('GET', `/threads/${id}`);
    const rows = await rowsOf(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ system_role: 'enrolment_confirmed', title: WELCOME });
    expect((await call('DELETE', `/engagements/${rows[0]!.id}`)).status).toBe(204);
    await call('GET', `/threads/${id}`);
    expect(await rowsOf(id)).toEqual([]);
  });

  it('a NEW template (role carried): one row', async () => {
    const id = await fromTemplate([welcome({ system_role: 'enrolment_confirmed' })]);
    await call('GET', `/threads/${id}`);
    const rows = await rowsOf(id);
    expect(rows.map((r) => r.system_role)).toEqual(['enrolment_confirmed']);
  });

  it('a plain new team thread: one seeded row, one delete', async () => {
    const r = await call('POST', '/threads', { title: 'Fellowship - basic training', format: 'journey', slug: `fb-${randomUUID().slice(0, 6)}`, team_id: teamId, public_scope: 'team' });
    expect(r.status, await r.clone().text()).toBe(201);
    const id = ((await r.json()) as { id: string }).id;
    await call('GET', `/threads/${id}`);
    const rows = await rowsOf(id);
    expect(rows.map((x) => x.system_role)).toEqual(['enrolment_confirmed']);
    await call('DELETE', `/engagements/${rows[0]!.id}`);
    await call('GET', `/threads/${id}`);
    expect(await rowsOf(id)).toEqual([]);
  });

  it("the organiser's own on_enrolment message is left alone", async () => {
    const id = await fromTemplate([welcome({ title: 'Welcome to the fellowship!' })]);
    await call('GET', `/threads/${id}`);
    const rows = await rowsOf(id);
    expect(rows.map((r) => [r.system_role, r.title]).sort()).toEqual(
      [[null, 'Welcome to the fellowship!'], ['enrolment_confirmed', WELCOME]].sort(),
    );
  });
});

describe('a thread that already has both', () => {
  it('nothing is changed, and the editor flags the copy', async () => {
    const id = await fromTemplate([welcome()]);
    // As production has them: the system row, and the copy beside it.
    await service.from('thread_thread').update({ system_messages_seeded: ['enrolment_confirmed'] }).eq('id', id);
    await service.from('thread_engagement').insert({
      workspace_id: ws, thread_id: id, system_role: 'enrolment_confirmed', type: 'message', status: 'published',
      trigger_kind: 'on_enrolment', title: WELCOME, description: 'seeded', show_in_agenda: false, position: -2,
    });
    const before = await rowsOf(id);
    expect(before).toHaveLength(2);
    const g = await call('GET', `/threads/${id}`);
    const j = (await g.json()) as { engagements: { id: string; system_role: string | null; system_twin_of: string | null }[] };
    const copy = before.find((r) => !r.system_role)!;
    const sys = before.find((r) => r.system_role)!;
    expect(j.engagements.find((e) => e.id === copy.id)?.system_twin_of).toBe('enrolment_confirmed');
    expect(j.engagements.find((e) => e.id === sys.id)?.system_twin_of).toBeNull();
    expect(await rowsOf(id)).toEqual(before);
  });
});
