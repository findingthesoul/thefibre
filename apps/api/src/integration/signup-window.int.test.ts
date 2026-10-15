// The sign-up window, enforced on our own surfaces — against staging.
//
// Thread dates part 2 (2026-10-16): when sign-ups close (lib/thread-dates.ts)
// now decides
//   · the public thread's `enrolment_open` (with `signups_closed` saying why),
//   · whether a team-calendar thread is still on a member's calendar
//     (calendarVisible — couldJoin, the portal's Upcoming, member-notify).
// And deliberately NOT the enrol endpoint: an external app submits through
// it as the visitor (see the note in POST /public/enrol), so a hard gate
// there is a separate decision. Not exercised here — an enrolment creates an
// account and a person, and this release does not touch that route.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { createFixtureUser, createThrowawayWorkspace, deleteFixtureUser, deleteThrowawayWorkspace, service, type FixtureUser } from './staging.js';

let app: Hono;
let ws = '';
let organiser: FixtureUser;
let threadAppId = '';
let threadId = '';
let teamId = '';
let tierId = '';
let sessionId = '';
const orgSlug = `win-${randomUUID().slice(0, 8)}`;
const threadSlug = `win-${randomUUID().slice(0, 6)}`;
const made: { table: string; id: string }[] = [];
const at = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}
const publicThread = async () => {
  const r = await app.request(`/api/v1/thread/public/organiser/${orgSlug}/thread/${threadSlug}`);
  expect(r.status, await r.clone().text()).toBe(200);
  return (await r.json()).thread as Record<string, unknown>;
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
  ws = await createThrowawayWorkspace('signwin');
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: threadAppId }, { onConflict: 'workspace_id,app_id' });
  organiser = await createFixtureUser(ws, 'signwin');
  const organiserId = await insert('thread_organiser', { user_id: organiser.userId, workspace_id: ws, slug: orgSlug, display_name: 'Window Organiser' });
  const programId = await insert('program', {
    workspace_id: ws, app_id: threadAppId, title: 'Window', format: 'event', status: 'active',
    starts_on: at(-30).slice(0, 10), ends_on: at(60).slice(0, 10),
  });
  threadId = await insert('thread_thread', {
    workspace_id: ws, program_id: programId, organiser_id: organiserId, slug: threadSlug,
    timezone: 'Europe/Amsterdam', is_public_listed: true, public_enrolment_open: true,
  });
  sessionId = await insert('thread_engagement', {
    workspace_id: ws, thread_id: threadId, title: 'Opening', type: 'event', status: 'published', starts_at: at(10),
  });
}, 180_000);

afterAll(async () => {
  await service.from('thread_thread').update({ team_id: null, signups_close_engagement_id: null }).eq('id', threadId);
  await service.from('thread_engagement').delete().eq('thread_id', threadId);
  for (const { table, id } of made) {
    if (table === 'thread_engagement') continue;
    await service.from(table).delete().eq('id', id);
  }
  if (organiser) await deleteFixtureUser(organiser);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 180_000);

describe('the sign-up window on our own surfaces', () => {
  it('before the first session starts: open, and the page knows until when', async () => {
    const t = await publicThread();
    expect(t).toMatchObject({ enrolment_open: true, signups_closed: false });
    expect(Date.parse(t.signups_close_at as string)).toBe(Date.parse((await service.from('thread_engagement').select('starts_at').eq('id', sessionId).single()).data!.starts_at));
  });

  it('once it has started: the page is closed, and says it was the window', async () => {
    await service.from('thread_engagement').update({ starts_at: at(-1) }).eq('id', sessionId);
    expect(await publicThread()).toMatchObject({ enrolment_open: false, signups_closed: true });
  });

  it('a later key moment re-opens it — the organiser’s way to keep a journey open', async () => {
    await insert('thread_engagement', {
      workspace_id: ws, thread_id: threadId, title: 'Weekend', type: 'event', status: 'published', starts_at: at(20), is_key_moment: true,
    });
    expect(await publicThread()).toMatchObject({ enrolment_open: true, signups_closed: false });
  });

  it('the organiser’s own switch still closes it, and is not reported as the window', async () => {
    await service.from('thread_thread').update({ public_enrolment_open: false }).eq('id', threadId);
    expect(await publicThread()).toMatchObject({ enrolment_open: false, signups_closed: false });
    await service.from('thread_thread').update({ public_enrolment_open: true }).eq('id', threadId);
  });

  it('a team-calendar thread leaves the member calendar when its window closes, not before', async () => {
    await service.from('thread_engagement').update({ is_key_moment: false }).eq('thread_id', threadId);
    teamId = await insert('team', { workspace_id: ws, name: 'Choir', slug: `win-team-${randomUUID().slice(0, 6)}`, is_published: true, is_active: true });
    tierId = await insert('membership_tier', { workspace_id: ws, name: 'Singer' });
    await insert('membership_access_grant', { workspace_id: ws, tier_id: tierId, kind: 'team_calendar', config: { team_id: teamId } });
    await service.from('thread_thread').update({ team_id: teamId }).eq('id', threadId);

    const { calendarVisible } = await import('../lib/could-join.js');
    const { loadThreadDates } = await import('../lib/thread-dates.js');
    const { data: row } = await service
      .from('thread_thread')
      .select('id, team:team_id (is_published, is_active), program:program_id (status, starts_on, ends_on)')
      .eq('id', threadId)
      .single();
    const dates = (await loadThreadDates([threadId])).get(threadId)!;
    // On a team calendar with no key moment: today's rule, through its last day.
    expect(dates.closeRule).toBe('fallback');
    expect(calendarVisible(row as Record<string, unknown>, dates, new Date())).toBe(true);
    expect(calendarVisible(row as Record<string, unknown>, dates, new Date(Date.parse(dates.signupsCloseAt!) + 1000))).toBe(false);
  });
});
