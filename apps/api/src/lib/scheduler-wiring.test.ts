// Every scheduled tick goes through the lease — read from server.ts itself.
//
// scheduler-lease.int.test.ts proves the lease: two holders, one name, one
// winner. What it cannot prove is that a job is BEHIND it. The weekly VAT
// probe ran bare for five days after the lease landed (2026-09-26 →
// 2026-10-01), fired from the interval callback beside the leased ones, and
// nothing could have caught it: server.ts starts a listener on import, so it
// has no unit test, and a job outside the lease behaves identically until two
// processes are up at once — which is every blue-green deploy.
//
// So this reads the wiring as text. Crude on purpose: the rule is "one
// function fires the jobs, and it fires nothing bare".
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('../server.ts', import.meta.url)), 'utf8');

/** The body of runAllSchedulers, comments and blank lines removed. */
function schedulerStatements(): string[] {
  const start = source.indexOf('function runAllSchedulers() {');
  expect(start, 'runAllSchedulers exists').toBeGreaterThan(-1);
  const end = source.indexOf('\n}\n', start);
  expect(end).toBeGreaterThan(start);
  return source
    .slice(start + 'function runAllSchedulers() {'.length, end)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'));
}

describe('scheduler wiring (server.ts)', () => {
  it('runAllSchedulers fires every job through leased(), and nothing else', () => {
    const statements = schedulerStatements();
    // Seven jobs today. Fewer than five means the reader broke, not the file.
    expect(statements.length).toBeGreaterThanOrEqual(5);
    for (const s of statements) expect(s, s).toMatch(/^leased\('[a-z-]+', .+, '[^']+'\);$/);
  });

  it('gives every job its own lease name', () => {
    const names = schedulerStatements().map((s) => /^leased\('([a-z-]+)'/.exec(s)![1]!);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('vat-sync');
  });

  it('has one interval, and it runs runAllSchedulers and nothing beside it', () => {
    const intervals = source.match(/setInterval\([^\n]*/g) ?? [];
    expect(intervals).toEqual(['setInterval(runAllSchedulers, SCHEDULER_INTERVAL_MS);']);
  });

  it('the VAT probe is named in exactly two places: its import and its lease', () => {
    const lines = source.split('\n').filter((l) => l.includes('maybeSyncVatRates'));
    expect(lines.length).toBe(2);
    expect(lines.some((l) => l.startsWith('import '))).toBe(true);
    expect(lines.some((l) => l.trim().startsWith("leased('vat-sync', maybeSyncVatRates"))).toBe(true);
  });
});
