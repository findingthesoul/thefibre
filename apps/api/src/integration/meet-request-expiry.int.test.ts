// An expired request gives the slot back.
//
// The hold (v1.111.0) made a pending request block its time. That is only
// tolerable because a request lets go by itself — otherwise one host who
// never answers parks somebody else's calendar for good. This is the other
// half, asked of the real staging API: once a request is `expired`, the time
// is bookable again.
//
// It is deliberately NOT a test of the sweep's clock. The deadline is pure
// arithmetic with its own unit tests (lib/meet/request-expiry.test.ts), and
// the sweep runs inside the API process on a five-minute lease, so a test
// here could only wait for it. What cannot be unit-tested is the thing this
// file asks: whether `expired` is actually absent from the queries that
// decide availability — a question only the deployed PostgREST filters can
// answer.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { cleanupMeetFixture, createMeetFixture, service, type MeetFixture } from './staging.js';

const API = 'https://thefibre-api-staging.fly.dev';

let f: MeetFixture;
const asker = `int-exp-a-${randomUUID().slice(0, 8)}@example.com`;
const next = `int-exp-b-${randomUUID().slice(0, 8)}@example.com`;
let bookingId = '';

async function book(email: string) {
  const r = await fetch(`${API}/api/v1/meet/public/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      meeting_type_id: f.meetingTypeId,
      invitee_email: email,
      invitee_name: 'Int Invitee',
      starts_at: f.startsAt,
      request_id: randomUUID(),
    }),
  });
  const body = (await r.json()) as { booking?: { id: string }; code?: string };
  return { status: r.status, body };
}

beforeAll(async () => {
  f = await createMeetFixture('expiry', { requiresApproval: true, capacity: 1 });
}, 60_000);

afterAll(async () => {
  if (f) await cleanupMeetFixture(f, [asker, next]);
}, 60_000);

describe('an expired request stops holding its slot', () => {
  it('holds it while pending', async () => {
    const r = await book(asker);
    expect(r.status).toBe(200);
    bookingId = r.body.booking!.id;
    // The premise of the test, asserted rather than assumed: if this booking
    // were not holding the slot, the next step would pass for the wrong
    // reason and would prove nothing at all.
    const blocked = await book(next);
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('slot_full');
  }, 60_000);

  it('releases it once expired', async () => {
    const { error } = await service
      .from('meet_booking')
      // The status the sweep writes. Set directly here because the sweep's
      // own trigger is a clock this test must not wait on — what is under
      // test is what the status MEANS to availability.
      .update({ status: 'expired' })
      .eq('id', bookingId);
    if (error) throw new Error(`expiring the request: ${error.message}`);

    const r = await book(next);
    expect(r.status).toBe(200);
    expect(r.body.booking?.id).toBeTruthy();
  }, 60_000);

  it('is a status the database actually allows', async () => {
    // The migration and the code have to agree: if the CHECK constraint had
    // not been extended, the update above would have failed and this file
    // would have blamed availability for a constraint error.
    const { data, error } = await service
      .from('meet_booking')
      .select('status')
      .eq('id', bookingId)
      .single();
    if (error) throw new Error(`reading the status back: ${error.message}`);
    expect(data!.status).toBe('expired');
  }, 60_000);
});
