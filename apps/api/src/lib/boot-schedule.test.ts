import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bootDelay, FIRST_RUN_DELAY_MS, STAGGER_MS } from './boot-schedule.js';

// A fresh machine takes traffic ~9s after exec. Background work that starts in
// the first half-minute competes with the first person to click — the 13.6s
// first request on staging (2026-10-14). These pin that it cannot drift back.
describe('background work waits until the machine has settled', () => {
  it('nothing starts inside the first minute', () => {
    expect(FIRST_RUN_DELAY_MS).toBeGreaterThanOrEqual(60_000);
    expect(bootDelay(0)).toBe(FIRST_RUN_DELAY_MS);
  });

  it('jobs start one at a time, not as a burst', () => {
    expect(STAGGER_MS).toBeGreaterThan(0);
    const delays = Array.from({ length: 10 }, (_, i) => bootDelay(i));
    expect(new Set(delays).size).toBe(delays.length);
  });
});

// The constants only matter if server.ts uses them. A refactor that put a
// literal `setTimeout(runAllSchedulers, 20_000)` back would leave every test
// above green, so this reads the one file that schedules.
describe('server.ts schedules through bootDelay', () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'server.ts'),
    'utf8',
  );

  it('has no background job started on a literal short timer', () => {
    // Any setTimeout/setInterval whose delay is a bare number literal.
    const literal = source.match(/set(?:Timeout|Interval)\(.*,\s*[\d_]+\s*\)/g) ?? [];
    expect(literal).toEqual([]);
  });

  it('uses bootDelay for the first runs', () => {
    expect(source).toContain('bootDelay(');
  });
});
