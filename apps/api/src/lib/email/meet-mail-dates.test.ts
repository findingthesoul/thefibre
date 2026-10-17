// Dates in a Meet mail are in the mail's language (2026-10-17). Before, every
// Meet mail — Dutch, German, any — said "Monday, 2 November 2026 at 10:00 CET".
// Instants are fixed and every zone is explicit, so these read the same under
// TZ=UTC, Europe/Amsterdam and America/Los_Angeles: the server's own zone
// never enters a mail.

import { describe, expect, it } from 'vitest';
import type { Locale } from '@thefibre/shared';
import { bookingWhen, formatWhen } from './templates.js';

const AT = new Date('2026-11-02T09:00:00Z'); // 10:00 in Amsterdam (CET)
const AMS = 'Europe/Amsterdam';
const NY = 'America/New_York';

const booking = (locale: Locale, startIso = '2026-11-02T09:00:00Z', minutes = 30, invitee: string | null = null) => {
  const startsAt = new Date(startIso);
  return {
    inviteeName: 'Anna', inviteeEmail: 'a@x.org', hostName: 'Sjoerd', hostEmail: null, meetingName: 'Intake',
    startsAt, endsAt: new Date(startsAt.getTime() + minutes * 60_000), hostTimezone: AMS, inviteeTimezone: invitee,
    bookingId: 'b1', meetAppUrl: 'https://meet.example', hostSlug: 's', meetingTypeSlug: 'intake', locale,
  } as Parameters<typeof bookingWhen>[0];
};

describe('formatWhen — the reader’s language, the given zone', () => {
  it('English is exactly what every Meet mail said before', () => {
    expect(formatWhen(AT, AMS)).toBe('Monday, 2 November 2026 at 10:00 CET');
    expect(formatWhen(AT, AMS, 'en')).toBe('Monday, 2 November 2026 at 10:00 CET');
  });
  it('Dutch reads as Dutch', () => {
    expect(formatWhen(AT, AMS, 'nl')).toBe('maandag 2 november 2026 om 10:00 CET');
  });
  it('German, French, Spanish, Portuguese name the day in their own words', () => {
    expect(formatWhen(AT, AMS, 'de')).toMatch(/^Montag, 2\. November 2026/);
    expect(formatWhen(AT, AMS, 'fr')).toMatch(/^lundi 2 novembre 2026/);
    expect(formatWhen(AT, AMS, 'es')).toMatch(/^lunes, 2 de noviembre de 2026/);
    expect(formatWhen(AT, AMS, 'pt')).toMatch(/^segunda-feira, 2 de novembro de 2026/);
  });
  it('the zone is the one passed, never the server’s', () => {
    expect(formatWhen(AT, NY, 'nl')).toBe('maandag 2 november 2026 om 04:00 EST');
  });
  it('across the DST change: summer time in Amsterdam a week earlier', () => {
    expect(formatWhen(new Date('2026-10-23T08:00:00Z'), AMS, 'nl')).toBe('vrijdag 23 oktober 2026 om 10:00 CEST');
  });
});

describe('bookingWhen — the booking mails’ When line, in the mail’s language', () => {
  it('English unchanged: one date and a time span', () => {
    expect(bookingWhen(booking('en'), 'host')).toBe('Monday, 2 November 2026 at 10:00 – 10:30 CET');
  });
  it('Dutch: the same shape, in Dutch', () => {
    expect(bookingWhen(booking('nl'), 'host')).toBe('maandag 2 november 2026 om 10:00 – 10:30 CET');
  });
  it('a guest elsewhere: their clock first, the host’s in brackets — in Dutch too', () => {
    expect(bookingWhen(booking('nl', undefined, 30, NY), 'invitee')).toBe('maandag 2 november 2026 om 04:00 – 04:30 EST (10:00 CET)');
  });
  it('a range across midnight keeps both dates, both localized', () => {
    const line = bookingWhen(booking('nl', '2026-11-02T22:30:00Z', 90), 'host');
    expect(line).toBe('maandag 2 november 2026 om 23:30 CET → dinsdag 3 november 2026 om 01:00 CET');
  });
  it('no English weekday or "at" in a Dutch line', () => {
    const line = bookingWhen(booking('nl', undefined, 30, NY), 'invitee');
    expect(line).not.toMatch(/Monday|Tuesday| at /);
  });
});
