import { describe, expect, it } from 'vitest';
import { invalidRule, refundFor, type RefundRule } from './refund-rules.js';

// The one refund arithmetic (lib/refund-rules.ts). Every boundary is asserted
// on both sides: a refund rule is a promise a participant reads, and an
// off-by-a-day is the difference between "full refund" and "half".

const START = new Date('2026-12-01T10:00:00Z');
const DAY = 86_400_000;
const before = (days: number, extraMs = 0) => new Date(START.getTime() - days * DAY + extraMs);

// "Full until 30 days before, half until 7 days before, nothing after."
const RULE: RefundRule = { steps: [{ until_days_before: 7, refund_pct: 50 }, { until_days_before: 30, refund_pct: 100 }] };

describe('refundFor — the steps', () => {
  it('more than 30 days before: 100%', () => {
    const q = refundFor(RULE, 36300, START, before(45));
    expect(q).toMatchObject({ pct: 100, refund_cents: 36300, fee_cents: 0, reason: 'step' });
    expect(q.step).toEqual({ until_days_before: 30, refund_pct: 100 });
    // The preview can say until when.
    expect(q.changes_at?.toISOString()).toBe(before(30).toISOString());
    // …and what comes after: "then 50%".
    expect(q.next_pct).toBe(50);
  });

  it('EXACTLY 30 days before still counts as 30: 100%; a millisecond later: 50%', () => {
    expect(refundFor(RULE, 36300, START, before(30)).pct).toBe(100);
    expect(refundFor(RULE, 36300, START, before(30, 1)).pct).toBe(50);
  });

  it('between 30 and 7 days: 50%, changing at 7 days before', () => {
    const q = refundFor(RULE, 36300, START, before(10));
    expect(q).toMatchObject({ pct: 50, refund_cents: 18150, reason: 'step' });
    expect(q.changes_at?.toISOString()).toBe(before(7).toISOString());
    // "nothing back after <date>": the last step's next is 0, not null.
    expect(q.next_pct).toBe(0);
  });

  it('EXACTLY 7 days before: 50%; a millisecond later: nothing', () => {
    expect(refundFor(RULE, 36300, START, before(7)).pct).toBe(50);
    const q = refundFor(RULE, 36300, START, before(7, 1));
    expect(q).toMatchObject({ pct: 0, refund_cents: 0, reason: 'after_last_step', changes_at: null, next_pct: null });
  });

  it('once it has started: nothing — at the start itself too', () => {
    expect(refundFor(RULE, 36300, START, START)).toMatchObject({ pct: 0, refund_cents: 0, reason: 'started' });
    expect(refundFor(RULE, 36300, START, before(-1))).toMatchObject({ reason: 'started' });
  });

  it('steps may be stored in any order', () => {
    const shuffled: RefundRule = { steps: [{ until_days_before: 30, refund_pct: 100 }, { until_days_before: 7, refund_pct: 50 }] };
    for (const d of [45, 30, 10, 7, 3]) expect(refundFor(shuffled, 1000, START, before(d)).pct).toBe(refundFor(RULE, 1000, START, before(d)).pct);
  });

  it('a step at 0 days covers right up to the start', () => {
    const rule: RefundRule = { steps: [{ until_days_before: 0, refund_pct: 25 }] };
    expect(refundFor(rule, 1000, START, before(0, -1)).pct).toBe(25);
    expect(refundFor(rule, 1000, START, START).pct).toBe(0);
  });
});

describe('refundFor — money', () => {
  it('a percentage of what was PAID (after a code or member price), rounded half up to whole cents', () => {
    // €49.99 paid, 50% → 2499.5 → 2500.
    expect(refundFor(RULE, 4999, START, before(10)).refund_cents).toBe(2500);
  });

  it('the optional fixed fee is kept from any refund — never more than the refund itself', () => {
    const withFee: RefundRule = { ...RULE, fee_cents: 1000 };
    expect(refundFor(withFee, 36300, START, before(45))).toMatchObject({ pct: 100, fee_cents: 1000, refund_cents: 35300 });
    expect(refundFor(withFee, 36300, START, before(10))).toMatchObject({ pct: 50, fee_cents: 1000, refund_cents: 17150 });
    // A €5 place under a €10 fee gets €0 back, not a negative refund.
    expect(refundFor(withFee, 500, START, before(45))).toMatchObject({ fee_cents: 500, refund_cents: 0 });
    // No refund, no fee to speak of.
    expect(refundFor(withFee, 36300, START, START)).toMatchObject({ fee_cents: 0, refund_cents: 0 });
  });

  it('the fee defaults to 0 when the rule has none', () => {
    expect(refundFor(RULE, 36300, START, before(45)).fee_cents).toBe(0);
  });
});

describe('refundFor — the edges', () => {
  it('no rule at all: today’s behaviour, a full refund', () => {
    expect(refundFor(null, 36300, START, START)).toMatchObject({ pct: 100, refund_cents: 36300, reason: 'no_rule' });
    expect(refundFor({ steps: [] }, 36300, START, START)).toMatchObject({ reason: 'no_rule', refund_cents: 36300 });
  });

  it('no start date: the most generous step (nothing to count back from)', () => {
    expect(refundFor(RULE, 36300, null, before(1))).toMatchObject({ pct: 100, reason: 'no_start' });
  });

  it('nothing paid: nothing to refund', () => {
    expect(refundFor(RULE, 0, START, before(45))).toMatchObject({ refund_cents: 0, reason: 'nothing_paid' });
  });
});

describe('invalidRule — what may be saved', () => {
  it('accepts a normal rule, with or without a fee', () => {
    expect(invalidRule(RULE)).toBeNull();
    expect(invalidRule({ ...RULE, fee_cents: 1000 })).toBeNull();
    expect(invalidRule({ steps: [] })).toBeNull();
  });
  it('refuses nonsense', () => {
    expect(invalidRule({ steps: [{ until_days_before: -1, refund_pct: 50 }] })).toMatch(/days/);
    expect(invalidRule({ steps: [{ until_days_before: 1.5, refund_pct: 50 }] })).toMatch(/days/);
    expect(invalidRule({ steps: [{ until_days_before: 7, refund_pct: 120 }] })).toMatch(/percentage/);
    expect(invalidRule({ steps: [{ until_days_before: 7, refund_pct: 50 }, { until_days_before: 7, refund_pct: 25 }] })).toMatch(/same day/);
    expect(invalidRule({ ...RULE, fee_cents: -5 })).toMatch(/fee/);
    expect(invalidRule({ steps: Array.from({ length: 11 }, (_, i) => ({ until_days_before: i, refund_pct: 10 })) })).toMatch(/10 steps/);
  });
});
