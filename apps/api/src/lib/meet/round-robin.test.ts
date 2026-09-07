// The fairness rules decide who gets the booking — a wrong pick is money and
// workload landing on the wrong person, silently. Each rule is locked here.

import { describe, expect, it } from 'vitest';
import { pickRoundRobinHost, isFairness } from './round-robin.js';

const ago = (mins: number) => Date.now() - mins * 60_000;

describe('pickRoundRobinHost', () => {
  it('a single free candidate wins under every rule', () => {
    for (const fairness of ['least_loaded', 'least_recently_assigned', 'strict_rotation', 'random'] as const) {
      expect(pickRoundRobinHost({ fairness, candidates: ['a'] })).toBe('a');
    }
  });

  it('returns null when nobody is free', () => {
    expect(pickRoundRobinHost({ fairness: 'least_loaded', candidates: [] })).toBeNull();
  });

  it('least_loaded takes the lightest calendar', () => {
    expect(
      pickRoundRobinHost({
        fairness: 'least_loaded',
        candidates: ['a', 'b', 'c'],
        loadByHost: { a: 5, b: 1, c: 3 },
      }),
    ).toBe('b');
  });

  it('least_loaded breaks a tie on who waited longest — not on row order', () => {
    // Without the tie-break this always returns 'a' and one person eats the
    // whole team's bookings.
    expect(
      pickRoundRobinHost({
        fairness: 'least_loaded',
        candidates: ['a', 'b'],
        loadByHost: { a: 2, b: 2 },
        lastAssignedAt: { a: ago(5), b: ago(500) },
      }),
    ).toBe('b');
  });

  it('least_recently_assigned puts never-assigned first', () => {
    expect(
      pickRoundRobinHost({
        fairness: 'least_recently_assigned',
        candidates: ['a', 'b'],
        lastAssignedAt: { a: ago(1000) }, // b has never been assigned
      }),
    ).toBe('b');
  });

  it('strict_rotation takes the next host after the last booked one', () => {
    expect(
      pickRoundRobinHost({
        fairness: 'strict_rotation',
        candidates: ['a', 'b', 'c'],
        rotationOrder: ['a', 'b', 'c'],
        lastBookedHost: 'a',
      }),
    ).toBe('b');
  });

  it('strict_rotation wraps around the end of the order', () => {
    expect(
      pickRoundRobinHost({
        fairness: 'strict_rotation',
        candidates: ['a', 'b', 'c'],
        rotationOrder: ['a', 'b', 'c'],
        lastBookedHost: 'c',
      }),
    ).toBe('a');
  });

  it('strict_rotation skips whoever is busy at the slot', () => {
    // b is next in the rotation but not free — the booking must not vanish.
    expect(
      pickRoundRobinHost({
        fairness: 'strict_rotation',
        candidates: ['a', 'c'],
        rotationOrder: ['a', 'b', 'c'],
        lastBookedHost: 'a',
      }),
    ).toBe('c');
  });

  it('strict_rotation with no known order falls back to least-recently-assigned', () => {
    expect(
      pickRoundRobinHost({
        fairness: 'strict_rotation',
        candidates: ['a', 'b'],
        lastAssignedAt: { a: ago(10), b: ago(900) },
      }),
    ).toBe('b');
  });

  it('random only ever returns a candidate, including at the boundary', () => {
    expect(
      pickRoundRobinHost({ fairness: 'random', candidates: ['a', 'b', 'c'], random: () => 0 }),
    ).toBe('a');
    // A random() of exactly 1 must not index past the end.
    expect(
      pickRoundRobinHost({ fairness: 'random', candidates: ['a', 'b', 'c'], random: () => 1 }),
    ).toBe('c');
  });
});

describe('isFairness', () => {
  it('accepts the four rules and rejects anything else', () => {
    expect(isFairness('least_loaded')).toBe(true);
    expect(isFairness('strict_rotation')).toBe(true);
    expect(isFairness('whatever')).toBe(false);
    expect(isFairness(null)).toBe(false);
  });
});
