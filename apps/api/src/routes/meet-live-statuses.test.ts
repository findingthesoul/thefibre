// Every "is this time taken" question in Meet must ask the same thing.
//
// Ten separate queries decide whether a slot is free or a seat is full, and
// until 2026-10-06 each one carried its own `.eq('status', 'confirmed')`. A
// booking request awaiting the host's answer matched none of them, so it held
// nothing: a real invitee's request waited unanswered while another meeting
// was booked over it.
//
// The fix was one named constant. What this file protects is that it STAYS
// one: the eleventh availability query, written months from now by somebody
// who greps for how the others do it, must not reintroduce the literal.
//
// It reads the source rather than importing the module: routes/meet.ts
// reaches for Stripe, Supabase and the mail client at import time, and a
// guard that needs a configured environment is a guard that gets skipped.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const here = new URL('.', import.meta.url).pathname;
const source = readFileSync(join(here, 'meet.ts'), 'utf8');

describe('LIVE_BOOKING_STATUSES is the only answer to "is this booking live"', () => {
  it('no booking query filters on confirmed alone', () => {
    // Report what was FOUND, with line numbers — a test that merely asserts
    // a count tells whoever broke it nothing about where.
    const offenders = source
      .split('\n')
      .map((line, i) => ({ n: i + 1, line: line.trim() }))
      .filter((l) => /\.eq\(\s*'status'\s*,\s*'confirmed'\s*\)/.test(l.line));
    expect(
      offenders.map((o) => `meet.ts:${o.n}  ${o.line}`),
      'a booking query went back to confirmed-only; use LIVE_BOOKING_STATUSES so a pending request keeps holding its slot',
    ).toEqual([]);
  });

  it('holds pending_approval, and does not hold a dead booking', () => {
    const m = source.match(/const LIVE_BOOKING_STATUSES = \[([^\]]+)\]/);
    expect(m, 'LIVE_BOOKING_STATUSES is gone — the rule it names has moved somewhere unchecked').toBeTruthy();
    const values = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
    expect(values).toContain('confirmed');
    expect(values).toContain('pending_approval');
    // Cancelled has never blocked a slot and must not start. `rescheduled`
    // is a historical terminal status, equally dead. And `expired` is the
    // whole point of the expiry sweep: a request that ran out of time GIVES
    // THE SLOT BACK, and it does so by not being named here. If it ever
    // appears in this list, an unanswered request blocks a host's calendar
    // forever and nothing else in the system would notice.
    expect(values).not.toContain('cancelled');
    expect(values).not.toContain('rescheduled');
    expect(values).not.toContain('expired');
  });

  it('every status it names is one the database allows', () => {
    // The two sides of this: a value here that no CHECK constraint permits
    // would filter on something that can never exist, and the queries would
    // quietly go back to confirmed-only behaviour while looking fixed.
    const m = source.match(/const LIVE_BOOKING_STATUSES = \[([^\]]+)\]/);
    const values = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);

    const migrations = join(here, '..', '..', '..', '..', 'supabase', 'migrations');
    const checks = readdirSync(migrations)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => readFileSync(join(migrations, f), 'utf8'))
      .flatMap((sql) => [
        ...sql.matchAll(/meet_booking_status_check\s*\n?\s*check\s*\(status in \(([^)]+)\)\)/gi),
      ]);
    expect(checks.length, 'no meet_booking status CHECK found in the migrations').toBeGreaterThan(0);
    // The LAST one wins: the constraint is dropped and re-added, so the
    // newest migration is the shape the database actually has.
    const allowed = [...checks[checks.length - 1][1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
    for (const v of values) {
      expect(allowed, `the code holds slots for '${v}', which no booking can be in`).toContain(v);
    }
  });
});
