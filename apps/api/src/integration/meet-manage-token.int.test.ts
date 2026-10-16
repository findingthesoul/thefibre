// A Meet booking is managed with its MANAGE TOKEN, not its id (security fix,
// 2026-10-16). The id is also the calendar UID — in every invitation and
// every .ics — so anyone an invitation reached could cancel, move, or read
// both email addresses. Against staging's database, through the real routes;
// mail is recorded, never sent.
//
// Pinned:
//   · the public read without the token: the booking, no addresses, no
//     invoice link; with it: the guest's own address (never the host's);
//   · cancel, reschedule and the .ics: refused without the token or with a
//     wrong one, allowed with it — and the token is never in the .ics or the
//     invitation, while the UID stays the id;
//   · the booking's own HOST, signed in, may move it without a token;
//   · "Email me a link": only to the address ON FILE (a typed address is
//     ignored), the answer never names it, an unknown id answers the same,
//     3 per booking per hour, every request logged.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import {
  cleanupMeetFixture,
  createFixtureUser,
  createMeetFixture,
  deleteFixtureUser,
  service,
  type FixtureUser,
  type MeetFixture,
} from './staging.js';

type Sent = { to: string; subject: string; text?: string; attachments?: { filename: string; content: string }[] };
const sent: Sent[] = [];
vi.mock('../lib/email/client.js', async (orig) => ({
  ...(await orig<typeof import('../lib/email/client.js')>()),
  sendEmail: async (m: Sent) => {
    sent.push(m);
  },
}));

let app: Hono;
let f: MeetFixture | undefined;
let host: FixtureUser | undefined;
const guest = `int-mmt-${randomUUID().slice(0, 8)}@example.com`;
let bookingId = '';
let token = '';

const req = (method: string, path: string, body?: unknown, auth?: string) =>
  app.request(`/api/v1/meet${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-App-ID': 'fibre-meet', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
const plus = (iso: string, min: number) => new Date(new Date(iso).getTime() + min * 60_000).toISOString();

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { meetRoutes } = await import('../routes/meet.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/meet', meetRoutes);
  app.route('/api/v1', v1);
  f = await createMeetFixture('mmt', { kind: 'one_on_one', capacity: 5 });
  // The fixture's host made signable: a fixture user with a session is
  // swapped onto the host row (restored before the fixture's own cleanup).
  const ws = (await service.from('meet_meeting_type').select('workspace_id').eq('id', f.meetingTypeId).single()).data!.workspace_id as string;
  host = await createFixtureUser(ws, 'mmt-host');
  await service.from('meet_host').update({ user_id: host.userId }).eq('id', f.hostId);
}, 180_000);

afterAll(async () => {
  if (f) {
    const { data } = await service.from('meet_booking').select('id').eq('meeting_type_id', f.meetingTypeId);
    const ids = (data ?? []).map((r) => r.id as string);
    if (ids.length) await service.from('meet_booking_link_request').delete().in('booking_id', ids);
    await service.from('meet_booking').delete().eq('meeting_type_id', f.meetingTypeId);
    await service.from('meet_host').update({ user_id: f.userRowId }).eq('id', f.hostId);
    await cleanupMeetFixture(f, [guest]);
  }
  if (host) await deleteFixtureUser(host);
}, 180_000);

describe('booking hands out the token, and only through the guest’s own channels', () => {
  it('the public booking answers with a manage token; the guest’s mail links carry it; the .ics does not', async () => {
    const r = await req('POST', '/public/bookings', { meeting_type_id: f!.meetingTypeId, invitee_email: guest, invitee_name: 'Guest Manage', starts_at: f!.startsAt, request_id: randomUUID() });
    expect(r.status, await r.clone().text()).toBe(200);
    const j = (await r.json()) as { booking: { id: string }; manage_token: string };
    bookingId = j.booking.id;
    token = j.manage_token;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const mail = sent.find((m) => m.to === guest)!;
    expect(mail.text).toContain(`/cancel/${bookingId}?t=${token}`);
    expect(mail.text).toContain(`reschedule=${bookingId}&t=${token}`);
    expect(mail.text).toContain(`/calendar.ics?t=${token}`);
    const ics = Buffer.from(mail.attachments![0]!.content, 'base64').toString('utf8');
    expect(ics).toContain(`UID:meet-${bookingId}@thefibre.app`);
    expect(ics).not.toContain(token);
  });
});

describe('reading the booking', () => {
  it('with the id alone: the booking, no addresses, no invoice link', async () => {
    const j = (await (await req('GET', `/public/bookings/${bookingId}`)).json()) as Record<string, unknown>;
    expect(j.id).toBe(bookingId);
    expect(j.can_manage).toBe(false);
    expect(j).not.toHaveProperty('invitee_email');
    expect(j.stripe_invoice_url).toBeNull();
    expect(JSON.stringify(j)).not.toContain(guest);
    expect(JSON.stringify(j)).not.toContain(host!.email);
  });

  it('with the token: the guest’s own address — still never the host’s', async () => {
    const j = (await (await req('GET', `/public/bookings/${bookingId}?t=${token}`)).json()) as Record<string, unknown>;
    expect(j.can_manage).toBe(true);
    expect(j.invitee_email).toBe(guest);
    expect(JSON.stringify(j)).not.toContain(host!.email);
  });
});

describe('changing the booking', () => {
  it('the .ics: refused without the token, served with it, and the file holds no token', async () => {
    expect((await req('GET', `/public/bookings/${bookingId}/calendar.ics`)).status).toBe(403);
    const ok = await req('GET', `/public/bookings/${bookingId}/calendar.ics?t=${token}`);
    expect(ok.status).toBe(200);
    expect(await ok.text()).not.toContain(token);
  });

  it('reschedule: refused with the id alone and with a wrong token; allowed with the token', async () => {
    const to = plus(f!.startsAt, 60);
    const bare = await req('POST', `/public/bookings/${bookingId}/reschedule`, { starts_at: to });
    expect(bare.status).toBe(403);
    expect(((await bare.json()) as { code: string }).code).toBe('manage_token_required');
    expect((await req('POST', `/public/bookings/${bookingId}/reschedule?t=${token.slice(0, -2)}xx`, { starts_at: to })).status).toBe(403);
    expect((await req('POST', `/public/bookings/${bookingId}/reschedule?t=${token}`, { starts_at: to })).status).toBe(200);
  });

  it('a signed-in host of ANOTHER booking may not move this one', async () => {
    const ws = (await service.from('meet_meeting_type').select('workspace_id').eq('id', f!.meetingTypeId).single()).data!.workspace_id as string;
    const other = await createFixtureUser(ws, 'mmt-other');
    const { data: otherHost } = await service
      .from('meet_host')
      .insert({ user_id: other.userId, workspace_id: ws, slug: `int-mmt-other-${randomUUID().slice(0, 6)}`, timezone: 'UTC' })
      .select('id')
      .single();
    try {
      const r = await req('POST', `/public/bookings/${bookingId}/reschedule`, { starts_at: plus(f!.startsAt, 90) }, other.accessToken);
      expect(r.status).toBe(403);
    } finally {
      if (otherHost) await service.from('meet_host').delete().eq('id', otherHost.id);
      await deleteFixtureUser(other);
    }
  });

  it('the booking’s own host, signed in, may move it without a token', async () => {
    const r = await req('POST', `/public/bookings/${bookingId}/reschedule`, { starts_at: plus(f!.startsAt, 120) }, host!.accessToken);
    expect(r.status, await r.clone().text()).toBe(200);
  });

  it('cancel: refused with the id alone; allowed with the token', async () => {
    expect((await req('POST', `/public/bookings/${bookingId}/cancel`, {})).status).toBe(403);
    const { data: still } = await service.from('meet_booking').select('status').eq('id', bookingId).single();
    expect(still!.status).not.toBe('cancelled');
    expect((await req('POST', `/public/bookings/${bookingId}/cancel?t=${token}`, {})).status).toBe(200);
  });
});

describe('“Email me a link”', () => {
  it('goes ONLY to the address on file — a typed address is ignored — and the answer names nobody', async () => {
    sent.length = 0;
    const r = await req('POST', `/public/bookings/${bookingId}/manage-link`, { email: 'attacker@example.com' });
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).toBe('{"ok":true}');
    expect(sent.map((m) => m.to)).toEqual([guest]);
    expect(sent[0]!.text).toContain(`/confirmed/${bookingId}?t=${token}`);
  });

  it('the mail speaks the guest’s language (the meeting type’s, here Dutch)', async () => {
    await service.from('meet_meeting_type').update({ locale: 'nl' }).eq('id', f!.meetingTypeId);
    try {
      sent.length = 0;
      await service.from('meet_booking_link_request').delete().eq('booking_id', bookingId);
      expect((await req('POST', `/public/bookings/${bookingId}/manage-link`, {})).status).toBe(200);
      expect(sent[0]!.subject).toMatch(/^Je afspraak: /);
      expect(sent[0]!.text).toContain('te bekijken, te verzetten of te annuleren');
    } finally {
      // Its own logged request stays: the rate case below counts on exactly
      // one earlier request in this hour's window.
      await service.from('meet_meeting_type').update({ locale: null }).eq('id', f!.meetingTypeId);
    }
  });

  it('an unknown id answers exactly the same and sends nothing', async () => {
    sent.length = 0;
    const r = await req('POST', `/public/bookings/${randomUUID()}/manage-link`, {});
    expect(await r.text()).toBe('{"ok":true}');
    expect(sent).toEqual([]);
  });

  it('three per booking per hour; the fourth is refused; every request is logged', async () => {
    sent.length = 0;
    expect((await req('POST', `/public/bookings/${bookingId}/manage-link`, {})).status).toBe(200);
    expect((await req('POST', `/public/bookings/${bookingId}/manage-link`, {})).status).toBe(200);
    const fourth = await req('POST', `/public/bookings/${bookingId}/manage-link`, {});
    expect(fourth.status).toBe(429);
    expect(sent).toHaveLength(2);
    const { data: log } = await service.from('meet_booking_link_request').select('sent').eq('booking_id', bookingId);
    expect((log ?? []).map((l) => l.sent).sort()).toEqual([false, true, true, true]);
  });
});
