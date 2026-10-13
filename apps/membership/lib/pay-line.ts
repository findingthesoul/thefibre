// "You pay € 300 now. Your membership runs to 31 December 2026 and renews on
// 1 January 2027."
//
// The one sentence the join panel owes somebody before it takes their money.
// The panel showed a price on a tab and a button saying "Continue to
// payment", which is not the same as saying the amount and when it comes
// again — and under the launch-cohort rule it was further from it still: a
// yearly join takes the WHOLE year up front however late in the year it
// happens, and renews on a fixed date. Until now that was visible only on the
// Stripe receipt, after paying.
//
// Pure, with the clock passed in, for the reason this repo keeps relearning:
// a rule about dates that reads `new Date()` passes in UTC CI in October and
// fails for a real person in December.
//
// It calls `fixedFirstPeriod` — the rule the CHARGE runs — rather than
// restating it. Two copies would be two answers to "what am I paying", and
// the sentence shown before a charge is the last place that may disagree
// with it.

import { fixedFirstPeriod } from '@thefibre/shared/fixed-renewal';

export type PayLineInput = {
  /** What will be charged now, in cents: the adjusted tier price for the
   *  chosen interval plus any optional extras. */
  amountCents: number | null;
  interval: 'year' | 'month';
  /** The tier's fixed first-period date (YYYY-MM-DD), or nothing. */
  firstPeriodEndsOn?: string | null;
  now: Date;
};

export type PayLine =
  | { kind: 'none' }
  | { kind: 'recurring'; interval: 'year' | 'month' }
  | { kind: 'fixed'; endsOn: string; renewsOn: string };

/**
 * WHICH sentence to say — not the words, which are the catalogue's business
 * and are translated into six languages.
 *
 * `none` when there is no price to state (a tier whose price is "on
 * request"): saying nothing is right, inventing a zero is not.
 */
export function payLineFor({
  amountCents,
  interval,
  firstPeriodEndsOn,
  now,
}: PayLineInput): PayLine {
  if (amountCents === null) return { kind: 'none' };
  const fixed = fixedFirstPeriod(firstPeriodEndsOn, now, interval);
  if (!fixed) return { kind: 'recurring', interval };
  return {
    kind: 'fixed',
    endsOn: fixed.endsOn,
    // The day after the period ends — read back from the anchor the rule
    // hands Stripe, never retyped, so the date a person is shown is the date
    // the subscription actually starts billing on.
    renewsOn: new Date(fixed.anchor * 1000).toISOString().slice(0, 10),
  };
}
