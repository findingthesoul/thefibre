// The cases are Sjoerd's own calendars, as staging had them on 2026-10-06,
// because the bug was not hypothetical and neither should the test be.

import { describe, expect, it } from 'vitest';
import { conflictCalendarIdsFor, type CalendarRow } from './conflict-calendars.js';

const HOST = 'host-sjoerd';
const OTHER = 'host-tahirih';

// His four, with the ids shortened.
const sjoerd: CalendarRow[] = [
  { id: 'af4aaf56', host_id: HOST, google_calendar_id: 'holidays@group', role: 'conflict_check' },
  { id: '67d101c4', host_id: HOST, google_calendar_id: 'studio@group', role: 'conflict_check' },
  { id: '9d308077', host_id: HOST, google_calendar_id: 'sjoerd@soul.com', role: 'primary' },
  { id: 'e2155cf9', host_id: HOST, google_calendar_id: 'tahirih@soul.com', role: 'conflict_check' },
];

describe('which calendars count as a conflict', () => {
  it('honours the meeting type naming exactly one calendar', () => {
    // Zoom Test names only his own. The booking page always did this; the
    // reschedule check did not, and refused times the page had offered.
    expect(conflictCalendarIdsFor(HOST, sjoerd, ['9d308077'])).toEqual(['sjoerd@soul.com']);
  });

  it('falls back to primary and conflict_check when none is named', () => {
    const got = conflictCalendarIdsFor(HOST, sjoerd, []);
    expect(got).toEqual(['holidays@group', 'studio@group', 'sjoerd@soul.com', 'tahirih@soul.com']);
  });

  it('treats null and undefined as "none named"', () => {
    expect(conflictCalendarIdsFor(HOST, sjoerd, null)).toHaveLength(4);
    expect(conflictCalendarIdsFor(HOST, sjoerd, undefined)).toHaveLength(4);
  });

  it('never leaks another host’s calendars', () => {
    const rows = [
      ...sjoerd,
      { id: 'zzz', host_id: OTHER, google_calendar_id: 'someone@else', role: 'primary' },
    ];
    expect(conflictCalendarIdsFor(HOST, rows, null)).not.toContain('someone@else');
  });

  it('gives a team-mate their OWN calendars when the named ids are not theirs', () => {
    // The ids in conflict_calendar_ids belong to the meeting type's owner. A
    // second host on a team meeting type matches none of them — and must not
    // end up with an EMPTY conflict set, which is "bookable over anything".
    const rows = [
      ...sjoerd,
      { id: 'other-primary', host_id: OTHER, google_calendar_id: 'mate@soul.com', role: 'primary' },
    ];
    expect(conflictCalendarIdsFor(OTHER, rows, ['9d308077'])).toEqual(['mate@soul.com']);
  });

  it('uses a named calendar even when its role is ignore', () => {
    // Naming it IS the decision; `ignore` is the default-path exclusion.
    const rows: CalendarRow[] = [
      { id: 'a', host_id: HOST, google_calendar_id: 'ignored@cal', role: 'ignore' },
      { id: 'b', host_id: HOST, google_calendar_id: 'primary@cal', role: 'primary' },
    ];
    expect(conflictCalendarIdsFor(HOST, rows, ['a'])).toEqual(['ignored@cal']);
  });

  it('leaves out ignore on the default path', () => {
    const rows: CalendarRow[] = [
      { id: 'a', host_id: HOST, google_calendar_id: 'ignored@cal', role: 'ignore' },
      { id: 'b', host_id: HOST, google_calendar_id: 'primary@cal', role: 'primary' },
    ];
    expect(conflictCalendarIdsFor(HOST, rows, null)).toEqual(['primary@cal']);
  });

  it('skips rows with no google calendar id, and de-duplicates', () => {
    const rows: CalendarRow[] = [
      { id: 'a', host_id: HOST, google_calendar_id: null, role: 'primary' },
      { id: 'b', host_id: HOST, google_calendar_id: 'same@cal', role: 'primary' },
      { id: 'c', host_id: HOST, google_calendar_id: 'same@cal', role: 'conflict_check' },
    ];
    expect(conflictCalendarIdsFor(HOST, rows, null)).toEqual(['same@cal']);
  });

  it('a host with no calendars conflicts with nothing', () => {
    expect(conflictCalendarIdsFor('nobody', sjoerd, null)).toEqual([]);
  });
});
