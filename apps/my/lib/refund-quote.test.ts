import { describe, expect, it } from 'vitest';
import { lastWholeDayBefore, refundQuoteLines, type RefundQuote } from './refund-quote';

const AMS = 'Europe/Amsterdam';
const q = (over: Partial<RefundQuote> = {}): RefundQuote => ({
  pct: 50,
  fee_cents: 0,
  refund_cents: 4000,
  reason: 'step',
  currency: 'EUR',
  paid_cents: 8000,
  // 23:30 on 24 Nov in Amsterdam: the rate changes late on the 24th, so the
  // last WHOLE day at this rate is the 23rd.
  changes_at: '2026-11-24T22:30:00Z',
  rule_source: 'thread',
  counted_at: '2026-10-17T10:00:00Z',
  ...over,
});

describe('the refund quote, said', () => {
  it('a step that will change: amount, percentage, and until when — in the thread’s zone', () => {
    expect(refundQuoteLines(q(), { locale: 'en', tz: AMS })).toEqual(['If you cancel now: €40.00 back (50% until 23 Nov 2026).']);
    // 23:30 UTC is already 00:30 on 25 Nov in Amsterdam: the 24th is whole.
    expect(refundQuoteLines(q({ changes_at: '2026-11-24T23:30:00Z' }), { locale: 'en', tz: AMS })[0]).toContain('until 24 Nov 2026');
  });

  it('in Dutch, with Dutch money', () => {
    expect(refundQuoteLines(q(), { locale: 'nl', tz: AMS })).toEqual(['Als je nu annuleert: €\u00a040,00 terug (50% tot en met 23 nov 2026).']);
  });

  it('a step that does not change later: no date', () => {
    expect(refundQuoteLines(q({ changes_at: null, reason: 'no_start', pct: 100, refund_cents: 8000 }), { locale: 'en', tz: AMS })).toEqual([
      'If you cancel now: €80.00 back (100%).',
    ]);
  });

  it('names a fixed fee that is kept', () => {
    expect(refundQuoteLines(q({ fee_cents: 500, refund_cents: 3500 }), { locale: 'en', tz: AMS })).toEqual([
      'If you cancel now: €35.00 back (50% until 23 Nov 2026).',
      'A fixed fee of €5.00 is kept.',
    ]);
  });

  it('nothing back: after the last step, once started, or when the fee takes it all', () => {
    for (const over of [{ reason: 'after_last_step' as const, pct: 0 }, { reason: 'started' as const, pct: 0 }, { pct: 5, fee_cents: 500 }]) {
      expect(refundQuoteLines(q({ ...over, refund_cents: 0, changes_at: null }), { locale: 'en', tz: AMS })).toEqual([
        'If you cancel now: nothing back, by the organiser’s refund rule.',
      ]);
    }
  });

  it('a pending request: what the rule gives at the date it was asked', () => {
    expect(refundQuoteLines(q(), { locale: 'en', tz: AMS, pending: { created_at: '2026-10-17T10:00:00Z' } })).toEqual([
      'Asked on 17 Oct 2026: €40.00 back by the rule.',
    ]);
    expect(refundQuoteLines(q({ refund_cents: 0 }), { locale: 'de', tz: AMS, pending: { created_at: '2026-10-17T10:00:00Z' } })).toEqual([
      'Angefragt am 17. Okt. 2026: nichts zurück nach der Regel.',
    ]);
  });

  it('says nothing when nothing was paid or no rule applies', () => {
    expect(refundQuoteLines(null, { locale: 'en', tz: AMS })).toEqual([]);
    expect(refundQuoteLines(undefined, { locale: 'en', tz: AMS })).toEqual([]);
    expect(refundQuoteLines(q({ reason: 'no_rule', pct: 100, refund_cents: 8000 }), { locale: 'en', tz: AMS })).toEqual([]);
  });

  it('with next_pct: "then X%" when something follows, "nothing back after" when it is 0', () => {
    expect(refundQuoteLines(q({ next_pct: 25 }), { locale: 'en', tz: AMS })).toEqual([
      'If you cancel now: €40.00 back (50% until 23 Nov 2026, then 25%).',
    ]);
    expect(refundQuoteLines(q({ next_pct: 0 }), { locale: 'en', tz: AMS })).toEqual([
      'If you cancel now: €40.00 back (50% until 23 Nov 2026).',
      'Nothing back after 23 Nov 2026.',
    ]);
  });

  it('without next_pct (an older API): only "until", which is true whatever follows', () => {
    expect(refundQuoteLines(q({ next_pct: null }), { locale: 'en', tz: AMS })).toEqual(['If you cancel now: €40.00 back (50% until 23 Nov 2026).']);
  });
});

describe('the date is the last WHOLE day at the current rate', () => {
  // The staging case, 2026-10-17: a thread starting 13 Apr 2027 (UTC
  // midnight), 100% until 30 days before. The rate drops at 01:00 on 14 Mar in
  // Amsterdam, so 14 Mar is not a whole day at 100%: say 13 Mar.
  it('a moment just after local midnight → the day before', () => {
    expect(lastWholeDayBefore('2027-03-14T00:00:00Z', AMS)).toBe('2027-03-13T00:00:00.000Z');
  });
  it('exactly local midnight → the day before (that day starts at the new rate)', () => {
    expect(lastWholeDayBefore('2027-03-13T23:00:00Z', AMS)).toBe('2027-03-13T00:00:00.000Z');
  });
  it('across a month and a DST change, in another zone', () => {
    expect(lastWholeDayBefore('2027-03-01T08:00:00Z', 'America/Los_Angeles')).toBe('2027-02-28T00:00:00.000Z');
    expect(lastWholeDayBefore('2026-11-02T12:00:00Z', 'America/Los_Angeles')).toBe('2026-11-01T00:00:00.000Z');
  });
  it('an unreadable instant → null', () => {
    expect(lastWholeDayBefore('nope', AMS)).toBeNull();
  });
});
