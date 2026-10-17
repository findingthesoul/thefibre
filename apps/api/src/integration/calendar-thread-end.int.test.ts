// A whole thread ending takes its sessions out of people's calendars
// (calendar gaps, slice 3, 2026-10-17). Against staging's database; mail is
// RECORDED, never sent.
//
// Pinned:
//   · who gets a CANCEL: REQUEST rows; for a session sent before the record
//     existed, every live participant; the invited hosts — not someone
//     already cancelled, not a past session, not a session that never went
//     out;
//   · end-reach (the dialog's count) = the people and sessions the send uses;
//   · ARCHIVE: CANCELs at the bumped sequence, the rows flipped to CANCEL —
//     and archiving again sends nothing;
//   · DELETE, the ORDER (coordinator, 2026-10-17): the plan is read BEFORE
//     the delete cascades the held rows away — a recipient known ONLY from a
//     held row still gets their CANCEL, though the row is gone afterwards.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { createFixtureUser, createThrowawayWorkspace, deleteFixtureUser, deleteThrowawayWorkspace, service, type FixtureUser } from './staging.js';

type Sent = { to: string; subject: string; attachments?: { content: string; contentType?: string }[] };
const sent: Sent[] = [];
vi.mock('../lib/email/client.js', async (orig) => ({
  ...(await orig<typeof import('../lib/email/client.js')>()),
  sendEmail: async (m: Sent) => {
    sent.push(m);
  },
}));

const DAY = 86_400_000;
const now = new Date();
const tag = randomUUID().slice(0, 6);
const email = (who: string) => `int-end-${who}-${tag}@example.com`;
let ws = '';
let admin: FixtureUser;
let app: Hono;

async function makeThread(label: string) {
  const threadApp = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id as string;
  const org = (await service.from('thread_organiser').select('id').eq('user_id', admin.userId).maybeSingle()).data?.id as string | undefined;
  const organiser = org ?? ((await service.from('thread_organiser').insert({ user_id: admin.userId, workspace_id: ws, slug: `end-${tag}`, display_name: 'End Organiser' }).select('id').single()).data!.id as string);
  const program = (await service.from('program').insert({ workspace_id: ws, app_id: threadApp, title: `End ${label}`, format: 'journey', status: 'active' }).select('id').single()).data!.id as string;
  const thread = (await service.from('thread_thread').insert({ workspace_id: ws, program_id: program, organiser_id: organiser, slug: `end-${label}-${tag}` }).select('id').single()).data!.id as string;
  const session = async (title: string, inDays: number, sentBefore: boolean, hosts: string[] = []) =>
    (await service.from('thread_engagement').insert({
      workspace_id: ws, thread_id: thread, type: 'event', title, status: 'published', show_in_agenda: true,
      starts_at: new Date(now.getTime() + inDays * DAY).toISOString(), calendar_sequence: 2,
      calendar_sent_at: sentBefore ? new Date(now.getTime() - DAY).toISOString() : null, invited_hosts: hosts, position: 1,
    }).select('id').single()).data!.id as string;
  const place = async (who: string) => {
    const person = (await service.from('person').insert({ workspace_id: ws, first_name: who, email: email(who) }).select('id').single()).data!.id as string;
    const enr = (await service.from('enrolment').insert({ program_id: program, person_id: person, status: 'enrolled' }).select('id').single()).data!.id as string;
    await service.from('thread_enrolment').insert({ workspace_id: ws, thread_id: thread, enrolment_id: enr, person_id: person, request_id: `int-end-${randomUUID()}` });
  };
  return { thread, program, session, place };
}
const held = (thread: string, engagement: string, who: string, method: 'REQUEST' | 'CANCEL') =>
  service.from('thread_calendar_held').insert({ workspace_id: ws, thread_id: thread, engagement_id: engagement, email: email(who), method, sequence: 2, source: 'window' });
const cancelsTo = () => sent.filter((m) => m.attachments?.[0]?.contentType?.includes('method=CANCEL')).map((m) => m.to.split('-')[2]).sort();

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);
  ws = await createThrowawayWorkspace('calendar-end');
  admin = await createFixtureUser(ws, 'end-admin');
  await service.from('workspace_member').insert({ workspace_id: ws, user_id: admin.userId, workspace_role: 'admin' });
  const threadApp = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id as string;
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: threadApp }, { onConflict: 'workspace_id,app_id' });
  await service.from('app_membership').upsert({ user_id: admin.userId, app_id: threadApp, role: 'admin' }, { onConflict: 'user_id,app_id' });
}, 180_000);

afterAll(async () => {
  await service.from('thread_calendar_held').delete().eq('workspace_id', ws);
  const { data: threads } = await service.from('thread_thread').select('id, program_id').eq('workspace_id', ws);
  for (const t of threads ?? []) {
    await service.from('thread_enrolment').delete().eq('thread_id', t.id);
    await service.from('thread_engagement').delete().eq('thread_id', t.id);
    await service.from('thread_thread').delete().eq('id', t.id);
    await service.from('enrolment').delete().eq('program_id', t.program_id);
    await service.from('program').delete().eq('id', t.program_id);
  }
  await service.from('program').delete().eq('workspace_id', ws);
  await service.from('thread_organiser').delete().eq('workspace_id', ws);
  if (admin) {
    await service.from('app_membership').delete().eq('user_id', admin.userId);
    await service.from('workspace_member').delete().eq('user_id', admin.userId);
    await deleteFixtureUser(admin);
  }
  if (ws) expect(await deleteThrowawayWorkspace(ws)).toBe(true);
}, 180_000);

describe('archiving a thread', () => {
  it('cancels what people hold, counts it first, and sends nothing twice', async () => {
    const t = await makeThread('archive');
    const sentSession = await t.session('Sent before', 10, true, [email('host')]); // an organiser SEND went out
    const windowSession = await t.session('By window', 12, false);
    await t.session('Never sent', 14, false); // nobody holds it
    await t.session('Past', -3, true); // over
    await t.place('ann');
    await t.place('bob');
    await held(t.thread, windowSession, 'ann', 'REQUEST');
    await held(t.thread, sentSession, 'bob', 'CANCEL'); // already taken out of bob's calendar

    const { planThreadEnd, endReach, sendThreadEnd } = await import('../lib/calendar-thread-end.js');
    const plan = await planThreadEnd(t.thread, now);
    expect(endReach(plan)).toEqual({ people: 2, sessions: 2 }); // ann, host (bob already cancelled)
    const reach = await app.request(`/api/v1/thread/threads/${t.thread}/end-reach`, { headers: { Authorization: `Bearer ${admin.accessToken}`, 'X-App-ID': 'the-thread' } });
    expect(await reach.json()).toEqual({ people: 2, sessions: 2 });

    sent.length = 0;
    const r = await sendThreadEnd(plan!, { record: true });
    expect(r).toEqual({ sent: 3, failed: 0, total: 3 }); // Sent before → ann + host; By window → ann
    expect(cancelsTo()).toEqual(['ann', 'ann', 'host']);
    const ics = Buffer.from(sent[0]!.attachments![0]!.content, 'base64').toString('utf8');
    expect(ics).toContain('METHOD:CANCEL');
    expect(ics).toMatch(/\r\nSEQUENCE:3\r\n/);
    const { data: rows } = await service.from('thread_calendar_held').select('email, method').eq('thread_id', t.thread);
    expect((rows ?? []).every((x) => x.method === 'CANCEL')).toBe(true);

    // Archiving again: everyone is already cancelled.
    expect(endReach(await planThreadEnd(t.thread, now))).toEqual({ people: 0, sessions: 0 });
  });
});

describe('deleting a thread', () => {
  it('reads who holds what BEFORE the delete cascades it away, then cancels', async () => {
    const t = await makeThread('delete');
    const s = await t.session('Held only', 9, false);
    // A recipient known ONLY from a held row (no place, no send history).
    await held(t.thread, s, 'carol', 'REQUEST');
    sent.length = 0;
    const del = await app.request(`/api/v1/thread/threads/${t.thread}`, { method: 'DELETE', headers: { Authorization: `Bearer ${admin.accessToken}`, 'X-App-ID': 'the-thread' } });
    expect(del.status, await del.clone().text()).toBe(204);
    // The cascade took the row…
    expect((await service.from('thread_calendar_held').select('id').eq('engagement_id', s)).data).toEqual([]);
    // …and the CANCEL still reaches carol (sent in the background).
    for (let i = 0; i < 40 && !cancelsTo().includes('carol'); i++) await new Promise((r) => setTimeout(r, 250));
    expect(cancelsTo()).toEqual(['carol']);
  });
});
