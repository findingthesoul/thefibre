// The rules that decide whether somebody's phone buzzes.
//
// Each of these is a case where getting it wrong is invisible in the code and
// obvious in a participant's inbox — either a message about a session that
// never really existed, or silence about one that moved.

import { describe, expect, it } from 'vitest';
import {
  calendarStateChanged,
  calendarStateOf,
  collapseDecision,
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
    expect(calendarInviteEmail({ ...base, kind: 'cancelled' }).text).toMatch(/take it out/i);
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
