// Every invitation path builds an iMIP message (inline Accept bar), through the
// REAL mail client (lib/email/client.ts → lib/email/invite-smtp.ts). Against
// staging's database, through the real routes and the real SEND; the SMTP
// transport is nodemailer's STREAM transport, so the MIME is built and read
// and nothing is sent. Resend's REST endpoint is a fake at fetch: the
// non-invitation mails (the host's copy, notices) still go there.
//
// Paths: Thread session invitations (a moved session → REQUEST, a cancelled
// one → CANCEL) and Meet guest invitations (book → REQUEST, reschedule →
// REQUEST, cancel → CANCEL).

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import nodemailer from 'nodemailer';
import {
  cleanupMeetFixture,
  createMeetFixture,
  createThrowawayWorkspace,
  deleteThrowawayWorkspace,
  service,
  type MeetFixture,
} from './staging.js';

const built: { to: string; raw: string }[] = [];
const stream = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
const restCalls: { to: unknown; attachments: { content_type?: string }[] }[] = [];
const realFetch = globalThis.fetch;
vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url !== 'https://api.resend.com/emails') return realFetch(input as RequestInfo, init);
  const body = JSON.parse(String(init?.body ?? '{}')) as { to: unknown; attachments?: { content_type?: string }[] };
  restCalls.push({ to: body.to, attachments: body.attachments ?? [] });
  return new Response('{"id":"x"}', { status: 200 });
});
process.env.RESEND_API_KEY = 're_test_fake';

const parts = (raw: string) => raw.split('\n').filter((l) => /^Content-(Type|Disposition):/i.test(l));
const isImip = (raw: string, method: string) => {
  const p = parts(raw);
  return (
    /^Content-Type: multipart\/mixed/.test(p[0] ?? '') &&
    /^Content-Type: multipart\/alternative/.test(p[1] ?? '') &&
    p.includes(`Content-Type: text/calendar; charset=utf-8; method=${method}`) &&
    p.some((l) => /^Content-Disposition: attachment; filename=/.test(l))
  );
};
const invitationsOverRest = () => restCalls.filter((c) => c.attachments.some((a) => /^text\/calendar/.test(a.content_type ?? '')));

let ws = '';
let threadId = '';
let mf: MeetFixture | undefined;
const made: { table: string; id: string }[] = [];
const participant = `int-ismtp-${randomUUID().slice(0, 6)}@example.com`;
const guest = `int-ismtp-g-${randomUUID().slice(0, 6)}@example.com`;
let app: Hono;

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}
const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

beforeAll(async () => {
  const { setInviteTransportForTests } = await import('../lib/email/invite-smtp.js');
  setInviteTransportForTests({
    sendMail: async (m: Parameters<typeof stream.sendMail>[0]) => {
      const info = await stream.sendMail(m);
      built.push({ to: String(m.to), raw: (info.message as Buffer).toString() });
      return info;
    },
  } as unknown as typeof stream);

  const { appContext } = await import('../middleware/app-context.js');
  const { meetRoutes } = await import('../routes/meet.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/meet', meetRoutes);
  app.route('/api/v1', v1);

  // A Thread with one participant, a future session that MOVED and one that
  // was CANCELLED — the organiser's SEND turns them into REQUEST and CANCEL.
  const threadAppId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id;
  ws = await createThrowawayWorkspace('invitesmtp');
  const user = await insert('user', { workspace_id: ws, email: `int-ismtp-org-${randomUUID().slice(0, 6)}@example.com` });
  const organiserId = await insert('thread_organiser', { user_id: user, workspace_id: ws, slug: `int-ismtp-${randomUUID().slice(0, 6)}`, display_name: 'Olga Organiser' });
  const program = await insert('program', { workspace_id: ws, app_id: threadAppId, title: 'Invite path', format: 'event', status: 'active' });
  threadId = await insert('thread_thread', { workspace_id: ws, program_id: program, organiser_id: organiserId, slug: `int-ismtp-${randomUUID().slice(0, 8)}`, timezone: 'Europe/Amsterdam', language: 'en' });
  const person = await insert('person', { workspace_id: ws, first_name: 'P', email: participant });
  const enr = await insert('enrolment', { program_id: program, person_id: person, status: 'enrolled' });
  await insert('thread_enrolment', { workspace_id: ws, thread_id: threadId, enrolment_id: enr, person_id: person, request_id: `int-ismtp-${randomUUID()}` });
  const base = { workspace_id: ws, thread_id: threadId, type: 'event', status: 'published', show_in_agenda: true, calendar_sent_at: day(-30) };
  const moved = await insert('thread_engagement', { ...base, title: 'Moved session', starts_at: day(12), ends_at: day(12.05) });
  const gone = await insert('thread_engagement', { ...base, title: 'Cancelled session', starts_at: day(14), ends_at: day(14.05) });
  const st = (s: string, e: string) => ({ starts_at: s, ends_at: e, location: null, location_url: null, meeting_url: null });
  await insert('thread_calendar_change', { workspace_id: ws, thread_id: threadId, engagement_id: moved, kind: 'moved', title: 'Moved session', was: st(day(11), day(11.05)), now_state: st(day(12), day(12.05)) });
  await insert('thread_calendar_change', { workspace_id: ws, thread_id: threadId, engagement_id: gone, kind: 'cancelled', title: 'Cancelled session', was: st(day(14), day(14.05)), now_state: null });

  mf = await createMeetFixture('ismtp', { kind: 'one_on_one', capacity: 5 });
}, 240_000);

afterAll(async () => {
  const { setInviteTransportForTests } = await import('../lib/email/invite-smtp.js');
  setInviteTransportForTests(null);
  vi.stubGlobal('fetch', realFetch);
  delete process.env.RESEND_API_KEY;
  if (threadId) await service.from('thread_calendar_change').delete().eq('thread_id', threadId);
  for (const { table, id } of made) {
    if (table === 'program') await service.from('enrolment').delete().eq('program_id', id);
    await service.from(table).delete().eq('id', id);
  }
  if (ws) await deleteThrowawayWorkspace(ws);
  if (mf) {
    await service.from('meet_booking').delete().eq('meeting_type_id', mf.meetingTypeId);
    await cleanupMeetFixture(mf, [guest]);
  }
}, 240_000);

describe('Thread: the organiser’s SEND', () => {
  it('a moved session is a REQUEST and a cancelled one a CANCEL — both iMIP, none over REST', async () => {
    built.length = 0;
    restCalls.length = 0;
    const invite = await import('../lib/calendar-invite.js');
    await invite.sendPendingChanges({ threadId });
    const mine = built.filter((b) => b.to === participant);
    expect(mine.length, `built for: ${built.map((b) => b.to).join(', ')}`).toBeGreaterThanOrEqual(2);
    expect(mine.some((b) => isImip(b.raw, 'REQUEST'))).toBe(true);
    expect(mine.some((b) => isImip(b.raw, 'CANCEL'))).toBe(true);
    expect(invitationsOverRest()).toEqual([]);
  });
});

describe('Meet: the guest’s invitation', () => {
  let bookingId = '';
  let token = '';
  const post = (path: string, body: unknown) =>
    app.request(`/api/v1/meet${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-App-ID': 'fibre-meet' }, body: JSON.stringify(body) });

  it('booking → REQUEST', async () => {
    built.length = 0;
    restCalls.length = 0;
    const r = await post('/public/bookings', { meeting_type_id: mf!.meetingTypeId, invitee_email: guest, invitee_name: 'Guest', starts_at: mf!.startsAt, request_id: randomUUID() });
    expect(r.status, await r.clone().text()).toBe(200);
    const jb = (await r.json()) as { booking: { id: string }; manage_token: string };
    bookingId = jb.booking.id;
    token = jb.manage_token;
    const g = built.filter((b) => b.to === guest);
    expect(g).toHaveLength(1);
    expect(isImip(g[0]!.raw, 'REQUEST')).toBe(true);
    // The host's own mail has no invitation, and still goes over REST.
    expect(restCalls.some((c) => c.to === mf!.hostEmail)).toBe(true);
    expect(invitationsOverRest()).toEqual([]);
  });

  it('reschedule → REQUEST', async () => {
    built.length = 0;
    const r = await post(`/public/bookings/${bookingId}/reschedule?t=${token}`, { starts_at: new Date(new Date(mf!.startsAt).getTime() + 60 * 60_000).toISOString() });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(isImip(built.find((b) => b.to === guest)!.raw, 'REQUEST')).toBe(true);
  });

  it('cancel → CANCEL', async () => {
    built.length = 0;
    const r = await post(`/public/bookings/${bookingId}/cancel?t=${token}`, {});
    expect(r.status, await r.clone().text()).toBe(200);
    expect(isImip(built.find((b) => b.to === guest)!.raw, 'CANCEL')).toBe(true);
    expect(invitationsOverRest()).toEqual([]);
  });
});
