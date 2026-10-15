// threadDateLine: the one way every app prints a thread's dates (thread dates
// slice 4). The rule itself is cardDateLine's and has its own tests; these
// pin what this wrapper adds — the language and zone it is written in, and
// the two fixed choices a PAGE and the ORGANISER's list use.

import { describe, expect, it } from 'vitest';
import { ORGANISER_DATES, PAGE_DATES, threadDateLine } from './thread-date-line';

const journey = {
  starts_on: '2027-01-04',
  ends_on: '2027-06-30',
  event_starts_at: '2027-01-12T18:00:00Z',
  event_ends_at: '2027-06-15T20:00:00Z',
  key_moment_count: 6,
  signups_close_at: '2027-01-12T18:00:00Z',
};

describe('threadDateLine', () => {
  it('a PAGE shows the key-moment span and the count, not the program period', () => {
    expect(threadDateLine(journey, PAGE_DATES, { language: 'en', timezone: 'Europe/Amsterdam' })).toBe(
      '12 Jan 2027 – 15 Jun 2027 · 6 sessions',
    );
  });

  it('the ORGANISER list shows the thread period, the count and when sign-ups close', () => {
    expect(threadDateLine(journey, ORGANISER_DATES, { language: 'en', timezone: 'Europe/Amsterdam' })).toBe(
      '4 Jan 2027 – 30 Jun 2027 · 6 sessions · Sign up by 12 Jan 2027',
    );
  });

  it('writes in the language it is given', () => {
    expect(threadDateLine(journey, PAGE_DATES, { language: 'nl', timezone: 'Europe/Amsterdam' })).toContain(
      '6 sessies',
    );
  });

  it('falls back to English for a language it does not know, rather than failing', () => {
    expect(threadDateLine(journey, PAGE_DATES, { language: 'xx', timezone: 'Europe/Amsterdam' })).toContain(
      '6 sessions',
    );
    expect(threadDateLine(journey, PAGE_DATES, { language: null, timezone: null })).toContain('6 sessions');
  });

  it('reads a timed moment in the thread’s zone: 23:30 in New York is the next day in Amsterdam', () => {
    const late = { ...journey, event_starts_at: '2027-01-13T04:30:00Z', event_ends_at: '2027-01-13T04:30:00Z', key_moment_count: 1 };
    expect(threadDateLine(late, PAGE_DATES, { language: 'en', timezone: 'America/New_York' })).toBe('12 Jan 2027');
    expect(threadDateLine(late, PAGE_DATES, { language: 'en', timezone: 'Europe/Amsterdam' })).toBe('13 Jan 2027');
  });

  it('a thread with no key moment shows its period on a page — never blank', () => {
    const plain = { starts_on: '2027-03-01', ends_on: '2027-03-01', key_moment_count: 0 };
    expect(threadDateLine(plain, PAGE_DATES, { language: 'en' })).toBe('1 Mar 2027');
  });

  it('a thread with no dates at all answers null, so the caller can say so', () => {
    expect(threadDateLine({ starts_on: null, ends_on: null }, ORGANISER_DATES, { language: 'en' })).toBeNull();
  });
});
