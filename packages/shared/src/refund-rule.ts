// The refund rule, as a buyer reads it BEFORE paying (refund rules, slice 4,
// 2026-10-17). The public thread payload carries `refund_rule`; the enrol
// form — on the thread page and in every embed's popup — says it.
//
// WHAT is said is decided here, once; the words are each app's (its own
// typed catalog). The arithmetic of a refund is the API's refundFor
// (apps/api/src/lib/refund-rules.ts): this module only lists the rule's
// steps with their last day, and the API test `refund-rule-public.test.ts`
// proves each "until <date>" it produces is still the step's percentage by
// refundFor, and the day after it no longer is — the two sides agree.
//
// "Until <date>" means UP TO AND INCLUDING that day, in every language, and
// the date is the LAST WHOLE DAY in the thread's zone before the step ends —
// one day early can only under-promise (my.thread's rule for the same
// sentence, builder 5, 2026-10-17). Pure: no clock, no I/O.

import { cardDate } from './thread-dates.js';

/** As the public payload sends it: steps from the furthest before the start
 *  to the closest, each with the instant it ends (start − days), or null
 *  when the thread has no start to count from. */
export type PublicRefundRule = {
  fee_cents: number;
  steps: { refund_pct: number; until_days_before: number; until: string | null }[];
};

/** The last whole day, in `tz`, before the instant `iso` — as a UTC-midnight
 *  ISO date (format it in 'UTC'). */
export function lastWholeDayBefore(iso: string, tz: string): string | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  let ymd: string;
  try {
    ymd = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  } catch {
    return null;
  }
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString();
}

export type RefundRuleLine =
  /** "Cancel up to and including <date>: <pct>% back". */
  | { kind: 'until'; pct: number; date: string }
  /** "Later: nothing back" — or "<pct>% back" when the last step leaves some. */
  | { kind: 'after'; pct: number }
  /** "<fee> is kept on any refund" — `fee` already in the reader's locale
   *  ("€ 5,00" in Dutch, "5,00 €" in German, "€5.00" in English). */
  | { kind: 'fee'; fee_cents: number; fee: string };

/**
 * The rule as lines to say, or null when there is nothing to say: no rule
 * (the organiser decides, as before rules existed), or a thread with no start
 * to count from. Dates are formatted like the card's ("14 Feb 2027").
 */
export function refundRuleLines(
  rule: PublicRefundRule | null | undefined,
  o: { timeZone: string; intlLocale: string; currency?: string | null },
): RefundRuleLine[] | null {
  if (!rule || !rule.steps?.length) return null;
  const steps = [...rule.steps].sort((a, b) => b.until_days_before - a.until_days_before);
  if (steps.some((s) => !s.until)) return null;
  const lines: RefundRuleLine[] = [];
  for (const s of steps) {
    const day = lastWholeDayBefore(s.until!, o.timeZone);
    if (!day) return null;
    lines.push({ kind: 'until', pct: s.refund_pct, date: cardDate(day, 'UTC', o.intlLocale) });
  }
  // After the last step, refundFor gives nothing back.
  lines.push({ kind: 'after', pct: 0 });
  if (rule.fee_cents > 0 && steps.some((s) => s.refund_pct > 0)) {
    const fee = new Intl.NumberFormat(o.intlLocale, { style: 'currency', currency: o.currency || 'EUR' }).format(rule.fee_cents / 100);
    lines.push({ kind: 'fee', fee_cents: rule.fee_cents, fee });
  }
  return lines;
}
