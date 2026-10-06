// Moving a booking, against the real staging API.
//
// Three releases have now touched reschedule and none of them could be
// exercised end to end, because the suite had no reschedulable fixture: a
// one-off cannot be moved by design. This closes that, and asks the question
// the hold made urgent.
//
// THE QUESTION. Since v1.111.0, a booking in `pending_approval` occupies its
// time — it is in LIVE_BOOKING_STATUSES. A booking's OWN row therefore blocks
// its own move unless every availability query excludes it, and a 30-minute
// meeting moved 15 minutes overlaps itself. So "move it a quarter of an hour"
// is the sharpest probe there is of whether the exclusion is really applied,
// and it must hold for a pending booking exactly as for a confirmed one.
//
// The fixture host has no Google token, so no freebusy runs here. That is
// deliberate: it isolates the DATABASE half of availability. The calendar
// half — a booking's own Google event blocking its move — is what v1.110.2
// fixed and what still has only unit tests, because proving it needs a real
// connected calendar.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { cleanupMeetFixture, createMeetFixture, service, type MeetFixture } from './staging.js';

const API = 'https://thefibre-api-staging.fly.dev';

let plain: MeetFixture;
let approval: MeetFixture;
const emails: string[] = [];

function mail(tag: string) {
  const e = `int-resched-${tag}-${randomUUID().slice(0, 8)}@example.com`;
  emails.push(e);
  return e;
}

async function book(f: MeetFixture, email: string, startsAt: string) {
  const r = await fetch(`${API}/api/v1/meet/public/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      meeting_type_id: f.meetingTypeId,
      invitee_email: email,
      invitee_name: 'Int Resched',
      starts_at: startsAt,
      request_id: randomUUID(),
    }),
  });
  return { status: r.status, body: (await r.json()) as { booking?: { id: string }; code?: string } };
}

async function move(bookingId: string, startsAt: string) {
  const r = await fetch(
    `${API}/api/v1/meet/public/bookings/${bookingId}/reschedule`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starts_at: startsAt }),
    },
  );
  return {
    status: r.status,
    body: (await r.json()) as {
      ok?: boolean;
      code?: string;
      needs_approval?: boolean;
      booking?: { starts_at: string; status: string };
    },
  };
}

const plus = (iso: string, minutes: number) =>
  new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();

beforeAll(async () => {
  [plain, approval] = await Promise.all([
    createMeetFixture('resched', { kind: 'one_on_one' }),
    createMeetFixture('reschedap', { kind: 'one_on_one', requiresApproval: true }),
  ]);
}, 90_000);

afterAll(async () => {
  await Promise.all([
    plain ? cleanupMeetFixture(plain, emails) : null,
    approval ? cleanupMeetFixture(approval, emails) : null,
  ]);
}, 90_000);

describe('a booking can be moved onto a time that overlaps its own', () => {
  it('moves a confirmed booking 15 minutes later', async () => {
    const booked = await book(plain, mail('a'), plain.startsAt);
    expect(booked.status).toBe(200);
    const id = booked.body.booking!.id;

    // 15 minutes, on a 30-minute meeting: the new slot overlaps the old one,
    // so the booking's own row has to be excluded or this is refused as
    // "that time is not available".
    const to = plus(plain.startsAt, 15);
    const moved = await move(id, to);
    expect(moved.status, `refused with ${moved.body.code}`).toBe(200);
    expect(moved.body.booking?.starts_at).toBe(to);

    const { data } = await service
      .from('meet_booking')
      .select('starts_at, status')
      .eq('id', id)
      .single();
    expect(new Date(data!.starts_at).toISOString()).toBe(to);
    expect(data!.status).toBe('confirmed');
  }, 90_000);

  it('moves a PENDING booking 15 minutes later, and it stays pending', async () => {
    // The case the hold created. Before v1.111.0 a pending booking was
    // invisible to availability, so it could not have blocked itself; now it
    // can, and this is the test that says it does not.
    const booked = await book(approval, mail('b'), approval.startsAt);
    expect(booked.status).toBe(200);
    const id = booked.body.booking!.id;
    const { data: before } = await service
      .from('meet_booking')
      .select('status')
      .eq('id', id)
      .single();
    expect(before!.status).toBe('pending_approval');

    const to = plus(approval.startsAt, 15);
    const moved = await move(id, to);
    expect(moved.status, `refused with ${moved.body.code}`).toBe(200);
    expect(moved.body.needs_approval).toBe(true);

    const { data: after } = await service
      .from('meet_booking')
      .select('starts_at, status')
      .eq('id', id)
      .single();
    expect(new Date(after!.starts_at).toISOString()).toBe(to);
    // Moving a request is not answering it.
    expect(after!.status).toBe('pending_approval');
  }, 90_000);

  it('still refuses a time somebody ELSE is waiting on', async () => {
    // The exclusion must be this booking only. A different invitee's pending
    // request two hours away holds its slot, and moving onto it is refused —
    // which is also the proof that the previous two passes were not simply
    // "availability never refuses anything".
    const far = plus(approval.startsAt, 120);
    const other = await book(approval, mail('c'), far);
    expect(other.status).toBe(200);

    const mine = await book(approval, mail('d'), plus(approval.startsAt, 240));
    expect(mine.status).toBe(200);

    const refused = await move(mine.body.booking!.id, far);
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('slot_unavailable');
  }, 90_000);
});
