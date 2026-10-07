// The When line in a booking email, and whose clock it is written in.
//
// From a real guest on production, 2026-10-07: a confirmation for a 22:00
// CEST meeting arrived in US Eastern, where it was 16:00, and said only CEST.
// Sjoerd: "quite a huge problem actually" — a meeting a guest reads an hour
// wrong is a meeting they miss.
//
// Every case here fixes the clock, because the answer depends on the date:
// two zones' gap is not a constant, and a test that asks "what time is it
// there now" passes in July and fails in November.
//
// On the zone NAMES below: the whole mail formats in en-GB, which names the
// zones a British reader knows and gives the rest as offsets — Amsterdam is
// CEST, New York is GMT-4. That stays, deliberately. One locale keeps the
// guest's copy and the host's copy consistent, an offset is unambiguous to
// everybody, and which abbreviations an English locale knows is ICU data that
// differs between Node builds — a test demanding "EDT" would be green here
// and red on another machine. The fix is the TIME, not the abbreviation.

import { describe, expect, it } from 'vitest';
import { bookingWhen } from './templates.js';

/** The booking from the guest's report: 2026-10-07 22:00–22:30 in Amsterdam. */
function booking(startIso: string, minutes = 30, inviteeTimezone?: string | null) {
  const startsAt = new Date(startIso);
  return {
    inviteeName: 'Guest',
    inviteeEmail: 'guest@example.com',
    hostName: 'Host',
    hostEmail: 'host@example.com',
    meetingName: 'Short call',
    startsAt,
    endsAt: new Date(startsAt.getTime() + minutes * 60_000),
    hostTimezone: 'Europe/Amsterdam',
    ...(inviteeTimezone === undefined ? {} : { inviteeTimezone }),
    bookingId: 'b1',
    meetAppUrl: 'https://meet.example',
    hostSlug: 'host',
    meetingTypeSlug: 'short-call',
  };
}

describe('the guest is told their own time first', () => {
  it('writes the guest line in the guest zone, with the host zone in brackets', () => {
    // 20:00 UTC = 22:00 CEST = 16:00 EDT. The exact case reported.
    const line = bookingWhen(booking('2026-10-07T20:00:00Z', 30, 'America/New_York'), 'invitee');
    // The whole line, so this test says what the guest actually reads.
    expect(line).toBe('Wednesday, 7 October 2026 at 16:00 – 16:30 GMT-4 (22:00 CEST)');
    // and NOT the other way round: the guest's time leads.
    expect(line.indexOf('16:00')).toBeLessThan(line.indexOf('22:00'));
  });

  it('writes the host line in the host zone, with no bracket', () => {
    const line = bookingWhen(booking('2026-10-07T20:00:00Z', 30, 'America/New_York'), 'host');
    expect(line).toBe('Wednesday, 7 October 2026 at 22:00 – 22:30 CEST');
    expect(line).not.toContain('16:00');
    expect(line).not.toContain('(');
  });

  // THE regression guard for every booking that already exists: no stored
  // zone must read exactly as it does today.
  it('falls back to the host zone when the booking never recorded one', () => {
    for (const missing of [undefined, null, '']) {
      const line = bookingWhen(booking('2026-10-07T20:00:00Z', 30, missing as string | null), 'invitee');
      expect(line, String(missing)).toBe(bookingWhen(booking('2026-10-07T20:00:00Z'), 'host'));
      expect(line).toContain('22:00');
      expect(line).not.toContain('(');
    }
  });

  it('says nothing twice when the two zones read the same', () => {
    const paris = bookingWhen(booking('2026-10-07T20:00:00Z', 30, 'Europe/Paris'), 'invitee');
    expect(paris).toBe('Wednesday, 7 October 2026 at 22:00 – 22:30 CEST');
    // The guest sitting in the host's own zone is the same case.
    const same = bookingWhen(booking('2026-10-07T20:00:00Z', 30, 'Europe/Amsterdam'), 'invitee');
    expect(same).not.toContain('(');
  });
});

describe('the gap between two zones is not a constant', () => {
  // 28 October 2026 sits BETWEEN the two switches: the EU went back on the
  // 25th, the US goes back on 1 November. So Amsterdam is CET (+1) while New
  // York is still EDT (-4) — five hours, not the usual six. Anything that
  // stores an offset instead of a zone is an hour wrong on this date, and
  // right on both sides of it, which is why this case is here and not a
  // July one.
  it('is five hours apart on 28 October 2026, not six', () => {
    const line = bookingWhen(booking('2026-10-28T21:00:00Z', 30, 'America/New_York'), 'invitee');
    // GMT-4 and CET in one line is the whole point: New York has not gone
    // back yet, Amsterdam has.
    expect(line).toBe('Wednesday, 28 October 2026 at 17:00 – 17:30 GMT-4 (22:00 CET)');
  });

  it('is six hours apart a fortnight later, same two zones', () => {
    // 11 November: both have switched. 21:00 UTC = 22:00 CET = 16:00 EST.
    const line = bookingWhen(booking('2026-11-11T21:00:00Z', 30, 'America/New_York'), 'invitee');
    // Same two zones, same 21:00 UTC, one hour further apart: GMT-5 now.
    expect(line).toBe('Wednesday, 11 November 2026 at 16:00 – 16:30 GMT-5 (22:00 CET)');
  });

  it('carries the DATE in the bracket when the two zones disagree about the day', () => {
    // 22:00 CEST on the 7th is 09:00 on the 8th in Auckland. A bracketed
    // "(09:00 NZDT)" with no date reads as thirteen hours early.
    const line = bookingWhen(booking('2026-10-07T20:00:00Z', 30, 'Pacific/Auckland'), 'invitee');
    expect(line).toContain('Thursday, 8 October 2026');
    // The bracket carries the host's DATE as well, not just a bare time.
    expect(line).toMatch(/\(Wednesday, 7 October 2026 at 22:00 CEST\)$/);
  });
});

describe('a stored zone that Intl will not accept', () => {
  // One typo'd timezone row took down every signed-in page on 2026-09-28. An
  // email is not allowed to be the second place that happens.
  it('does not throw, and reads as the host zone', () => {
    const line = bookingWhen(booking('2026-10-07T20:00:00Z', 30, 'Athenes'), 'invitee');
    expect(line).toContain('22:00');
    expect(line).toContain('CEST');
  });

  it('does not throw on a host zone that is nonsense either', () => {
    const b = { ...booking('2026-10-07T20:00:00Z', 30, 'America/New_York'), hostTimezone: 'Nowhere/Nothing' };
    expect(() => bookingWhen(b, 'invitee')).not.toThrow();
    expect(bookingWhen(b, 'invitee')).toContain('16:00');
  });
});
