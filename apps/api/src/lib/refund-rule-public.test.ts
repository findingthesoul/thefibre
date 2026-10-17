// The two sides agree (refund rules, slice 4): every "until <date>" the enrol
// form says (@thefibre/shared/refund-rule, from the public payload's
// refund_rule) is
//   · NEVER A PROMISE TOO MANY: still that step's percentage by refundFor —
//     the arithmetic the refund itself runs — at the very end of that day in
//     the thread's zone;
//   · AT MOST ONE DAY EARLY: by the end of the next day the step has ended.
//     (A boundary at 19:30 on 1 Nov is said "until 31 Oct": the last WHOLE
//     day, an under-promise of hours, by design.)
import { describe, expect, it, vi } from 'vitest';
import { lastWholeDayBefore, refundRuleLines } from '@thefibre/shared/refund-rule';
import { refundFor, type RefundRule } from './refund-rules.js';
import { zonedTimeToUtc } from './availability/timezone.js';

vi.mock('../db.js', () => ({ adminClient: {} }));
const { publicRuleFrom, startInstant } = await import('./refund-quote.js');

const RULE: RefundRule = {
  steps: [
    { until_days_before: 30, refund_pct: 100 },
    { until_days_before: 14, refund_pct: 50 },
    { until_days_before: 0, refund_pct: 25 },
  ],
  fee_cents: 500,
};

/** The last millisecond of a UTC-midnight date, in `tz`. */
function endOfDay(utcMidnightIso: string, tz: string): Date {
  const d = new Date(utcMidnightIso);
  const next = zonedTimeToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate() + 1, 0, 0, tz);
  return new Date(next.getTime() - 1);
}
function endOfNextDay(utcMidnightIso: string, tz: string): Date {
  const d = new Date(utcMidnightIso);
  d.setUTCDate(d.getUTCDate() + 1);
  return endOfDay(d.toISOString(), tz);
}

const CASES = [
  // A thread with no key moment: its first day, midnight in its zone.
  { name: 'a first day, Amsterdam (winter)', start: () => startInstant('2026-12-01', 'Europe/Amsterdam')!, tz: 'Europe/Amsterdam' },
  { name: 'a first day, Amsterdam (summer)', start: () => startInstant('2027-07-01', 'Europe/Amsterdam')!, tz: 'Europe/Amsterdam' },
  { name: 'a first day, New York', start: () => startInstant('2026-12-01', 'America/New_York')!, tz: 'America/New_York' },
  // A key moment: an evening session.
  { name: 'a key moment at 19:30 Amsterdam', start: () => zonedTimeToUtc(2026, 12, 1, 19, 30, 'Europe/Amsterdam'), tz: 'Europe/Amsterdam' },
  { name: 'a key moment at 07:00 Tokyo', start: () => zonedTimeToUtc(2026, 12, 1, 7, 0, 'Asia/Tokyo'), tz: 'Asia/Tokyo' },
];

describe('the enrol form’s "until <date>" and refundFor agree', () => {
  for (const c of CASES) {
    it(c.name, () => {
      const start = c.start();
      const pub = publicRuleFrom(RULE, start)!;
      const pcts = pub.steps.map((s) => s.refund_pct);
      pub.steps.forEach((s, i) => {
        const day = lastWholeDayBefore(s.until!, c.tz)!;
        // The whole of the promised day: still this step.
        expect(refundFor(RULE, 10_000, start, endOfDay(day, c.tz)).pct, `${s.refund_pct}% through ${day}`).toBe(s.refund_pct);
        // By the end of the next day: the step has ended.
        const after = refundFor(RULE, 10_000, start, endOfNextDay(day, c.tz));
        expect(after.pct, `by the end of the day after ${day}`).toBeLessThanOrEqual(pcts[i + 1] ?? 0);
      });
    });
  }
});

describe('what the page says', () => {
  const start = startInstant('2026-12-01', 'Europe/Amsterdam')!;
  it('one line per step, then "after", then the fee; dates as the card says them', () => {
    expect(refundRuleLines(publicRuleFrom(RULE, start), { timeZone: 'Europe/Amsterdam', intlLocale: 'en-GB', currency: 'EUR' })).toEqual([
      { kind: 'until', pct: 100, date: '31 Oct 2026' },
      { kind: 'until', pct: 50, date: '16 Nov 2026' },
      { kind: 'until', pct: 25, date: '30 Nov 2026' },
      { kind: 'after', pct: 0 },
      { kind: 'fee', fee_cents: 500, fee: '€5.00' },
    ]);
  });
  it('dates and the fee in the reader’s language: nl and de write a decimal comma', () => {
    const say = (intlLocale: string) => {
      const lines = refundRuleLines(publicRuleFrom(RULE, start), { timeZone: 'Europe/Amsterdam', intlLocale, currency: 'EUR' })!;
      return lines.map((l) => (l.kind === 'until' ? l.date : l.kind === 'fee' ? l.fee : l.kind)).map((x) => x.replace(/\u00a0/g, ' '));
    };
    expect(say('nl-NL')).toEqual(['31 okt 2026', '16 nov 2026', '30 nov 2026', 'after', '€ 5,00']);
    expect(say('de-DE')).toEqual(['31. Okt. 2026', '16. Nov. 2026', '30. Nov. 2026', 'after', '5,00 €']);
  });
  it('nothing to say: no rule, an empty rule, or no start to count from', () => {
    expect(publicRuleFrom(null, start)).toBeNull();
    expect(publicRuleFrom({ steps: [] }, start)).toBeNull();
    expect(refundRuleLines(publicRuleFrom(RULE, null), { timeZone: 'Europe/Amsterdam', intlLocale: 'en-GB' })).toBeNull();
  });
  it('no fee line when no step gives anything back', () => {
    const lines = refundRuleLines(publicRuleFrom({ steps: [{ until_days_before: 7, refund_pct: 0 }], fee_cents: 500 }, start), { timeZone: 'Europe/Amsterdam', intlLocale: 'en-GB' });
    expect(lines?.some((l) => l.kind === 'fee')).toBe(false);
  });
});
