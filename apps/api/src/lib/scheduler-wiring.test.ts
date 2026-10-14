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
// table lists the jobs, and none of them runs bare".
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('../server.ts', import.meta.url)), 'utf8');

/** The entries of the JOBS table, comments and blank lines removed.
 *
 *  Since 2026-10-14 the jobs are a table rather than a function body, so each
 *  can start at its own staggered delay (lib/boot-schedule.ts). The rule is
 *  unchanged: one place lists the jobs, and every one of them runs through
 *  leased() — the forEach below the table is the only caller. */
function jobEntries(): string[] {
  const head = 'const JOBS: [string, () => Promise<unknown>, string][] = [';
  const start = source.indexOf(head);
  expect(start, 'the JOBS table exists').toBeGreaterThan(-1);
  const end = source.indexOf('\n];\n', start);
  expect(end).toBeGreaterThan(start);
  return source
    .slice(start + head.length, end)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'));
}

describe('scheduler wiring (server.ts)', () => {
  it('every job is a [lease name, run, label] entry, and nothing else is in the table', () => {
    const entries = jobEntries();
    // Nine jobs today. Fewer than five means the reader broke, not the file.
    expect(entries.length).toBeGreaterThanOrEqual(5);
    for (const e of entries) expect(e, e).toMatch(/^\['[a-z-]+', .+, '[^']+'\],$/);
  });

  it('runs every entry through leased(), and nothing bare beside it', () => {
    expect(source).toContain('const tick = () => leased(name, run, label);');
  });

  it('gives every job its own lease name', () => {
    const names = jobEntries().map((e) => /^\['([a-z-]+)'/.exec(e)![1]!);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('vat-sync');
  });

  it('has one interval, and it runs the leased tick and nothing beside it', () => {
    const intervals = source.match(/setInterval\([^\n]*/g) ?? [];
    expect(intervals).toEqual(['setInterval(tick, SCHEDULER_INTERVAL_MS);']);
  });

  it('the VAT probe is named in exactly two places: its import and its lease', () => {
    const lines = source.split('\n').filter((l) => l.includes('maybeSyncVatRates'));
    expect(lines.length).toBe(2);
    expect(lines.some((l) => l.startsWith('import '))).toBe(true);
    expect(lines.some((l) => l.trim().startsWith("['vat-sync', maybeSyncVatRates"))).toBe(true);
  });
});
