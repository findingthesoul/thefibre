// A free, no-approval booking on a personal-room meeting type carries the
// host's room — in the booking, in the guest's mail and in the invite.
//
// Sjoerd, 2026-10-15, on production: "my invite has no Zoom link in my
// agenda." v1.92.1 had taught both booking paths to fetch the host's room,
// and the DEFERRED path (approval, payment) did. The DIRECT path asked
// `hostRow.user_id` of a row whose select had only the embed alias
// `user:user_id (…)` — no `user_id` column — and a cast
// (`as { user_id?: … }`) hid that from TypeScript. So userPersonalRoom(null)
// answered null, and the most common booking of all went out with no link.
//
// Runs the real route in process against staging's database with the mail
// client replaced by a recorder, like meet-guest-invite.int.test.ts.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { cleanupMeetFixture, createMeetFixture, service, type MeetFixture } from './staging.js';

type Sent = {
  to: string;
  text?: string;
  html?: string;
  attachments?: { filename: string; content: string }[];
};
const sent: Sent[] = [];

vi.mock('../lib/email/client.js', () => ({
  sendEmail: async (msg: Sent) => {
    sent.push(msg);
  },
  platformFromAddress: () => 'noreply@thefibre.app',
}));

const ROOM = `https://example.zoom.us/j/${Date.now()}`;
let app: Hono;
let f: MeetFixture;
const guest = `int-room-${randomUUID().slice(0, 8)}@example.com`;
let bookingId = '';

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { meetRoutes } = await import('../routes/meet.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/meet', meetRoutes);
  app.route('/api/v1', v1);
  f = await createMeetFixture('personal-room', { kind: 'one_off' });

  // The room where every reader looks for it: the platform's connections
  // table (lib/connections.ts), never the old meet_host column.
  const conn = await service
    .from('user_connection')
    .upsert({ user_id: f.userRowId, personal_room_url: ROOM }, { onConflict: 'user_id' });
  if (conn.error) throw new Error(`user_connection: ${conn.error.message}`);
  const mt = await service
    .from('meet_meeting_type')
    .update({ conferencing_provider: 'personal_room', price_cents: 0, requires_approval: false })
    .eq('id', f.meetingTypeId);
  if (mt.error) throw new Error(`meeting type: ${mt.error.message}`);
});

afterAll(async () => {
  if (bookingId) await service.from('meet_booking').delete().eq('id', bookingId);
  if (f) await service.from('user_connection').delete().eq('user_id', f.userRowId);
  if (f) await cleanupMeetFixture(f);
});

describe('a direct booking on a personal-room meeting type', () => {
  it('is confirmed at once and stores the room as its link', async () => {
    const r = await app.request('/api/v1/meet/public/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-ID': 'fibre-meet' },
      body: JSON.stringify({
        meeting_type_id: f.meetingTypeId,
        invitee_email: guest,
        invitee_name: 'Room Guest',
        starts_at: f.startsAt,
        invitee_timezone: 'UTC',
        request_id: randomUUID(),
      }),
    });
    expect(r.status, await r.clone().text()).toBe(200);
    bookingId = ((await r.json()) as { booking?: { id: string } }).booking?.id ?? '';
    expect(bookingId).toBeTruthy();

    const { data } = await service
      .from('meet_booking')
      .select('status, meet_url')
      .eq('id', bookingId)
      .single();
    // Confirmed, so this IS the direct path and not the deferred one, which
    // was never broken — without this the test could pass for the wrong reason.
    expect(data?.status).toBe('confirmed');
    expect(data?.meet_url).toBe(ROOM);
  });

  it('puts the room in the guest mail and in the invite they add to their calendar', async () => {
    const mail = sent.find((m) => m.to === guest);
    expect(mail, `nothing was sent to the guest; sent: ${sent.map((s) => s.to).join(', ')}`).toBeTruthy();
    expect(`${mail!.text ?? ''}${mail!.html ?? ''}`).toContain(ROOM);
    const ics = Buffer.from(mail!.attachments?.[0]?.content ?? '', 'base64').toString('utf8');
    // Unfolded first: an iCalendar line longer than 75 octets continues on
    // the next line after a CRLF and a space.
    const flat = ics.replace(/\r?\n[ \t]/g, '');
    expect(flat).toContain(`LOCATION:${ROOM}`);
    expect(flat).toContain(`URL:${ROOM}`);
  });
});
