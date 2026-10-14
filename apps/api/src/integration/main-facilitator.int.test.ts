// The main facilitator — against staging, through the real routes. Needs
// migration 20261014190050_main_facilitator.
//
// Sjoerd, 2026-10-14: "I made the thread. But someone else will facilitate.
// Problem is that the Virtual room should be from the main facilitator."
// The promises (lib/main-facilitator.ts, approved design + four guards):
//   · a personal-room session meets in the MAIN FACILITATOR's room, decided
//     by the server whoever saves it — not the saver's room;
//   · choosing a main facilitator moves FUTURE personal-room sessions in the
//     old room (a), never a typed link or a past one (b), and queues each as
//     a calendar change saying why;
//   · that person changing their own room moves the threads they run (c);
//   · removing them falls back to the organiser, propagated and queued (d);
//   · only this thread's account-holding hosts can be chosen; a session's
//     exclusion list only names this thread's hosts;
//   · Meet/Zoom are minted on their account only with THEIR yes.

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
let lib: typeof import('../lib/main-facilitator.js');
let connections: typeof import('../lib/connections.js');
let ws = '';
let organiser: FixtureUser;
let facilitator: FixtureUser;
let threadId = '';
let organiserRowId = '';
let facilitatorOrgId = '';
let mainRowId = '';
const ROOM_A = `https://meet.example/org-${randomUUID().slice(0, 6)}`;
const ROOM_B = `https://meet.example/fac-${randomUUID().slice(0, 6)}`;
const ROOM_B2 = `https://meet.example/fac2-${randomUUID().slice(0, 6)}`;
const made: { table: string; id: string }[] = [];
const ids = { future: '', past: '', typed: '' };

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

const call = (path: string, init: RequestInit = {}, who: FixtureUser = organiser) =>
  app.request(`/api/v1/thread${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${who.accessToken}`, 'X-App-ID': 'the-thread', 'Content-Type': 'application/json' },
  });

const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const urlOf = async (id: string) =>
  (await service.from('thread_engagement').select('meeting_url').eq('id', id).single()).data!.meeting_url as string | null;
const pendingFor = async (id: string) =>
  (await service.from('thread_calendar_change').select('kind, reason').eq('engagement_id', id).is('sent_at', null).maybeSingle()).data;

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  lib = await import('../lib/main-facilitator.js');
  connections = await import('../lib/connections.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  const threadAppId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id;
  ws = await createThrowawayWorkspace('mainfac');
  organiser = await createFixtureUser(ws, 'mf-org');
  facilitator = await createFixtureUser(ws, 'mf-fac');
  for (const u of [organiser, facilitator]) {
    await service.from('workspace_member').upsert({ workspace_id: ws, user_id: u.userId, workspace_role: 'admin' });
    await service.from('app_membership').upsert({ user_id: u.userId, app_id: threadAppId, role: 'admin' }, { onConflict: 'user_id,app_id' });
  }
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: threadAppId }, { onConflict: 'workspace_id,app_id' });
  // Adding sessions is a paid-plan feature; this test is not about plans.
  const { error: subErr } = await service
    .from('workspace_subscription')
    .upsert({ workspace_id: ws, plan_id: 'pro', status: 'active' }, { onConflict: 'workspace_id' });
  if (subErr) throw new Error(`workspace_subscription fixture: ${subErr.message}`);
  await connections.savePersonalRoom(organiser.userId, ROOM_A);
  await connections.savePersonalRoom(facilitator.userId, ROOM_B);

  organiserRowId = await insert('thread_organiser', { user_id: organiser.userId, workspace_id: ws, slug: `mf-o-${randomUUID().slice(0, 6)}` });
  facilitatorOrgId = await insert('thread_organiser', { user_id: facilitator.userId, workspace_id: ws, slug: `mf-f-${randomUUID().slice(0, 6)}` });
  const program = await insert('program', { workspace_id: ws, app_id: threadAppId, title: 'Main facilitator', format: 'event', status: 'draft' });
  threadId = await insert('thread_thread', { workspace_id: ws, program_id: program, organiser_id: organiserRowId, slug: `mf-${randomUUID().slice(0, 6)}` });
  mainRowId = await insert('thread_thread_organiser', { thread_id: threadId, organiser_id: facilitatorOrgId, role: 'facilitator' });

  // Three sessions in the organiser's room, as the old code would have
  // stored them: a future one, a past one, and one with a typed link.
  const base = { workspace_id: ws, thread_id: threadId, type: 'event', status: 'published', show_in_agenda: true, meeting_provider: 'personal_room' };
  ids.future = await insert('thread_engagement', { ...base, title: 'Future', starts_at: day(10), ends_at: day(10.05), meeting_url: ROOM_A, calendar_sent_at: day(-1) });
  ids.past = await insert('thread_engagement', { ...base, title: 'Past', starts_at: day(-10), ends_at: day(-9.95), meeting_url: ROOM_A, calendar_sent_at: day(-20) });
  ids.typed = await insert('thread_engagement', { ...base, title: 'Typed', starts_at: day(12), ends_at: day(12.05), meeting_url: 'https://meet.example/special', calendar_sent_at: day(-1) });
}, 180_000);

afterAll(async () => {
  await service.from('thread_calendar_change').delete().eq('thread_id', threadId);
  await service.from('thread_engagement').delete().eq('thread_id', threadId);
  await service.from('thread_thread').update({ main_facilitator_id: null }).eq('id', threadId);
  await service.from('thread_thread_organiser').delete().eq('thread_id', threadId);
  for (const { table, id } of made) await service.from(table).delete().eq('id', id);
  for (const u of [organiser, facilitator]) {
    await service.from('user_connection').delete().eq('user_id', u.userId);
    await service.from('app_membership').delete().eq('user_id', u.userId);
    await service.from('workspace_member').delete().eq('user_id', u.userId);
    await deleteFixtureUser(u);
  }
  if (ws) await deleteThrowawayWorkspace(ws);
}, 180_000);

describe('the main facilitator', () => {
  it('only this thread’s account-holding hosts can be chosen', async () => {
    const res = await call(`/threads/${threadId}`, { method: 'PATCH', body: JSON.stringify({ main_facilitator_id: randomUUID() }) });
    expect(res.status).toBe(400);
  });

  it('choosing one moves future personal-room sessions — not past ones, not typed links — and queues why', async () => {
    const res = await call(`/threads/${threadId}`, { method: 'PATCH', body: JSON.stringify({ main_facilitator_id: mainRowId }) });
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await urlOf(ids.future)).toBe(ROOM_B);
    expect(await urlOf(ids.past), '(a) past keeps its room').toBe(ROOM_A);
    expect(await urlOf(ids.typed), '(b) a typed link is never overwritten').toBe('https://meet.example/special');
    const q = await pendingFor(ids.future);
    expect(q?.kind).toBe('moved');
    expect(q?.reason).toMatch(/is now the main facilitator/);
    expect(await pendingFor(ids.past)).toBeNull();
  });

  it('a new personal-room session meets in the MAIN facilitator’s room, whoever saves it', async () => {
    const res = await call(`/threads/${threadId}/engagements`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Made by the organiser', type: 'event', status: 'draft', starts_at: day(20), ends_at: day(20.05), meeting_provider: 'personal_room', meeting_url: ROOM_A }),
    });
    expect(res.status, await res.clone().text()).toBe(201);
    const row = await res.json();
    made.unshift({ table: 'thread_engagement', id: row.id });
    expect(row.meeting_url, 'not the saver’s room').toBe(ROOM_B);
    expect(row.meeting_account_user_id).toBe(facilitator.userId);
  });

  it('(c) the facilitator changing their own room moves the sessions they run', async () => {
    await connections.savePersonalRoom(facilitator.userId, ROOM_B2);
    expect(await urlOf(ids.future)).toBe(ROOM_B2);
    expect((await pendingFor(ids.future))?.reason).toMatch(/updated their personal room/);
  });

  it('a session’s exclusion list only names this thread’s hosts', async () => {
    const bad = await call(`/engagements/${ids.future}`, { method: 'PATCH', body: JSON.stringify({ excluded_people: [randomUUID()] }) });
    expect(bad.status).toBe(400);
    const ok = await call(`/engagements/${ids.future}`, { method: 'PATCH', body: JSON.stringify({ excluded_people: [mainRowId] }) });
    expect(ok.status, await ok.clone().text()).toBe(200);
    expect((await service.from('thread_engagement').select('excluded_people').eq('id', ids.future).single()).data!.excluded_people).toEqual([mainRowId]);
  });

  it('Meet/Zoom go on their account only with THEIR yes', async () => {
    expect(await lib.mintingAccount(threadId, organiser.userId)).toEqual({ userId: organiser.userId, onBehalf: false });
    await connections.saveAllowOrganiserMeetings(facilitator.userId, true);
    expect(await lib.mintingAccount(threadId, organiser.userId)).toEqual({ userId: facilitator.userId, onBehalf: true });
    await connections.saveAllowOrganiserMeetings(facilitator.userId, false);
  });

  it('(d) removing the main facilitator falls back to the organiser’s room, queued', async () => {
    const res = await call(`/threads/${threadId}/members/${facilitatorOrgId}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect((await service.from('thread_thread').select('main_facilitator_id').eq('id', threadId).single()).data!.main_facilitator_id).toBeNull();
    expect(await urlOf(ids.future)).toBe(ROOM_A);
    expect((await pendingFor(ids.future))?.reason).toMatch(/no longer on this thread/);
  });
});
