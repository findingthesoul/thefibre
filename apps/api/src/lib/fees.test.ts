// The platform-fee math, extracted pure (v0.54.0) so it can be locked:
// floor(gross × pct), capped after the pct. Free plan today: 2% capped at
// €2; Pro/Org waived via pct 0. The null-vs-0 cap distinction matters —
// cap 0 means "fee is capped at nothing", cap null means "no cap at all";
// normalizing one into the other would change real fees.

import { describe, expect, it } from 'vitest';
import { computeFeeCents } from './fees.js';

describe('computeFeeCents', () => {
  it('the Free-plan default: 2% capped at €2', () => {
    expect(computeFeeCents(1000, 0.02, 200)).toBe(20); // €10 → €0.20
    expect(computeFeeCents(9999, 0.02, 200)).toBe(199); // floor, just under cap
    expect(computeFeeCents(10000, 0.02, 200)).toBe(200); // exactly at cap
    expect(computeFeeCents(100000, 0.02, 200)).toBe(200); // €1000 → capped €2
  });

  it('floors to whole cents (never rounds a fee up)', () => {
    expect(computeFeeCents(99, 0.02, 200)).toBe(1); // 1.98 → 1
    expect(computeFeeCents(49, 0.02, 200)).toBe(0); // 0.98 → 0
  });

  it('cap null = no cap; cap 0 = capped at zero — NOT interchangeable', () => {
    expect(computeFeeCents(100000, 0.02, null)).toBe(2000);
    expect(computeFeeCents(100000, 0.02, 0)).toBe(0);
  });

  it('pct 0 waives the fee regardless of cap', () => {
    expect(computeFeeCents(100000, 0, null)).toBe(0);
    expect(computeFeeCents(100000, 0, 200)).toBe(0);
  });
});
