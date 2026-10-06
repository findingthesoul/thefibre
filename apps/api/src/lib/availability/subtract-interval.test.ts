import { describe, expect, it } from 'vitest';
import { subtractInterval, type Interval } from './engine.js';

// A booking being rescheduled must not block its own new time. The database
// row was already excluded; its Google Calendar event was not, because
// freebusy answers with intervals and no event ids — so the host's calendar
// still said "busy" at the old time and the meeting blocked its own move.
//
// Carving the interval out, rather than dropping any block that touches it,
// is the point: Google merges adjacent events into one busy block, so a block
// that overlaps the old slot can be partly somebody else's meeting.

const iv = (start: string, end: string): Interval => ({
  start: new Date(start),
  end: new Date(end),
});
const show = (list: Interval[]) =>
  list.map((i) => `${i.start.toISOString().slice(11, 16)}-${i.end.toISOString().slice(11, 16)}`);

const BUSY_10_11 = iv('2026-10-07T10:00:00Z', '2026-10-07T11:00:00Z');

describe('a meeting stops blocking its own move', () => {
  it('removes a busy block that is exactly the old booking', () => {
    expect(subtractInterval([BUSY_10_11], BUSY_10_11)).toEqual([]);
  });

  it('leaves every other busy block alone', () => {
    const other = iv('2026-10-07T14:00:00Z', '2026-10-07T15:00:00Z');
    expect(show(subtractInterval([other], BUSY_10_11))).toEqual(['14:00-15:00']);
  });

  it('keeps the parts either side when Google merged the day into one block', () => {
    // 09:00-12:00 is somebody else's 09-10, this booking 10-11, another 11-12,
    // and freebusy hands all three back as one interval.
    const merged = iv('2026-10-07T09:00:00Z', '2026-10-07T12:00:00Z');
    expect(show(subtractInterval([merged], BUSY_10_11))).toEqual(['09:00-10:00', '11:00-12:00']);
  });

  it('keeps the earlier part when the block starts before and ends inside', () => {
    const before = iv('2026-10-07T09:30:00Z', '2026-10-07T10:30:00Z');
    expect(show(subtractInterval([before], BUSY_10_11))).toEqual(['09:30-10:00']);
  });

  it('keeps the later part when the block starts inside and ends after', () => {
    const after = iv('2026-10-07T10:30:00Z', '2026-10-07T11:30:00Z');
    expect(show(subtractInterval([after], BUSY_10_11))).toEqual(['11:00-11:30']);
  });

  it('touching blocks are not overlapping — an adjacent meeting still blocks', () => {
    const adjacent = iv('2026-10-07T11:00:00Z', '2026-10-07T12:00:00Z');
    expect(show(subtractInterval([adjacent], BUSY_10_11))).toEqual(['11:00-12:00']);
  });

  it('does nothing when there is nothing to cut', () => {
    expect(show(subtractInterval([BUSY_10_11], null))).toEqual(['10:00-11:00']);
    // A zero-length or inverted cut must not silently clear the calendar.
    const zero = iv('2026-10-07T10:00:00Z', '2026-10-07T10:00:00Z');
    expect(show(subtractInterval([BUSY_10_11], zero))).toEqual(['10:00-11:00']);
  });
});
