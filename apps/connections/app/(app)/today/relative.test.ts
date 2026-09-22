// "1 days ago" was on Sjoerd's screen on 2026-09-22. Four hand-written
// strings with {n} in them cannot be right about plural rules in six
// languages; Intl is. This pins the cases that read wrong.

import { describe, expect, it } from 'vitest';

/** The rule under test, exactly as client.tsx applies it. Not imported:
 *  that module is 'use client' and pulls half the page in with it. */
const rel = (days: number, intl: string) => {
  const rtf = new Intl.RelativeTimeFormat(intl, { numeric: 'auto' });
  return Math.abs(days) >= 14 ? rtf.format(Math.round(days / 7), 'week') : rtf.format(days, 'day');
};

describe('how long ago', () => {
  it('says yesterday, not "1 days ago"', () => {
    expect(rel(-1, 'en-GB')).toBe('yesterday');
    expect(rel(-1, 'nl-NL')).toBe('gisteren');
  });

  it('says tomorrow, not "in 1 days"', () => {
    expect(rel(1, 'en-GB')).toBe('tomorrow');
  });

  it('pluralises the rest correctly, in each language', () => {
    expect(rel(-3, 'en-GB')).toBe('3 days ago');
    expect(rel(-3, 'nl-NL')).toBe('3 dagen geleden');
    expect(rel(5, 'en-GB')).toBe('in 5 days');
  });

  it('switches to weeks once days stop being readable', () => {
    expect(rel(-21, 'en-GB')).toBe('3 weeks ago');
    expect(rel(-14, 'en-GB')).toBe('2 weeks ago');
    // 13 is still days — the boundary is a choice, so it is pinned.
    expect(rel(-13, 'en-GB')).toBe('13 days ago');
  });
});
