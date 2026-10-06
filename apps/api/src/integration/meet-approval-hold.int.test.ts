// A request waiting for the host's answer HOLDS ITS SLOT.
//
// This is the rule a real invitee discovered was missing. Her booking request
// sat in `pending_approval` — the host was never emailed, so nobody answered
// it — and because every availability and capacity query in Meet filtered on
// `status = 'confirmed'`, the slot she was waiting on stayed on offer and
// another meeting was booked on top of it.
//
// Sjoerd's call ("hold yes") made pending count. The cost is that an
// unanswered request blocks a time, which is why requests also have to
// expire; the two land together on production for that reason.
//
// Run against the real staging API, because the rule IS a PostgREST filter:
// nothing TypeScript checks can tell `.eq('status','confirmed')` from
// `.in('status', LIVE_BOOKING_STATUSES)`, and a unit test of the handler
// would have to fake the one thing being tested.
//
// The meeting type is a one-off (see createMeetFixture): its capacity count
// is the only gate between two invitees and the same seat, so a refusal here
// is the hold and nothing else.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { cleanupMeetFixture, createMeetFixture, service, type MeetFixture } from './staging.js';

const API = 'https://thefibre-api-staging.fly.dev';

let f: MeetFixture;
const first = `int-hold-a-${randomUUID().slice(0, 8)}@example.com`;
const second = `int-hold-b-${randomUUID().slice(0, 8)}@example.com`;
const third = `int-hold-c-${randomUUID().slice(0, 8)}@example.com`;
let firstBookingId = '';

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
  const body = (await r.json()) as {
    booking?: { id: string };
    error?: unknown;
    code?: string;
  };
  return { status: r.status, body };
}

beforeAll(async () => {
  // requires_approval: a booking here lands in pending_approval, which is
  // the state whose invisibility was the bug.
  f = await createMeetFixture('hold', { requiresApproval: true, capacity: 1 });
}, 60_000);

afterAll(async () => {
  if (f) await cleanupMeetFixture(f, [first, second, third]);
}, 60_000);

describe('a booking request holds its slot', () => {
  it('lands in pending_approval, not confirmed', async () => {
    const r = await book(first);
    expect(r.status).toBe(200);
    expect(r.body.booking?.id).toBeTruthy();
    firstBookingId = r.body.booking!.id;

    // Read it back as the database has it — the response shape could change
    // without the status ever being what this test is about.
    const { data, error } = await service
      .from('meet_booking')
      // approval_notice_failed_at is selected deliberately: it is new in this
      // release, and a select naming a column PostgREST does not know fails
      // loudly. That makes this line the check that the migration reached
      // this stack, rather than an assumption that it did.
      .select('status, approval_notice_failed_at')
      .eq('id', firstBookingId)
      .single();
    if (error) throw new Error(`reading the booking back: ${error.message}`);
    expect(data!.status).toBe('pending_approval');
  }, 60_000);

  it('refuses a second booking at the same time while the first waits', async () => {
    const r = await book(second);
    // THE HOLD. On the code before this release the capacity count saw no
    // confirmed bookings and this returned 200 — two people, one seat, and
    // the one who asked first had no idea.
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('slot_full');
  }, 60_000);

  it('frees the slot once the request is no longer live', async () => {
    const { error } = await service
      .from('meet_booking')
      .update({ status: 'cancelled' })
      .eq('id', firstBookingId);
    if (error) throw new Error(`cancelling the first booking: ${error.message}`);

    const r = await book(third);
    expect(r.status).toBe(200);
    expect(r.body.booking?.id).toBeTruthy();
  }, 60_000);
});
