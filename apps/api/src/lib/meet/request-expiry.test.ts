// The clock is an argument here, never read — a test that reads the wall
// clock is green in CI (UTC) and red on this machine after midnight.

import { describe, expect, it } from 'vitest';
import {
  REQUEST_EXPIRY_HOURS,
  requestExpiryDeadline,
  requestHasExpired,
} from './request-expiry.js';

const at = (iso: string) => new Date(iso);
const HOUR = 60 * 60 * 1000;

describe('when a booking request stops waiting', () => {
  it('gives a far-off meeting 48 hours, not until the meeting', () => {
    // Asked on Monday for a meeting three weeks out: the slot must come back
    // on Wednesday, while it is still worth something to somebody else.
    const created = at('2026-10-05T09:00:00.000Z');
    const starts = at('2026-10-26T14:00:00.000Z');
    expect(requestExpiryDeadline(created, starts).toISOString()).toBe(
      '2026-10-07T09:00:00.000Z',
    );
  });

  it('never outlives the meeting it is for', () => {
    // Asked tonight for tomorrow morning. 48 hours would put the deadline a
    // day AFTER the meeting had already not happened.
    const created = at('2026-10-05T22:00:00.000Z');
    const starts = at('2026-10-06T09:00:00.000Z');
    expect(requestExpiryDeadline(created, starts).toISOString()).toBe(
      '2026-10-06T09:00:00.000Z',
    );
  });

  it('takes the start time when the two land on the same instant', () => {
    // Exactly 48 hours out. Either answer is the same moment; what matters is
    // that the boundary is <=, so this does not depend on float luck.
    const created = at('2026-10-05T09:00:00.000Z');
    const starts = new Date(created.getTime() + REQUEST_EXPIRY_HOURS * HOUR);
    expect(requestExpiryDeadline(created, starts).getTime()).toBe(starts.getTime());
  });

  it('a request made a minute ago has not expired', () => {
    const created = at('2026-10-05T09:00:00.000Z');
    const starts = at('2026-10-20T09:00:00.000Z');
    expect(requestHasExpired(created, starts, at('2026-10-05T09:01:00.000Z'))).toBe(false);
  });

  it('expires the instant the deadline arrives, not a tick later', () => {
    const created = at('2026-10-05T09:00:00.000Z');
    const starts = at('2026-10-20T09:00:00.000Z');
    const deadline = requestExpiryDeadline(created, starts);
    expect(requestHasExpired(created, starts, new Date(deadline.getTime() - 1))).toBe(false);
    expect(requestHasExpired(created, starts, deadline)).toBe(true);
  });

  it('a request for a meeting that has already started is over', () => {
    // The sweep runs every five minutes, so this is the state a request is
    // found in when its meeting began between two ticks.
    const created = at('2026-10-06T08:00:00.000Z');
    const starts = at('2026-10-06T09:00:00.000Z');
    expect(requestHasExpired(created, starts, at('2026-10-06T09:04:00.000Z'))).toBe(true);
  });
});
