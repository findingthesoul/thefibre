// REFUND RULES — what a cancelled place gets back (Sjoerd's 2iv part 2; plan
// 2026-10-16, his choices A–G pending). ONE pure function, refundFor, is the
// only arithmetic: the participant's preview in my.thread, the organiser's
// prefilled approve dialog and the refund itself will all call it, so the
// number promised and the number paid cannot drift.
//
// A rule is steps counted back from the thread's START:
//   { steps: [{ until_days_before: 30, refund_pct: 100 },
//             { until_days_before: 7,  refund_pct: 50 }],
//     fee_cents: 1000 }            // optional; kept in every case; default 0
// read as: at least 30 days before → 100%; at least 7 days before → 50%;
// later than that → 0%; once it has started → 0%.
//
// Pure: no clock (`requestedAt` is an argument — the day the participant
// ASKED, so a slow answer never costs them), no database, no rounding
// surprises (whole cents, half up, never below 0, never above what was paid).

export type RefundStep = { until_days_before: number; refund_pct: number };
export type RefundRule = { steps: RefundStep[]; fee_cents?: number };

export type RefundQuote = {
  /** The percentage of what was paid that comes back, before the fee. */
  pct: number;
  /** The fixed fee kept (0 when there is none, or nothing to keep it from). */
  fee_cents: number;
  /** What goes back, in cents: round(paid × pct) − fee, never below 0. */
  refund_cents: number;
  /** Why this number — for the sentence the participant reads. */
  reason: 'no_rule' | 'step' | 'after_last_step' | 'started' | 'no_start' | 'nothing_paid';
  /** The step that applied, when one did. */
  step: RefundStep | null;
  /** The next step boundary, when there is a later one with less back — so
   *  the preview can say "50% until 24 Nov". Null when nothing changes later. */
  changes_at: Date | null;
  /** The percentage that applies AFTER changes_at — 0 for "nothing back
   *  after 24 Nov", 25 for "then 25%". Null exactly when changes_at is null
   *  (nothing changes later). Builder 5's catch, 2026-10-17. */
  next_pct: number | null;
};

const DAY = 86_400_000;

/** The rule a person may save: steps 0–100%, days ≥ 0, no two steps on one
 *  day, fee ≥ 0. Returns why not, or null when fine. */
export function invalidRule(rule: RefundRule): string | null {
  if (!Array.isArray(rule.steps)) return 'steps must be a list';
  if (rule.steps.length > 10) return 'at most 10 steps';
  const days = new Set<number>();
  for (const s of rule.steps) {
    if (!Number.isInteger(s.until_days_before) || s.until_days_before < 0 || s.until_days_before > 3650) return 'days must be a whole number from 0';
    if (!Number.isFinite(s.refund_pct) || s.refund_pct < 0 || s.refund_pct > 100) return 'a percentage is between 0 and 100';
    if (days.has(s.until_days_before)) return 'two steps on the same day';
    days.add(s.until_days_before);
  }
  if (rule.fee_cents !== undefined && (!Number.isInteger(rule.fee_cents) || rule.fee_cents < 0)) return 'the fee is whole cents from 0';
  return null;
}

/** Steps from the furthest before the start to the closest. */
function ordered(rule: RefundRule): RefundStep[] {
  return [...rule.steps].sort((a, b) => b.until_days_before - a.until_days_before);
}

export function refundFor(
  rule: RefundRule | null | undefined,
  paidCents: number,
  start: Date | null,
  requestedAt: Date,
): RefundQuote {
  const paid = Math.max(0, Math.round(paidCents));
  const money = (pct: number, reason: RefundQuote['reason'], step: RefundStep | null, changesAt: Date | null, nextPct: number | null = null): RefundQuote => {
    const gross = Math.round((paid * pct) / 100);
    const fee = pct > 0 ? Math.min(rule?.fee_cents ?? 0, gross) : 0;
    return { pct, fee_cents: fee, refund_cents: Math.max(0, gross - fee), reason, step, changes_at: changesAt, next_pct: changesAt ? nextPct : null };
  };

  if (paid === 0) return { pct: 0, fee_cents: 0, refund_cents: 0, reason: 'nothing_paid', step: null, changes_at: null, next_pct: null };
  // No rule: today's behaviour — the organiser may refund in full.
  if (!rule || !rule.steps.length) return { ...money(100, 'no_rule', null, null), fee_cents: 0, refund_cents: paid };

  const steps = ordered(rule);
  // Nothing to count back from: the most generous step (the organiser can
  // still change it; a rule cannot punish a thread for having no date).
  if (!start) return money(steps[0]!.refund_pct, 'no_start', steps[0]!, null);

  if (requestedAt.getTime() >= start.getTime()) return money(0, 'started', null, null);

  const daysBefore = (start.getTime() - requestedAt.getTime()) / DAY;
  const i = steps.findIndex((s) => daysBefore >= s.until_days_before);
  if (i === -1) return money(0, 'after_last_step', null, null);
  const step = steps[i]!;
  // When THIS step stops holding: its own boundary, if a less generous
  // outcome follows (the next step, or nothing).
  const nextPct = i + 1 < steps.length ? steps[i + 1]!.refund_pct : 0;
  const changesAt = nextPct < step.refund_pct ? new Date(start.getTime() - step.until_days_before * DAY) : null;
  return money(step.refund_pct, 'step', step, changesAt, nextPct);
}
