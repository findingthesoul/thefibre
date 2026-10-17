// The rolling calendar window, end to end (calendar gaps, slice 2,
// 2026-10-17). Against staging's database; mail is RECORDED, never sent.
//
// Pinned:
//   · a live participant who holds nothing gets ONE mail per session in the
//     next six weeks — an inline REQUEST with the session's UID and current
//     SEQUENCE — and a held row (source 'window') is written;
//   · NOT invited: a session beyond six weeks; someone whose place began
//     before an organiser SEND of that session (an existing member, already
//     holding it); a calendar-feed follower; a declined place;
//   · run again → nothing (idempotent);
//   · the organiser's SEND now writes held rows too (source 'send').

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

type Sent = { to: string; subject: string; attachments?: { filename: string; content: string; contentType?: string }[] };
const sent: Sent[] = [];
vi.mock('../lib/email/client.js', async (orig) => ({
  ...(await orig<typeof import('../lib/email/client.js')>()),
  sendEmail: async (m: Sent) => {
    sent.push(m);
  },
}));

const DAY = 86_400_000;
const now = new Date();
let ws = '';
let threadId = '';
let programId = '';
let orgUser = '';
const sessions: Record<string, string> = {};
const tag = randomUUID().slice(0, 6);
const email = (who: string) => `int-win-${who}-${tag}@example.com`;
const persons: string[] = [];

async function place(who: string, status: string, createdAt: Date) {
  const person = (await service.from('person').insert({ workspace_id: ws, first_name: who, email: email(who) }).select('id').single()).data!.id as string;
  persons.push(person);
  const enr = (await service.from('enrolment').insert({ program_id: programId, person_id: person, status }).select('id').single()).data!.id as string;
  const te = await service
    .from('thread_enrolment')
    .insert({ workspace_id: ws, thread_id: threadId, enrolment_id: enr, person_id: person, request_id: `int-win-${randomUUID()}`, created_at: createdAt.toISOString() });
  if (te.error) throw new Error(te.error.message);
}

async function session(key: string, inDays: number) {
  const starts = new Date(now.getTime() + inDays * DAY);
  sessions[key] = (await service
    .from('thread_engagement')
    .insert({ workspace_id: ws, thread_id: threadId, type: 'event', title: `Session ${key}`, status: 'published', show_in_agenda: true, starts_at: starts.toISOString(), ends_at: new Date(starts.getTime() + 3600_000).toISOString(), calendar_sequence: 3, position: 1 })
    .select('id')
    .single()).data!.id as string;
}

beforeAll(async () => {
  ws = await createThrowawayWorkspace('calendar-window');
  const app = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id as string;
  orgUser = (await service.from('user').insert({ workspace_id: ws, email: email('org'), full_name: 'Win Organiser' }).select('id').single()).data!.id as string;
  const org = (await service.from('thread_organiser').insert({ user_id: orgUser, workspace_id: ws, slug: `win-${tag}`, display_name: 'Win Organiser' }).select('id').single()).data!.id as string;
  programId = (await service.from('program').insert({ workspace_id: ws, app_id: app, title: `Window ${tag}`, format: 'journey', status: 'active' }).select('id').single()).data!.id as string;
  threadId = (await service.from('thread_thread').insert({ workspace_id: ws, program_id: programId, organiser_id: org, slug: `win-${tag}`, timezone: 'Europe/Amsterdam', language: 'en' }).select('id').single()).data!.id as string;
  await session('soon', 10);
  await session('later', 30);
  await session('far', 60);
  const longAgo = new Date(now.getTime() - 30 * DAY);
  await place('new', 'enrolled', new Date(now.getTime() - DAY));
  await place('old', 'enrolled', longAgo);
  await place('feed', 'enrolled', longAgo);
  await place('gone', 'dropped', longAgo);
  // An organiser SEND of "soon" 20 days ago: 'old' (since 30 days) holds it.
  await service.from('thread_calendar_change').insert({ workspace_id: ws, thread_id: threadId, engagement_id: sessions.soon, kind: 'added', title: 'Session soon', sent_at: new Date(now.getTime() - 20 * DAY).toISOString() });
  // 'feed' follows their calendar feed, read yesterday.
  await service.from('person_calendar_feed').insert({ email: email('feed'), token_hash: `int-${randomUUID()}`, last_read_at: new Date(now.getTime() - DAY).toISOString() });
}, 180_000);

afterAll(async () => {
  await service.from('person_calendar_feed').delete().eq('email', email('feed'));
  await service.from('thread_calendar_held').delete().eq('thread_id', threadId);
  await service.from('thread_calendar_change').delete().eq('thread_id', threadId);
  await service.from('thread_enrolment').delete().eq('thread_id', threadId);
  await service.from('enrolment').delete().eq('program_id', programId);
  await service.from('thread_engagement').delete().eq('thread_id', threadId);
  await service.from('thread_thread').delete().eq('id', threadId);
  await service.from('program').delete().eq('id', programId);
  await service.from('thread_organiser').delete().eq('workspace_id', ws);
  if (ws) expect(await deleteThrowawayWorkspace(ws)).toBe(true);
}, 180_000);

describe('the window', () => {
  it('invites exactly the gaps: one REQUEST per session, recorded', async () => {
    const { loadWindow, planWindow, sendWindow } = await import('../lib/calendar-window.js');
    const plan = planWindow(await loadWindow(now, { threadIds: [threadId] }));
    const got = plan.invites.map((i) => `${i.email.split('-')[2]}:${i.session.title}`).sort();
    // new → soon + later; old → later only (holds soon); feed, gone, far → nothing.
    expect(got).toEqual(['new:Session later', 'new:Session soon', 'old:Session later']);
    expect([...(plan.feedSkipped.get(threadId) ?? [])]).toEqual([email('feed')]);

    sent.length = 0;
    const r = await sendWindow(plan.invites);
    expect(r).toEqual({ sent: 3, failed: 0 });
    expect(sent).toHaveLength(3);
    const ics = Buffer.from(sent.find((m) => m.to === email('new') && /soon/.test(m.subject))!.attachments![0]!.content, 'base64').toString('utf8');
    expect(ics).toContain('METHOD:REQUEST');
    expect(ics).toContain(`UID:agenda-${sessions.soon}@thefibre`);
    expect(ics).toMatch(/\r\nSEQUENCE:3\r\n/);
    expect(sent[0]!.attachments![0]!.contentType).toBe('text/calendar; charset=utf-8; method=REQUEST');
    const { data: held } = await service.from('thread_calendar_held').select('engagement_id, email, method, sequence, source').eq('thread_id', threadId);
    expect(held).toHaveLength(3);
    expect(held!.every((h) => h.method === 'REQUEST' && h.source === 'window' && h.sequence === 3)).toBe(true);
  });

  it('run again: nothing (idempotent)', async () => {
    const { loadWindow, planWindow } = await import('../lib/calendar-window.js');
    expect(planWindow(await loadWindow(now, { threadIds: [threadId] })).invites).toEqual([]);
  });
});

describe('the organiser’s SEND writes the record too', () => {
  it('a sent change leaves held rows with source send', async () => {
    await service.from('thread_calendar_change').insert({
      workspace_id: ws, thread_id: threadId, engagement_id: sessions.later, kind: 'moved', title: 'Session later',
      was: { starts_at: new Date(now.getTime() + 30 * DAY).toISOString(), ends_at: null, location: null, meeting_url: null, location_url: null },
      now_state: { starts_at: new Date(now.getTime() + 31 * DAY).toISOString(), ends_at: null, location: null, meeting_url: null, location_url: null },
    });
    const { sendPendingChanges } = await import('../lib/calendar-invite.js');
    sent.length = 0;
    const r = await sendPendingChanges({ threadId });
    expect(r.sent).toBeGreaterThan(0);
    const { data } = await service.from('thread_calendar_held').select('email, source, sequence').eq('engagement_id', sessions.later);
    const bySend = (data ?? []).filter((h) => h.source === 'send').map((h) => h.email).sort();
    // Every live participant with an address got the move (the feed follower
    // too: a CHANGE is news; only the window skips followers).
    expect(bySend).toEqual([email('feed'), email('new'), email('old')].sort());
    expect((data ?? []).every((h) => h.sequence === 4)).toBe(true);
  });
});
