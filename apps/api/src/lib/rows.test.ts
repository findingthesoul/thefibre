// The helper exists because a defaulted answer is worse than no answer.
//
// An empty response at least LOOKS like nothing. A defaulted one looks like a
// result: "no tickets", "no bookings", "nothing blocks this request". These
// three assertions are the whole contract, and the third is the one that was
// nearly shipped — a count that failed and read as zero.

import { describe, expect, it } from 'vitest';
import { count, row, rows } from './rows.js';

describe('rows', () => {
  it('passes a real list through', () => {
    expect(rows('x', { data: [1, 2], error: null })).toEqual([1, 2]);
  });

  it('treats a genuinely empty list as empty', () => {
    expect(rows('x', { data: [], error: null })).toEqual([]);
  });

  it('throws rather than calling a failure an empty list', () => {
    expect(() => rows('tickets', { data: null, error: { message: 'boom', code: 'PGRST205' } })).toThrow(
      /tickets: PGRST205 boom/,
    );
  });
});

describe('row', () => {
  it('passes null through when there genuinely is no row', () => {
    expect(row('x', { data: null, error: null })).toBeNull();
  });

  it('throws on a failure, which is not the same as "no row"', () => {
    expect(() => row('profile', { data: null, error: { message: 'nope' } })).toThrow(/profile: nope/);
  });
});

describe('count', () => {
  it('passes a real count through, including a true zero', () => {
    expect(count('x', { count: 7, error: null })).toBe(7);
    expect(count('x', { count: 0, error: null })).toBe(0);
  });

  // The one that matters. lib/portal-erasure.ts counts the people whose
  // places depend on an organiser's account; a failed count defaulting to
  // zero told that person their account could simply go.
  it('throws rather than reporting a failed count as none', () => {
    expect(() =>
      count('enrolments in those threads', { count: null, error: { message: 'timeout' } }),
    ).toThrow(/enrolments in those threads: timeout/);
  });
});
