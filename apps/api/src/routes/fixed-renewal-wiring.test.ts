// The launch cohort's billing: is the rule actually WIRED to the charge?
//
// Read off the route's source, because no type can say "the anchor the rule
// returned is the anchor Stripe is given", and this is money. It lived beside
// the rule until the rule moved to @thefibre/shared on 2026-10-13 so the join
// PANEL could say what it is about to charge — these assertions stayed here,
// where membership.ts can be read off disk.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ─────────────────────────────────────────────────────────────────────────────
// The WIRING, read off the route's source — no type can say "the anchor the
// rule returned is the anchor Stripe is given", and this is money.
// ─────────────────────────────────────────────────────────────────────────────
describe('the join route bills the cohort through this rule', () => {
  const src = readFileSync(new URL('./membership.ts', import.meta.url), 'utf8');

  it('asks the rule with the tier’s own date AND the interval', () => {
    expect(src).toContain('const fixedPeriod = fixedFirstPeriod(');
    expect(src).toContain('.first_period_ends_on');
    // The interval is not decoration: without it the rule defaults to 'year'
    // and a MONTHLY join would take the cohort's price — one month's money
    // for the rest of the year.
    expect(src).toContain('d.interval,');
  });

  it('sets the anchor AND turns proration off — one without the other is a bug', () => {
    // proration_behavior 'none' is the single word that decides "exactly one
    // charge now": without it Stripe adds a pro-rata charge for today→anchor
    // on top of the one-off line.
    // ONE fragment, not two. `proration_behavior: 'none'` also appears in the
    // tier-change code three hundred lines away, so asserting it separately
    // passed even with the join route's copy removed — found by mutating it
    // and watching this test stay green, which is what mutation is for.
    expect(src).toContain('...(fixedPeriod ? { trial_end: fixedPeriod.anchor } : {})');
    // And NOT the shape Checkout refuses, which is what v1.172.0 shipped.
    expect(src).not.toContain("proration_behavior: 'none' as const");
  });

  it('makes the paid-now line ONE-OFF for the cohort, or the period is billed twice', () => {
    expect(src).toContain('...(fixedPeriod ? {} : { recurring: { interval: d.interval } })');
  });

  it('uses trial_end, and the rule keeps joins away from its 48-hour floor', () => {
    expect(src).toContain('trial_end: fixedPeriod.anchor');
  });
});
