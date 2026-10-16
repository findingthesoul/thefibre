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
describe('the join route bills the first period through these rules', () => {
  const src = readFileSync(new URL('./membership.ts', import.meta.url), 'utf8');

  it('asks the cohort rule with the tier\u2019s own date AND the interval', () => {
    expect(src).toContain('const fixedPeriod = fixedFirstPeriod(');
    expect(src).toContain('.first_period_ends_on');
    // The interval is not decoration: without it the rule defaults to 'year'
    // and a MONTHLY join would take the cohort's price — one month's money
    // for the rest of the year.
    expect(src).toContain('d.interval,');
  });

  // TWO reasons now produce one shape: the cohort's fixed date, and a
  // discount code, which applies to the first period only. Both pay the first
  // period as a one-off line and start the full-price subscription later.
  it('starts billing at the cohort\u2019s anchor, or a period out when a code applied', () => {
    expect(src).toContain(
      'const startsBilling = fixedPeriod ? fixedPeriod.anchor : discounted ? anniversary : null;',
    );
    expect(src).toContain('const discounted = amount !== listAmount;');
  });

  it('sets trial_end from that, and not the shape Checkout refuses', () => {
    // trial_end, NOT billing_cycle_anchor: Checkout refuses
    // `proration_behavior: 'none'` beside a one-time price outright, and
    // without that word Stripe prorates the stub period and adds it — 365.35
    // instead of 300.00, measured. A trial has no proration to argue with.
    // Lifted into createSubscriptionCheckout (2026-10-16); the join passes it.
    expect(src).toContain('...(p.startsBilling ? { trial_end: p.startsBilling } : {})');
    expect(src).toContain('      startsBilling,\n');
    expect(src).not.toContain("proration_behavior: 'none' as const");
  });

  it('makes the paid-now line ONE-OFF whenever billing starts later', () => {
    // Left recurring, the same period is billed twice — once now and once at
    // the anchor.
    // subscriptionLines: the paid-now line recurs only when NOT split (its
    // behaviour is pinned in subscription-lines.test.ts); the join passes split.
    expect(src).toContain('line(main.name, main.nowCents, !split)');
    expect(src).toContain('        split,\n');
  });

  // ⚠️ THE DISCOUNT MUST NOT RECUR. The subscription line carries the LIST
  // price; if it carried `amount`, a 50% code would halve somebody's
  // membership for ever and nothing would ever tell the community.
  it('renews at the FULL price, never at the discounted one', () => {
    // The recurring line is built from listCents, and the join hands it the
    // undiscounted list price.
    expect(src).toContain('line(main.name, main.listCents, true)');
    expect(src).toContain('nowCents: amount, listCents: listAmount');
  });

  // A 100% code charges nothing today; Stripe refuses a zero-amount line, and
  // without a card the first renewal would have nothing to charge.
  it('omits the paid-now line at zero, and still takes a card', () => {
    expect(src).toContain('main && main.nowCents > 0');
    expect(src).toContain('collectCardAlways: amount === 0');
    expect(src).toContain("payment_method_collection: 'always' as const");
  });

  // WHEN the use is taken, and that it is taken only once, moved to
  // validate-code-limit.test.ts — it grew a dedup and a billing_reason guard
  // and belongs beside the other "a code is spent once" cases rather than
  // half-stated here. This file is about the billing SHAPE.
});
