// A Zoom booking whose meeting cannot be made falls back to the host's
// personal room — and the host is told.
//
// Sjoerd, 2026-10-15, on production: *"Zoom is not working yet. But the
// personal room should work."* Until then a Zoom booking whose meeting could
// not be created confirmed with NO link and said nothing to anybody; and a
// token refresh that threw (anything but a revoked grant) escaped the route
// after the booking row was written and before any mail went out.
//
// Runs the real route in process against staging's database, mail recorded,
// with Zoom's client replaced so each case is the one it names: Zoom not
// configured at all, and Zoom configured with a refresh that throws.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { cleanupMeetFixture, createMeetFixture, service, type MeetFixture } from './staging.js';

type Sent = { to: string; text?: string; html?: string; attachments?: { content: string }[] };
const sent: Sent[] = [];

vi.mock('../lib/email/client.js', () => ({
  sendEmail: async (msg: Sent) => {
    sent.push(msg);
  },
  platformFromAddress: () => 'noreply@thefibre.app',
}));

let zoomConfigured = false;
vi.mock('../lib/zoom/client.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/zoom/client.js')>();
  return {
    ...real,
    isZoomConfigured: () => zoomConfigured,
    // Not invalid_grant — the kind of failure that used to escape the route.
    refreshAccessToken: async () => {
      throw new Error('Zoom token refresh failed: 400 invalid_client');
    },
    createZoomMeeting: async () => {
      throw new Error('createZoomMeeting must not be reached in these cases');
    },
  };
});

const ROOM = `https://example.zoom.us/j/room${Date.now()}`;
let app: Hono;
let f: MeetFixture;
const made: string[] = [];

async function book(guest: string) {
  const r = await app.request('/api/v1/meet/public/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-ID': 'fibre-meet' },
    body: JSON.stringify({
      meeting_type_id: f.meetingTypeId,
      invitee_email: guest,
      invitee_name: 'Zoom Guest',
      starts_at: f.startsAt,
      invitee_timezone: 'UTC',
      request_id: randomUUID(),
    }),
  });
  const text = await r.text();
  const id = (JSON.parse(text || '{}') as { booking?: { id: string } }).booking?.id ?? '';
  if (id) made.push(id);
  return { status: r.status, text, id };
}

async function row(id: string) {
  const { data } = await service.from('meet_booking').select('status, meet_url').eq('id', id).single();
  return data as { status: string; meet_url: string | null };
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { meetRoutes } = await import('../routes/meet.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/meet', meetRoutes);
  app.route('/api/v1', v1);
  // Capacity for three bookings on the one slot, one per case.
  f = await createMeetFixture('zoom-fallback', { kind: 'one_off', capacity: 3 });
  const mt = await service
    .from('meet_meeting_type')
    .update({ conferencing_provider: 'zoom', price_cents: 0, requires_approval: false })
    .eq('id', f.meetingTypeId);
  if (mt.error) throw new Error(`meeting type: ${mt.error.message}`);
});

beforeEach(() => {
  sent.length = 0;
});

afterAll(async () => {
  for (const id of made) await service.from('meet_booking').delete().eq('id', id);
  if (f) await service.from('user_connection').delete().eq('user_id', f.userRowId);
  if (f) await cleanupMeetFixture(f);
});

const hostMail = () => sent.find((m) => m.to === f.hostEmail);
const mailText = (m: Sent | undefined) => `${m?.text ?? ''}${m?.html ?? ''}`;

describe('Zoom not configured on this platform', () => {
  it('confirms with the personal room, and tells the host why', async () => {
    zoomConfigured = false;
    const conn = await service
      .from('user_connection')
      .upsert({ user_id: f.userRowId, personal_room_url: ROOM, zoom_refresh_token: null }, { onConflict: 'user_id' });
    if (conn.error) throw new Error(conn.error.message);

    const guest = `int-zoomfb-a-${randomUUID().slice(0, 6)}@example.com`;
    const r = await book(guest);
    expect(r.status, r.text).toBe(200);
    expect(await row(r.id)).toEqual({ status: 'confirmed', meet_url: ROOM });

    const g = sent.find((m) => m.to === guest);
    expect(mailText(g), 'the guest mail carries the room').toContain(ROOM);
    expect(mailText(hostMail())).toContain("Zoom isn't available on this platform yet");
    expect(mailText(hostMail())).toContain('uses your personal room');
  });
});

describe('Zoom configured, and the token refresh throws', () => {
  it('does not crash: the booking confirms with the room and both sides are mailed', async () => {
    zoomConfigured = true;
    const conn = await service
      .from('user_connection')
      .upsert({ user_id: f.userRowId, personal_room_url: ROOM, zoom_refresh_token: 'int-test-not-a-token' }, { onConflict: 'user_id' });
    if (conn.error) throw new Error(conn.error.message);

    const guest = `int-zoomfb-b-${randomUUID().slice(0, 6)}@example.com`;
    const r = await book(guest);
    expect(r.status, r.text).toBe(200);
    expect(await row(r.id)).toEqual({ status: 'confirmed', meet_url: ROOM });
    expect(sent.some((m) => m.to === guest), 'the guest was mailed').toBe(true);
    expect(mailText(hostMail())).toContain('Zoom returned an error');
  });
});

describe('no personal room to fall back to', () => {
  it('confirms with no link, and the host is told to add one', async () => {
    zoomConfigured = false;
    const conn = await service
      .from('user_connection')
      .upsert({ user_id: f.userRowId, personal_room_url: null, zoom_refresh_token: null }, { onConflict: 'user_id' });
    if (conn.error) throw new Error(conn.error.message);

    const r = await book(`int-zoomfb-c-${randomUUID().slice(0, 6)}@example.com`);
    expect(r.status, r.text).toBe(200);
    expect(await row(r.id)).toEqual({ status: 'confirmed', meet_url: null });
    expect(mailText(hostMail())).toContain('This booking has no join link');
  });
});
