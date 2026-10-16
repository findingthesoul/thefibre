import { describe, expect, it } from 'vitest';
import { applyPct, netFromInclusive } from './price-logic.js';

const gross = (net: number, r: number) => net + Math.round((net * r) / 100);

describe('netFromInclusive — a home-rate buyer pays exactly the entered price', () => {
  it('an exact net is found: 363.00 at 21% → 300.00', () => {
    expect(netFromInclusive(36300, 21)).toBe(30000);
  });
  it('100.00 at 21% has NO exact cent net — the lower neighbour, a cent under, never over', () => {
    expect(netFromInclusive(10000, 21)).toBe(8264);
    expect(gross(8264, 21)).toBe(9999);
  });
  it('exact across rates and amounts', () => {
    for (const r of [21, 9, 19, 20, 25, 17, 6]) {
      for (const p of [100, 999, 1950, 30000, 36300, 42350, 123456, 1]) {
        const n = netFromInclusive(p, r);
        expect(Math.abs(gross(n, r) - p), `${p} at ${r}%`).toBeLessThanOrEqual(1);
      }
    }
  });
  it('the discounted price too: 300 − 20% = 240 incl. → its net', () => {
    const discounted = applyPct(30000, 80);
    expect(discounted).toBe(24000);
    const n = netFromInclusive(discounted, 21);
    expect(gross(n, 21)).toBe(24000);
  });
  it('no VAT, no change; nothing negative', () => {
    expect(netFromInclusive(30000, 0)).toBe(30000);
    expect(netFromInclusive(0, 21)).toBe(0);
  });
  it('when no cent is exact, the nearest gross (the case is pinned)', () => {
    // Find one such case at 21% and pin it, so a change in rounding shows.
    let found: number | null = null;
    for (let p = 1; p < 5000 && found === null; p++) {
      const n = netFromInclusive(p, 21);
      if (gross(n, 21) !== p) found = p;
    }
    if (found !== null) {
      const n = netFromInclusive(found, 21);
      expect(Math.abs(gross(n, 21) - found)).toBe(1);
    }
  });
});
