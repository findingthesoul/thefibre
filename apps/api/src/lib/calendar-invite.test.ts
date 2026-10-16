// The rules that decide whether somebody's phone buzzes.
//
// Each of these is a case where getting it wrong is invisible in the code and
// obvious in a participant's inbox — either a message about a session that
// never really existed, or silence about one that moved.

import { describe, expect, it } from 'vitest';
import {
  enrolmentHoldsAPlace,
  calendarStateChanged,
  calendarStateOf,
  collapseDecision,
  whenLine,
  type CalendarState,
} from './calendar-invite.js';
import { calendarInviteEmail } from './email/thread-templates.js';

const state = (over: Partial<CalendarState> = {}): CalendarState => ({
  starts_at: '2027-01-05T15:00:00Z',
  ends_at: '2027-01-05T17:00:00Z',
  location: 'Athens',
  location_url: null,
  meeting_url: null,
  ...over,
});

describe('calendarStateChanged', () => {
  it('ignores a typo — nothing here is the description', () => {
    expect(calendarStateChanged(state(), state())).toBe(false);
  });

  it('notices a new date, time, place or link', () => {
    expect(calendarStateChanged(state(), state({ starts_at: '2027-02-09T15:00:00Z' }))).toBe(true);
    expect(calendarStateChanged(state(), state({ ends_at: '2027-01-05T18:00:00Z' }))).toBe(true);
    expect(calendarStateChanged(state(), state({ location: 'Rotterdam' }))).toBe(true);
    expect(calendarStateChanged(state(), state({ meeting_url: 'https://call.test/x' }))).toBe(true);
  });

  // The one that would have mailed everybody on every save. A timestamp does
  // not come back from Postgres in the spelling it went in.
  it('compares instants, not spellings', () => {
    expect(
      calendarStateChanged(
        state({ starts_at: '2027-01-05T15:00:00Z' }),
        state({ starts_at: '2027-01-05 15:00:00+00' }),
      ),
    ).toBe(false);
    expect(
      calendarStateChanged(
        state({ starts_at: '2027-01-05T15:00:00Z' }),
        state({ starts_at: '2027-01-05T16:00:00+01:00' }),
      ),
    ).toBe(false);
  });

  it('reads a row without inventing fields', () => {
    expect(calendarStateOf({ starts_at: '2027-01-05T15:00:00Z', title: 'ignored' })).toEqual({
      starts_at: '2027-01-05T15:00:00Z',
      ends_at: null,
      location: null,
      location_url: null,
      meeting_url: null,
    });
  });
});

describe('collapseDecision', () => {
  describe('before anybody has been told', () => {
    it('moving a draft tells nobody, because nobody holds it', () => {
      expect(collapseDecision({ everSent: false, pendingKind: null, kind: 'moved' })).toEqual({
        do: 'ignore',
      });
    });

    it('publishing queues it as new', () => {
      expect(collapseDecision({ everSent: false, pendingKind: null, kind: 'added' })).toEqual({
        do: 'insert',
        kind: 'added',
      });
    });

    it('moving it again after publishing keeps it new, at wherever it lands', () => {
      expect(collapseDecision({ everSent: false, pendingKind: 'added', kind: 'moved' })).toEqual({
        do: 'update',
        kind: 'added',
      });
    });

    // Added and cancelled on the same afternoon is not two messages. It is
    // none: nobody was ever told the session existed.
    it('added then cancelled, both unsent, is nothing at all', () => {
      expect(collapseDecision({ everSent: false, pendingKind: 'added', kind: 'cancelled' })).toEqual(
        { do: 'forget' },
      );
      expect(collapseDecision({ everSent: false, pendingKind: null, kind: 'cancelled' })).toEqual({
        do: 'ignore',
      });
    });
  });

  describe('once it is in people\'s calendars', () => {
    it('a move is a change worth queueing', () => {
      expect(collapseDecision({ everSent: true, pendingKind: null, kind: 'moved' })).toEqual({
        do: 'insert',
        kind: 'moved',
      });
    });

    it('three moves before one send are one change', () => {
      expect(collapseDecision({ everSent: true, pendingKind: 'moved', kind: 'moved' })).toEqual({
        do: 'update',
        kind: 'moved',
      });
    });

    // The order matters: telling someone a session moved AND that it is
    // cancelled is worse than telling them only the second thing.
    it('a cancellation supersedes a queued move', () => {
      expect(collapseDecision({ everSent: true, pendingKind: 'moved', kind: 'cancelled' })).toEqual({
        do: 'update',
        kind: 'cancelled',
      });
    });

    it('cancelling something people hold always says so', () => {
      expect(collapseDecision({ everSent: true, pendingKind: null, kind: 'cancelled' })).toEqual({
        do: 'insert',
        kind: 'cancelled',
      });
    });
  });
});

// The sentence somebody acts on.
//
// This email told every recipient "Your calendar has been updated, so you do
// not need to add anything" while Gmail was refusing the invitation outright.
// Someone reads that, does nothing, and misses the session. Pinned so the
// promise cannot come back by accident — including once the sending problem is
// fixed, when it would be true but still the wrong thing to lean on.
describe('calendarInviteEmail — what it promises', () => {
  const base = {
    sessionTitle: 'Conversation 1',
    threadTitle: 'Year agenda',
    organiserName: 'Sjoerd Luteijn',
    whenLine: 'Tuesday, 9 February 2027, 15:00–17:00 UTC',
  };

  it('never claims the reader’s calendar has already updated itself', () => {
    for (const kind of ['added', 'moved', 'cancelled'] as const) {
      const mail = calendarInviteEmail({ ...base, kind });
      expect(mail.text).not.toMatch(/calendar has been updated/i);
      expect(mail.html).not.toMatch(/calendar has been updated/i);
      expect(mail.text).not.toMatch(/do not need to add/i);
    }
  });

  it('carries the new time in words, so the message works with no calendar at all', () => {
    const mail = calendarInviteEmail({
      ...base,
      kind: 'moved',
      wasLine: 'Tuesday, 5 January 2027, 15:00–16:00 UTC',
    });
    expect(mail.text).toContain('Tuesday, 9 February 2027');
    expect(mail.text).toContain('Was: Tuesday, 5 January 2027');
    expect(mail.subject).toContain('Moved:');
  });

  // Not even a hedge about what the calendar did: the email cannot know, so
  // every one of these tells the reader what they can DO instead.
  it('says nothing about what the calendar did, in any of the three cases', () => {
    for (const kind of ['added', 'moved', 'cancelled'] as const) {
      const mail = calendarInviteEmail({ ...base, kind });
      expect(mail.text).not.toMatch(/disappear on its own/i);
      expect(mail.text).not.toMatch(/some calendars/i);
      expect(mail.text).not.toMatch(/has been updated/i);
    }
    expect(calendarInviteEmail({ ...base, kind: 'moved' }).text).toMatch(/attached if you need to add it/i);
    expect(calendarInviteEmail({ ...base, kind: 'cancelled' }).text).toMatch(/open the attached file to remove it/i);
  });

  // The invitation is the organiser's, so the mail is signed by them — not
  // "— The Fibre" under a Thread invitation.
  it('is signed by the organiser, in both halves', () => {
    for (const kind of ['added', 'moved', 'cancelled'] as const) {
      const mail = calendarInviteEmail({ ...base, kind });
      expect(mail.text.trimEnd().endsWith('— Sjoerd Luteijn')).toBe(true);
      expect(mail.html).toContain('— Sjoerd Luteijn');
      expect(mail.text).not.toMatch(/The Fibre/);
    }
    expect(calendarInviteEmail({ ...base, kind: 'added', organiserName: '' }).text.trimEnd().endsWith('— The Thread')).toBe(true);
  });

  it('keeps an organiser’s own words, and does not let them inject markup', () => {
    const mail = calendarInviteEmail({
      ...base,
      kind: 'moved',
      note: 'Venue was double-booked <script>alert(1)</script>',
    });
    expect(mail.text).toContain('Venue was double-booked');
    expect(mail.html).not.toContain('<script>');
  });
});

// WHO HEARS ABOUT A SESSION MOVING. Until 2026-10-14 this compared against
// statuses that do not exist ('withdrawn', 'rejected', 'cancelled'), so a
// person the organiser had declined kept receiving their calendar updates.
// Every real enrolment status is listed, so a new one cannot slip past.
describe('enrolmentHoldsAPlace', () => {
  it('a declined (dropped) person is not told', () => {
    expect(enrolmentHoldsAPlace('dropped')).toBe(false);
  });
  it('every live status is', () => {
    for (const s of ['invited', 'enrolled', 'active', 'completed']) expect(enrolmentHoldsAPlace(s), s).toBe(true);
  });
});

// THE TIME IN THE THREAD'S OWN ZONE. Until 2026-10-15 every invitation email
// printed UTC, so an Amsterdam session at 15:00 read "13:00–15:00 UTC" in
// summer and "14:00–16:00 UTC" in winter.
describe('whenLine', () => {
  it('summer time in Amsterdam', () => {
    expect(whenLine(new Date('2027-06-08T13:00:00Z'), new Date('2027-06-08T15:00:00Z'), 'Europe/Amsterdam')).toBe(
      'Tuesday, 8 June 2027, 15:00–17:00 (Amsterdam time)',
    );
  });
  it('winter time in Amsterdam — the same wall clock, an hour different in UTC', () => {
    expect(whenLine(new Date('2027-02-09T14:00:00Z'), new Date('2027-02-09T16:00:00Z'), 'Europe/Amsterdam')).toBe(
      'Tuesday, 9 February 2027, 15:00–17:00 (Amsterdam time)',
    );
  });
  it('the day follows the zone, not UTC', () => {
    expect(whenLine(new Date('2027-02-09T23:30:00Z'), null, 'Europe/Amsterdam')).toBe('Wednesday, 10 February 2027, 00:30 (Amsterdam time)');
  });
  it('an unknown zone falls back to UTC rather than throwing', () => {
    expect(whenLine(new Date('2027-02-09T14:00:00Z'), null, 'Mars/Olympus')).toBe('Tuesday, 9 February 2027, 14:00 (UTC)');
  });
  it('a multi-word zone reads as words', () => {
    expect(whenLine(new Date('2027-02-09T14:00:00Z'), null, 'America/New_York')).toBe('Tuesday, 9 February 2027, 09:00 (New York time)');
  });
});

// Participants hear about every change (Sjoerd, 2026-10-16): a place-only
// move says so, the online link is in the words and not only in the .ics,
// and the email is in the reader's language.
describe('calendarInviteEmail — place, link and language', () => {
  const base = {
    sessionTitle: 'Conversation 1',
    threadTitle: 'Year agenda',
    organiserName: 'Sjoerd Luteijn',
    whenLine: 'Tuesday, 9 February 2027, 15:00–17:00 (Amsterdam time)',
  };

  it('a place-only move names the new place, not a "new time" that did not change', () => {
    const mail = calendarInviteEmail({
      ...base,
      kind: 'moved',
      placeOnly: true,
      wasLine: base.whenLine,
      wasWhereLine: 'The old hall',
      whereLine: 'De Nieuwe Kerk',
    });
    expect(mail.subject).toBe('New place: Conversation 1');
    expect(mail.subject).not.toContain('now');
    expect(mail.text).toContain('The time stays the same.');
    expect(mail.text).toContain('Was: The old hall');
    expect(mail.text).toContain('Now: De Nieuwe Kerk');
    expect(mail.text).toMatch(/The new place is above/);
    expect(mail.html).toContain('text-decoration:line-through;color:#737373;">The old hall');
  });

  it('a real move keeps its wording', () => {
    const mail = calendarInviteEmail({ ...base, kind: 'moved', placeOnly: false, wasLine: 'Monday' });
    expect(mail.subject).toBe(`Moved: Conversation 1 — now ${base.whenLine}`);
  });

  it('shows the online link in the email, as a link only when it is http(s)', () => {
    const mail = calendarInviteEmail({ ...base, kind: 'moved', onlineUrl: 'https://meet.example.com/abc' });
    expect(mail.text).toContain('Online: https://meet.example.com/abc');
    expect(mail.html).toContain('href="https://meet.example.com/abc"');
    const bad = calendarInviteEmail({ ...base, kind: 'added', onlineUrl: 'javascript:alert(1)' });
    expect(bad.text).not.toContain('Online:');
    expect(bad.html).not.toContain('javascript:');
    expect(calendarInviteEmail({ ...base, kind: 'cancelled', onlineUrl: 'https://meet.example.com/abc' }).text).not.toContain('Online:');
  });

  it('is written in the reader’s language; English when none is known', () => {
    const nl = calendarInviteEmail({ ...base, kind: 'cancelled', locale: 'nl' });
    expect(nl.subject).toBe('Geannuleerd: Conversation 1');
    expect(nl.text).toContain('Sjoerd Luteijn heeft deze sessie van Year agenda geannuleerd.');
    expect(calendarInviteEmail({ ...base, kind: 'cancelled', locale: null }).subject).toBe('Cancelled: Conversation 1');
  });

  it('whenLine in Dutch; English exactly as before', () => {
    const s = new Date('2027-02-09T14:00:00Z');
    const e = new Date('2027-02-09T16:00:00Z');
    expect(whenLine(s, e, 'Europe/Amsterdam', 'en')).toBe(whenLine(s, e, 'Europe/Amsterdam'));
    expect(whenLine(s, e, 'Europe/Amsterdam', 'nl')).toBe('dinsdag 9 februari 2027, 15:00–17:00 (Amsterdam-tijd)');
  });
});
