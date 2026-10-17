// What cancelling would give back, said beside "Request cancellation"
// (refund slice 3, 2026-10-17). The API counts it (lib/refund-quote.ts on the
// API, by the organiser's rule); this only says it, in the reader's language,
// with money and dates in the thread's zone.
//
// Shape and meaning are builder 4's (refund slice 2), on
// groups[].threads[].refund_quote:
//   * null — nothing was paid: say nothing.
//   * reason 'no_rule' — no rule applies (everything back): say nothing.
//   * changes_at — the MOMENT the current percentage stops holding (start
//     minus the step's days), and only when something less generous follows.
//     Said as the last WHOLE day in the thread's zone before that moment:
//     "until" reads as "up to and including", and 100% "until 14 Mar" is
//     false at 15:00 on 14 Mar when the moment was 01:00. One day early can
//     only under-promise (seen on staging, 2026-10-17).
//   * refund_cents is already net of the fixed fee.
// A pending request's quote is frozen at the request's date (rule C), which
// is why it reads "Asked on <date>: €X back by the rule".

import type { Locale } from '@thefibre/shared/i18n';
import { t } from './i18n';
import { fmtDate, money } from './format';

export type RefundQuote = {
  pct: number;
  fee_cents: number;
  refund_cents: number;
  reason: 'no_rule' | 'step' | 'after_last_step' | 'started' | 'no_start' | 'nothing_paid';
  currency: string;
  paid_cents: number;
  changes_at: string | null;
  rule_source: 'thread' | 'workspace' | null;
  counted_at: string;
  /** The percentage that follows `changes_at` (additive, asked of slice 2).
   *  Absent from an API that does not send it yet: then only "until" is
   *  said, which is true whatever follows. */
  next_pct?: number | null;
};

/** The last whole day, in `tz`, before the instant `iso` — as a UTC-midnight
 *  ISO date, to be formatted in 'UTC'. */
export function lastWholeDayBefore(iso: string, tz: string): string | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  // The calendar date of the instant in the zone, then the day before it.
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString();
}

/** The quote's sentences, or none when there is nothing to say. */
export function refundQuoteLines(
  q: RefundQuote | null | undefined,
  o: { locale: Locale; tz: string; pending?: { created_at: string } | null },
): string[] {
  if (!q || q.reason === 'no_rule' || q.reason === 'nothing_paid') return [];
  const amount = money(q.refund_cents, q.currency, o.locale);
  if (o.pending) {
    const date = fmtDate(o.pending.created_at, o.locale, o.tz) ?? '';
    return [q.refund_cents > 0 ? t(o.locale, 'refund_asked', { date, amount }) : t(o.locale, 'refund_asked_nothing', { date })];
  }
  if (q.refund_cents <= 0) return [t(o.locale, 'refund_now_nothing')];
  const lastDay = q.changes_at ? lastWholeDayBefore(q.changes_at, o.tz) : null;
  const date = lastDay ? (fmtDate(lastDay, o.locale, 'UTC') ?? '') : '';
  const knowsNext = typeof q.next_pct === 'number';
  const lines = [
    !q.changes_at
      ? t(o.locale, 'refund_now', { amount, pct: q.pct })
      : knowsNext && q.next_pct! > 0
        ? t(o.locale, 'refund_now_then', { amount, pct: q.pct, date, next: q.next_pct! })
        : t(o.locale, 'refund_now_until', { amount, pct: q.pct, date }),
  ];
  // Only when the API says so: what follows the date is nothing at all.
  if (q.changes_at && knowsNext && q.next_pct === 0) lines.push(t(o.locale, 'refund_nothing_after', { date }));
  if (q.fee_cents > 0) lines.push(t(o.locale, 'refund_fee_kept', { fee: money(q.fee_cents, q.currency, o.locale) }));
  return lines;
}
