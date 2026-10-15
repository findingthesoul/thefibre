// A thread's three dates — against staging, through the real routes.
//
// Sjoerd, 2026-10-16: the thread period (internal), the EVENT dates (from the
// sessions marked "key moment") and when SIGN-UPS CLOSE (a chosen session,
// else the first key moment, else the fallback: the first timed session —
// except a thread on a team calendar, which keeps today's rule). Slice 1
// writes and reports them; nothing is refused or hidden by them yet.

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
let ws = '';
let organiser: FixtureUser;
let threadAppId = '';
let threadId = '';
let programId = '';
let teamId = '';
let tierId = '';
let copyId = '';
const s: Record<'one' | 'two' | 'three' | 'msg', string> = { one: '', two: '', three: '', msg: '' };
const made: { table: string; id: string }[] = [];
const day = (n: number, hh = 15) => {
  const d = new Date(Date.now() + n * 86_400_000);
  d.setUTCHours(hh, 0, 0, 0);
  return d.toISOString();
};

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

const call = (path: string, init: RequestInit = {}) =>
  app.request(`/api/v1/thread${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${organiser.accessToken}`, 'X-App-ID': 'the-thread', 'Content-Type': 'application/json' },
  });
const editorDates = async () => {
  const r = await call(`/threads/${threadId}`);
  expect(r.status, await r.clone().text()).toBe(200);
  return (await r.json()).dates as Record<string, unknown>;
};

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  threadAppId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id;
  ws = await createThrowawayWorkspace('tdates');
  organiser = await createFixtureUser(ws, 'tdates');
  await service.from('workspace_member').upsert({ workspace_id: ws, user_id: organiser.userId, workspace_role: 'admin' });
  await service.from('app_membership').upsert({ user_id: organiser.userId, app_id: threadAppId, role: 'admin' }, { onConflict: 'user_id,app_id' });
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: threadAppId }, { onConflict: 'workspace_id,app_id' });
  const organiserId = await insert('thread_organiser', { user_id: organiser.userId, workspace_id: ws, slug: `tdates-${randomUUID().slice(0, 8)}` });
  programId = await insert('program', {
    workspace_id: ws, app_id: threadAppId, title: 'Journey', format: 'event', status: 'draft',
    starts_on: day(1).slice(0, 10), ends_on: day(60).slice(0, 10),
  });
  threadId = await insert('thread_thread', { workspace_id: ws, program_id: programId, organiser_id: organiserId, slug: `tdates-${randomUUID().slice(0, 6)}`, timezone: 'Europe/Amsterdam' });
  const ev = (title: string, starts: string) => ({ workspace_id: ws, thread_id: threadId, title, type: 'event', status: 'published', starts_at: starts });
  s.one = await insert('thread_engagement', ev('Preparation call', day(5)));
  s.two = await insert('thread_engagement', ev('Opening weekend', day(20)));
  s.three = await insert('thread_engagement', ev('Closing weekend', day(50)));
  s.msg = await insert('thread_engagement', { workspace_id: ws, thread_id: threadId, title: 'Welcome', type: 'message', status: 'published', trigger_kind: 'on_enrolment' });
}, 180_000);

afterAll(async () => {
  for (const t of [threadId, copyId].filter(Boolean)) {
    await service.from('thread_thread').update({ signups_close_engagement_id: null }).eq('id', t);
    await service.from('thread_engagement').delete().eq('thread_id', t);
  }
  if (copyId) {
    const { data } = await service.from('thread_thread').select('program_id').eq('id', copyId).maybeSingle();
    await service.from('thread_thread').delete().eq('id', copyId);
    if (data?.program_id) await service.from('program').delete().eq('id', data.program_id);
  }
  for (const { table, id } of made) {
    if (table === 'thread_engagement') continue;
    await service.from(table).delete().eq('id', id);
  }
  await service.from('app_membership').delete().eq('user_id', organiser.userId);
  await service.from('workspace_member').delete().eq('user_id', organiser.userId);
  await deleteFixtureUser(organiser);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 180_000);

describe('the three dates', () => {
  it('no key moment, no team calendar: sign-ups close when the first timed session starts', async () => {
    const d = await editorDates();
    expect(d).toMatchObject({ key_moment_count: 0, event_starts_at: null, close_rule: 'fallback' });
    expect(Date.parse(d.signups_close_at as string)).toBe(Date.parse(day(5)));
  });

  it('starring sessions through the editor route gives event dates, and the first key moment closes sign-ups', async () => {
    for (const id of [s.two, s.three]) {
      const r = await call(`/engagements/${id}`, { method: 'PATCH', body: JSON.stringify({ is_key_moment: true }) });
      expect(r.status, await r.clone().text()).toBe(200);
    }
    const d = await editorDates();
    expect(d).toMatchObject({ key_moment_count: 2, close_rule: 'first_key_moment' });
    expect(Date.parse(d.event_starts_at as string)).toBe(Date.parse(day(20)));
    expect(Date.parse(d.event_ends_at as string)).toBe(Date.parse(day(50)));
    expect(Date.parse(d.signups_close_at as string)).toBe(Date.parse(day(20)));
  });

  it('a draft key moment does not make public dates', async () => {
    await service.from('thread_engagement').update({ status: 'draft' }).eq('id', s.three);
    expect((await editorDates()).key_moment_count).toBe(1);
    await service.from('thread_engagement').update({ status: 'published' }).eq('id', s.three);
  });

  it('"open until session N" wins, and is refused for a session that is not this thread’s or has no start', async () => {
    const ok = await call(`/threads/${threadId}`, { method: 'PATCH', body: JSON.stringify({ signups_close_engagement_id: s.three }) });
    expect(ok.status, await ok.clone().text()).toBe(200);
    const d = await editorDates();
    expect(d.close_rule).toBe('session');
    expect(Date.parse(d.signups_close_at as string)).toBe(Date.parse(day(50)));

    const untimed = await call(`/threads/${threadId}`, { method: 'PATCH', body: JSON.stringify({ signups_close_engagement_id: s.msg }) });
    expect(untimed.status).toBe(400);
    const foreign = await call(`/threads/${threadId}`, { method: 'PATCH', body: JSON.stringify({ signups_close_engagement_id: randomUUID() }) });
    expect(foreign.status).toBe(400);
    const { data } = await service.from('thread_thread').select('signups_close_engagement_id').eq('id', threadId).single();
    expect(data!.signups_close_engagement_id).toBe(s.three);
  });

  it('reordering the timeline does not move the deadline (it is the session, not a position)', async () => {
    await service.from('thread_engagement').update({ position: 99 }).eq('id', s.three);
    await service.from('thread_engagement').update({ position: 0 }).eq('id', s.one);
    expect(Date.parse((await editorDates()).signups_close_at as string)).toBe(Date.parse(day(50)));
  });

  it('a duplicate closes at the COPY of that session, and carries the stars', async () => {
    const r = await call(`/threads/${threadId}/duplicate`, { method: 'POST', body: JSON.stringify({}) });
    expect(r.status, await r.clone().text()).toBe(201);
    copyId = (await r.json()).id;
    const { data: copy } = await service.from('thread_thread').select('signups_close_engagement_id').eq('id', copyId).single();
    const { data: closeRow } = await service.from('thread_engagement').select('thread_id, title').eq('id', copy!.signups_close_engagement_id).single();
    expect(closeRow).toEqual({ thread_id: copyId, title: 'Closing weekend' });
    const { count } = await service.from('thread_engagement').select('id', { count: 'exact', head: true }).eq('thread_id', copyId).eq('is_key_moment', true);
    expect(count).toBe(2);
  });

  it('ON a team calendar with no key moment: today’s rule — the end of the last day in the thread’s zone', async () => {
    await service.from('thread_thread').update({ signups_close_engagement_id: null }).eq('id', threadId);
    await service.from('thread_engagement').update({ is_key_moment: false }).eq('thread_id', threadId);
    teamId = await insert('team', { workspace_id: ws, name: 'Choir', slug: `tdates-team-${randomUUID().slice(0, 6)}`, is_published: true, is_active: true });
    tierId = await insert('membership_tier', { workspace_id: ws, name: 'Singer' });
    await insert('membership_access_grant', { workspace_id: ws, tier_id: tierId, kind: 'team_calendar', config: { team_id: teamId } });
    await service.from('thread_thread').update({ team_id: teamId }).eq('id', threadId);
    const { loadThreadDates } = await import('../lib/thread-dates.js');
    const { startOfDayAfter } = await import('@thefibre/shared/thread-dates');
    const d = (await loadThreadDates([threadId])).get(threadId)!;
    expect(d.closeRule).toBe('fallback');
    expect(d.signupsCloseAt).toBe(startOfDayAfter(day(60).slice(0, 10), 'Europe/Amsterdam'));
    await service.from('thread_thread').update({ team_id: null }).eq('id', threadId);
  });

  it('the date tags fill in a message', async () => {
    await service.from('thread_engagement').update({ is_key_moment: true }).in('id', [s.two, s.three]);
    const { threadTokenContext } = await import('../lib/main-facilitator.js');
    const { messageTokens, substituteTokens } = await import('../lib/message-tokens.js');
    const tokens = messageTokens({ name: 'Marja', threadTitle: 'Journey', organiserName: 'Olga', ...(await threadTokenContext(threadId)) });
    const out = substituteTokens('{sessions} sessions, {event_dates}; sign up by {signups_close}', tokens);
    expect(out).toMatch(/^2 sessions, \d{1,2} \w+ \d{4} – \d{1,2} \w+ \d{4}; sign up by \d{1,2} \w+ \d{4}$/);
  });
});
