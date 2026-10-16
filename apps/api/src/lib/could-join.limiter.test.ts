// The could-join walk builds its rows concurrently, so the payment-route
// lookups behind them go through a limiter: a big community must not turn one
// page load into a hundred simultaneous reads.

import { describe, expect, it } from 'vitest';
import { limiter, ROUTE_LOOKUPS_AT_ONCE } from './could-join.js';

const tick = () => new Promise((r) => setTimeout(r, 1));

describe('limiter', () => {
  it('never runs more than n at once, and runs every task', async () => {
    const run = limiter(3);
    let active = 0;
    let peak = 0;
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        run(async () => {
          active++;
          peak = Math.max(peak, active);
          await tick();
          active--;
          return i;
        }),
      ),
    );
    expect(peak).toBe(3);
    expect(results).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it('a failed task rejects its own caller and frees its slot', async () => {
    const run = limiter(1);
    const failed = run(async () => {
      throw new Error('route read failed');
    });
    const after = run(async () => 'next');
    await expect(failed).rejects.toThrow('route read failed');
    await expect(after).resolves.toBe('next');
  });

  it('the walk allows eight at a time', () => {
    expect(ROUTE_LOOKUPS_AT_ONCE).toBe(8);
  });
});
