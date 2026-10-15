// Moving a thread's start date — with and without its sessions. Against
// staging, through the real editor route.
//
// Sjoerd, 2026-10-15: "In principle great behaviour, except that I did not
// want it. Maybe it should ask." The editor now asks; the answer reaches the
// API as move_sessions:
//   · true (and absent, for every other caller): everything dated moves by
//     the same number of days, the end date too — and a multi-day session's
//     per-day dates now move with it (they did not);
//   · false: only the start date changes.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { createFixtureUser, createThrowawayWorkspace, deleteFixtureUser, deleteThrowawayWorkspace, service, type FixtureUser } from './staging.js';

let app: Hono;
let ws = '';
let organiser: FixtureUser;
let threadId = '';
let programId = '';
let sessionId = '';
let multiDayId = '';
const made: { table: string; id: string }[] = [];

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}
const patch = (body: Record<string, unknown>) =>
  app.request(`/api/v1/thread/threads/${threadId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${organiser.accessToken}`, 'X-App-ID': 'the-thread', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const state = async () => {
  const { data: p } = await service.from('program').select('starts_on, ends_on').eq('id', programId).single();
  const { data: s } = await service.from('thread_engagement').select('starts_at').eq('id', sessionId).single();
  const { data: m } = await service.from('thread_engagement').select('starts_at, daily_schedule').eq('id', multiDayId).single();
  return { p, s, m };
};

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);
  const appId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id;
  ws = await createThrowawayWorkspace('shift');
  organiser = await createFixtureUser(ws, 'shift');
  await service.from('workspace_member').upsert({ workspace_id: ws, user_id: organiser.userId, workspace_role: 'admin' });
  await service.from('app_membership').upsert({ user_id: organiser.userId, app_id: appId, role: 'admin' }, { onConflict: 'user_id,app_id' });
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: appId }, { onConflict: 'workspace_id,app_id' });
  const orgId = await insert('thread_organiser', { user_id: organiser.userId, workspace_id: ws, slug: `shift-${randomUUID().slice(0, 8)}` });
  programId = await insert('program', { workspace_id: ws, app_id: appId, title: 'Shift', format: 'event', status: 'draft', starts_on: '2027-01-10', ends_on: '2027-03-31' });
  threadId = await insert('thread_thread', { workspace_id: ws, program_id: programId, organiser_id: orgId, slug: `shift-${randomUUID().slice(0, 6)}` });
  sessionId = await insert('thread_engagement', { workspace_id: ws, thread_id: threadId, title: 'Session', type: 'event', status: 'draft', starts_at: '2027-01-12T14:00:00.000Z' });
  multiDayId = await insert('thread_engagement', {
    workspace_id: ws, thread_id: threadId, title: 'Weekend', type: 'event', status: 'draft',
    starts_at: '2027-02-06T09:00:00.000Z', ends_at: '2027-02-07T17:00:00.000Z',
    daily_schedule: [{ date: '2027-02-06', start: '10:00', end: '18:00' }, { date: '2027-02-07', start: '10:00', end: '17:00' }],
  });
}, 120_000);

afterAll(async () => {
  await service.from('thread_engagement').delete().eq('thread_id', threadId);
  for (const { table, id } of made) {
    if (table === 'thread_engagement') continue;
    await service.from(table).delete().eq('id', id);
  }
  await service.from('app_membership').delete().eq('user_id', organiser.userId);
  await service.from('workspace_member').delete().eq('user_id', organiser.userId);
  if (organiser) await deleteFixtureUser(organiser);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 120_000);

describe('moving the start date', () => {
  it('"Only change the start date": nothing else moves', async () => {
    const r = await patch({ starts_on: '2027-01-17', move_sessions: false });
    expect(r.status, await r.clone().text()).toBe(200);
    const { p, s, m } = await state();
    expect(p).toEqual({ starts_on: '2027-01-17', ends_on: '2027-03-31' });
    expect(s!.starts_at).toBe('2027-01-12T14:00:00+00:00');
    expect((m!.daily_schedule as { date: string }[]).map((d) => d.date)).toEqual(['2027-02-06', '2027-02-07']);
  });

  it('"Move sessions too": everything dated moves by the same days — the per-day schedule as well', async () => {
    const r = await patch({ starts_on: '2027-01-24', move_sessions: true });
    expect(r.status).toBe(200);
    const { p, s, m } = await state();
    expect(p).toEqual({ starts_on: '2027-01-24', ends_on: '2027-04-07' });
    expect(Date.parse(s!.starts_at as string)).toBe(Date.parse('2027-01-19T14:00:00Z'));
    expect((m!.daily_schedule as { date: string }[]).map((d) => d.date)).toEqual(['2027-02-13', '2027-02-14']);
  });

  it('absent move_sessions keeps the old behaviour for every other caller', async () => {
    const r = await patch({ starts_on: '2027-01-17' });
    expect(r.status).toBe(200);
    const { s } = await state();
    expect(Date.parse(s!.starts_at as string)).toBe(Date.parse('2027-01-12T14:00:00Z'));
  });
});
