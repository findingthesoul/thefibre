import { describe, expect, it } from 'vitest';
import { zoomLocalStart } from './client.js';

// Found by the staging Zoom end-to-end on 2026-10-01, and only by looking at
// ZOOM's own detail page. Everything on our side agreed and was right: the
// meet_booking row said 13:30 Amsterdam, Google Calendar's event said 13:30
// +02:00, the invitee's email said 13:30. Zoom alone said 11:30.
//
// Cause: Zoom takes two forms of start_time, and the pairing matters.
//   "…T11:30:00Z"  is GMT, and `timezone` is then ignored.
//   "…T13:30:00"   is LOCAL wall clock, read in `timezone`.
// We sent `startsAt.toISOString()` — the GMT form, with milliseconds — AND a
// timezone. Zoom read the GMT digits as Amsterdam wall clock, so every
// meeting was out by the offset.
//
// Pre-existing since the file was written, and invisible until now: Zoom was
// inert until the Marketplace app existed, so nothing had ever read a real
// Zoom meeting back. The create was wrong too — the staging run only exposed
// it on a RESCHEDULE because that was the first time anyone compared Zoom's
// clock with ours.
//
// These pin the string that goes on the wire. A unit test cannot ask Zoom what
// it did, so what it CAN do is assert the exact bytes, and the rule is: no
// zone suffix, no milliseconds, local wall clock in the zone we name.

describe('the start_time string sent to Zoom', () => {
  it('is the LOCAL wall clock in the named zone, not GMT', () => {
    // The exact booking from the staging run: 11:30 UTC is 13:30 in Amsterdam.
    expect(zoomLocalStart('2026-10-12T11:30:00.000Z', 'Europe/Amsterdam')).toBe(
      '2026-10-12T13:30:00',
    );
  });

  it('carries NO Z and no offset — the suffix is what made Zoom ignore the zone', () => {
    const s = zoomLocalStart('2026-10-12T11:30:00.000Z', 'Europe/Amsterdam');
    expect(s).not.toMatch(/Z$/);
    expect(s).not.toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it('carries no milliseconds', () => {
    expect(zoomLocalStart('2026-10-12T11:30:00.000Z', 'Europe/Amsterdam')).not.toContain('.');
  });

  it('matches Zoom’s documented shape exactly', () => {
    expect(zoomLocalStart('2026-10-12T11:30:00.000Z', 'Europe/Amsterdam')).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
    );
  });

  it('follows the zone across a DST boundary rather than assuming an offset', () => {
    // Amsterdam is +02:00 in summer and +01:00 in winter. A hard-coded offset
    // would be right half the year, which is the worst kind of right.
    expect(zoomLocalStart('2026-07-01T11:30:00.000Z', 'Europe/Amsterdam')).toBe(
      '2026-07-01T13:30:00',
    );
    expect(zoomLocalStart('2026-12-01T11:30:00.000Z', 'Europe/Amsterdam')).toBe(
      '2026-12-01T12:30:00',
    );
  });

  it('rolls the DATE when the zone pushes it over midnight', () => {
    // 23:30 UTC is already the next day in Amsterdam. Sending the UTC date
    // with a local time would put the meeting on the wrong day entirely.
    expect(zoomLocalStart('2026-10-12T23:30:00.000Z', 'Europe/Amsterdam')).toBe(
      '2026-10-13T01:30:00',
    );
  });

  it('works for a zone behind UTC too', () => {
    expect(zoomLocalStart('2026-10-12T11:30:00.000Z', 'America/New_York')).toBe(
      '2026-10-12T07:30:00',
    );
  });

  it('is a no-op for UTC itself', () => {
    expect(zoomLocalStart('2026-10-12T11:30:00.000Z', 'UTC')).toBe('2026-10-12T11:30:00');
  });
});
