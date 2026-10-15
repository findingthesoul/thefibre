import { describe, expect, it } from 'vitest';
import { DEFAULT_CARD_DATES, MEMBERSHIP_THREADS_KEEP_TODAYS_RULE, cardDateLine, cardDatesFromParams, signupByDate, toCardDates, fallbackSignupsCloseAt, signupsOpenAt, startOfDayAfter, threadDates, threadDateTokens, type ThreadDatesInput } from './thread-dates.js';

const base = (over: Partial<ThreadDatesInput> = {}): ThreadDatesInput => ({
  program: { starts_on: '2027-01-01', ends_on: '2027-06-30' },
  keyMoments: [],
  closeSession: null,
  firstSession: null,
  onTeamCalendar: false,
  timeZone: 'Europe/Amsterdam',
  ...over,
});

describe('event dates come from the key moments', () => {
  it('none: no event dates', () => {
    expect(threadDates(base()).event).toBeNull();
  });
  it('several, in any order: first start to last end, and how many', () => {
    const d = threadDates(base({
      keyMoments: [
        { id: 'b', starts_at: '2027-06-15T13:00:00Z', ends_at: '2027-06-15T15:00:00Z' },
        { id: 'a', starts_at: '2027-01-12T14:00:00Z', ends_at: '2027-01-12T16:00:00Z' },
      ],
    }));
    expect(d.event).toEqual({ start: '2027-01-12T14:00:00Z', end: '2027-06-15T15:00:00Z', count: 2 });
  });
});

describe('when sign-ups close', () => {
  const moments = [{ id: 'a', starts_at: '2027-01-12T14:00:00Z', ends_at: null }];

  it('a chosen session wins over everything', () => {
    const d = threadDates(base({ keyMoments: moments, closeSession: { starts_at: '2027-03-01T09:00:00Z' }, firstSession: { starts_at: '2027-01-05T09:00:00Z' } }));
    expect(d).toMatchObject({ signupsCloseAt: '2027-03-01T09:00:00.000Z', closeRule: 'session' });
  });
  it('else the first key moment starts — even on a team calendar', () => {
    const d = threadDates(base({ keyMoments: moments, firstSession: { starts_at: '2027-01-05T09:00:00Z' }, onTeamCalendar: true }));
    expect(d).toMatchObject({ signupsCloseAt: '2027-01-12T14:00:00.000Z', closeRule: 'first_key_moment' });
  });
  it('no key moment: when the first timed session starts', () => {
    const d = threadDates(base({ firstSession: { starts_at: '2027-01-05T09:00:00Z' } }));
    expect(d).toMatchObject({ signupsCloseAt: '2027-01-05T09:00:00.000Z', closeRule: 'fallback' });
  });
  it('no key moment, ON a team calendar: today’s rule — the end of the last day, in the thread’s zone', () => {
    const d = threadDates(base({ firstSession: { starts_at: '2027-01-05T09:00:00Z' }, onTeamCalendar: true }));
    // 30 June ends at midnight Amsterdam summer time = 22:00 UTC.
    expect(d).toMatchObject({ signupsCloseAt: '2027-06-30T22:00:00.000Z', closeRule: 'fallback' });
  });
  it('team calendar with no end date falls back to the start date', () => {
    expect(fallbackSignupsCloseAt({ program: { starts_on: '2027-01-01', ends_on: null }, firstSession: null, onTeamCalendar: true, timeZone: 'Europe/Amsterdam' }))
      .toBe('2027-01-01T23:00:00.000Z');
  });
  // Sjoerd, 2026-10-15, on threads a membership gives access to: "stay open".
  it('a thread in a membership grant keeps today’s rule, like a team calendar', () => {
    expect(MEMBERSHIP_THREADS_KEEP_TODAYS_RULE).toBe(true);
    const input = base({ firstSession: { starts_at: '2027-01-05T09:00:00Z' }, inMembershipGrant: true });
    expect(threadDates(input)).toMatchObject({ signupsCloseAt: '2027-06-30T22:00:00.000Z', closeRule: 'fallback' });
    // …and a key moment still wins over it.
    const starred = base({ ...input, keyMoments: [{ id: 'k', starts_at: '2027-02-01T10:00:00Z', ends_at: null }] });
    expect(threadDates(starred).closeRule).toBe('first_key_moment');
  });
  it('a thread no membership reaches still closes when its first session starts', () => {
    const input = base({ firstSession: { starts_at: '2027-01-05T09:00:00Z' }, inMembershipGrant: false });
    expect(threadDates(input).signupsCloseAt).toBe('2027-01-05T09:00:00.000Z');
  });
  it('an undated thread (no timed session) stays open', () => {
    expect(threadDates(base()).signupsCloseAt).toBeNull();
    expect(threadDates(base({ program: { starts_on: null, ends_on: null }, onTeamCalendar: true })).closeRule).toBe('none');
  });
  it('closes AT the moment, not after it', () => {
    const d = { signupsCloseAt: '2027-01-12T14:00:00.000Z' };
    expect(signupsOpenAt(d, new Date('2027-01-12T13:59:59Z'))).toBe(true);
    expect(signupsOpenAt(d, new Date('2027-01-12T14:00:00Z'))).toBe(false);
    expect(signupsOpenAt({ signupsCloseAt: null }, new Date('2099-01-01T00:00:00Z'))).toBe(true);
  });
});

describe('startOfDayAfter — midnight in the zone, across DST', () => {
  it('winter', () => expect(startOfDayAfter('2027-02-09', 'Europe/Amsterdam')).toBe('2027-02-09T23:00:00.000Z'));
  it('summer', () => expect(startOfDayAfter('2027-07-09', 'Europe/Amsterdam')).toBe('2027-07-09T22:00:00.000Z'));
  it('the night the clocks go forward', () => expect(startOfDayAfter('2027-03-27', 'Europe/Amsterdam')).toBe('2027-03-27T23:00:00.000Z'));
  it('the night the clocks go back', () => expect(startOfDayAfter('2027-10-30', 'Europe/Amsterdam')).toBe('2027-10-30T22:00:00.000Z'));
  it('an unknown zone is UTC', () => expect(startOfDayAfter('2027-02-09', 'Mars/Olympus')).toBe('2027-02-10T00:00:00.000Z'));
});

describe('the date tags', () => {
  it('fill each form, in the given language', () => {
    const d = threadDates(base({
      keyMoments: [
        { id: 'a', starts_at: '2027-01-12T14:00:00Z', ends_at: null },
        { id: 'b', starts_at: '2027-06-15T13:00:00Z', ends_at: null },
      ],
    }));
    expect(threadDateTokens(d, 'Europe/Amsterdam', 'en-GB')).toEqual({
      thread_dates: '1 January 2027 – 30 June 2027',
      thread_start: '1 January 2027',
      event_dates: '12 January 2027 – 15 June 2027',
      first_event: '12 January 2027',
      sessions: '2',
      signups_close: '12 January 2027',
    });
    expect(threadDateTokens(d, 'Europe/Amsterdam', 'nl-NL').first_event).toBe('12 januari 2027');
  });
  it('a bare date is never moved to the day before by a zone west of UTC', () => {
    const d = threadDates(base({ program: { starts_on: '2027-01-01', ends_on: null } }));
    expect(threadDateTokens(d, 'America/New_York', 'en-GB').thread_start).toBe('1 January 2027');
  });
  it('without key moments the event tags are empty, not made up', () => {
    const t = threadDateTokens(threadDates(base()), 'Europe/Amsterdam', 'en-GB');
    expect([t.event_dates, t.first_event, t.sessions, t.signups_close]).toEqual(['', '', '', '']);
  });
});

describe('what a card shows', () => {
  const opts = { locale: 'en', intlLocale: 'en-GB', timeZone: 'Europe/Amsterdam' };
  const journey = {
    starts_on: '2026-11-01', ends_on: '2027-07-01',
    event_starts_at: '2027-01-12T14:00:00Z', event_ends_at: '2027-06-15T15:00:00Z',
    key_moment_count: 6, signups_close_at: '2027-01-12T14:00:00Z',
  };
  const choose = (o: Partial<import('./thread-dates.js').CardDates>) => ({ ...DEFAULT_CARD_DATES, sessions: false, ...o });
  it('event dates, with the number of sessions', () => {
    expect(cardDateLine(journey, choose({ range: 'event', sessions: true }), opts)).toBe('12 Jan 2027 – 15 Jun 2027 · 6 sessions');
  });
  it('the thread period', () => {
    expect(cardDateLine(journey, choose({ range: 'thread' }), opts)).toBe('1 Nov 2026 – 1 Jul 2027');
  });
  it('start = the thread’s start, or = the first event', () => {
    expect(cardDateLine(journey, choose({ range: 'start_thread' }), opts)).toBe('1 Nov 2026');
    expect(cardDateLine(journey, choose({ range: 'start_event' }), opts)).toBe('12 Jan 2027');
  });
  it('sign up by, in the reader’s language', () => {
    expect(cardDateLine(journey, choose({ range: 'start_event', signup_by: true }), { ...opts, locale: 'nl', intlLocale: 'nl-NL' }))
      .toBe('12 jan 2027 · Inschrijven t/m 12 jan 2027');
  });
  it('sign up by names the LAST day when sign-ups close at local midnight (the default rule)', () => {
    // Closes at the start of 27 Oct in Amsterdam → the last day is 26 Oct.
    const closes = { ...journey, signups_close_at: '2026-10-26T23:00:00.000Z' };
    expect(cardDateLine(closes, choose({ range: 'start_event', signup_by: true }), opts)).toBe('12 Jan 2027 · Sign up by 26 Oct 2026');
    expect(signupByDate('2026-10-26T23:00:00.000Z', 'Europe/Amsterdam', 'en-GB')).toBe('26 Oct 2026');
    // Any other instant is its own day; and midnight in ANOTHER zone is not midnight here.
    expect(signupByDate('2026-10-26T14:00:00.000Z', 'Europe/Amsterdam', 'en-GB')).toBe('26 Oct 2026');
    expect(signupByDate('2026-10-27T04:00:00.000Z', 'America/New_York', 'en-GB')).toBe('26 Oct 2026');
    expect(signupByDate('2026-10-27T04:00:00.000Z', 'Europe/Amsterdam', 'en-GB')).toBe('27 Oct 2026');
  });
  it('an event choice with no key moment shows the thread’s dates, never blank', () => {
    const plain = { starts_on: '2027-03-01', ends_on: null, key_moment_count: 0 };
    expect(cardDateLine(plain, choose({ range: 'event', sessions: true }), opts)).toBe('1 Mar 2027');
    expect(cardDateLine(plain, choose({ range: 'start_event' }), opts)).toBe('1 Mar 2027');
  });
  it('one key moment is not "1 sessions"', () => {
    expect(cardDateLine({ ...journey, key_moment_count: 1, event_ends_at: journey.event_starts_at }, choose({ sessions: true }), opts)).toBe('12 Jan 2027');
  });
  it('no dates at all: nothing', () => {
    expect(cardDateLine({ starts_on: null, ends_on: null }, DEFAULT_CARD_DATES, opts)).toBeNull();
  });
  it('a stored value is cleaned field by field, and an embed overrides on top', () => {
    expect(toCardDates({ range: 'nonsense', sessions: false })).toEqual({ range: 'event', sessions: false, signup_by: false });
    expect(cardDatesFromParams(DEFAULT_CARD_DATES, { dates: 'start-thread', signupBy: '1', sessions: '0' }))
      .toEqual({ range: 'start_thread', sessions: false, signup_by: true });
    expect(cardDatesFromParams(DEFAULT_CARD_DATES, { dates: 'bogus' })).toEqual(DEFAULT_CARD_DATES);
  });
});
