// When a tier's first period ends on a fixed date.
//
// One date, one cohort, self-expiring: a date in the past behaves exactly like
// no date at all, so the setting needs no cleanup after the launch it was made
// for. Pure, so the rule can be tested without Stripe and without a database —
// and so the join route and any later caller cannot disagree about what "in
// the future" means.

export type FixedFirstPeriod = {
  /** Charge the whole period price now, as a one-off line. */
  chargeFullNow: true;
  /** Unix seconds for the first recurring charge: 00:00 UTC the day after. */
  anchor: number;
  /** The date itself, for the sentence a person reads. */
  endsOn: string;
};

/**
 * Does this tier's fixed first period still apply, and if so when does the
 * subscription start billing?
 *
 * `now` is a parameter so the test can pin the clock — a rule about dates
 * that reads the wall clock is a rule that passes in UTC CI and fails in
 * December.
 */
export function fixedFirstPeriod(
  firstPeriodEndsOn: string | null | undefined,
  now: Date,
  interval: 'year' | 'month' = 'year',
): FixedFirstPeriod | null {
  if (!firstPeriodEndsOn) return null;
  // YEARLY ONLY, and this is a correctness rule rather than a preference.
  // "The full period now" on a MONTHLY join is one month's price — and then
  // nothing until the anchor, so a monthly joiner in October would have
  // October, November and December for the price of one month. A monthly join
  // on such a tier simply bills the ordinary way, on its own anniversary.
  // Ignoring beats refusing: the setting is a one-time cohort thing, and
  // refusing would take the monthly option away from everybody for months.
  if (interval !== 'year') return null;
  // The period ends at the END of that day, so the first renewal is 00:00 UTC
  // the day after. A member whose period "runs up 31/12/2026" is billed again
  // on 1 January, not on 31 December.
  // A plain yyyy-mm-dd, and a day that actually exists. There is no separate
  // shape check: one was here, and mutating it away broke nothing — Date.parse
  // already rejects "31-12-2026", "soon" and "20261231", and the round-trip
  // below catches the one case neither of them does (2026-02-31, which parses
  // to 3 March). A guard no mutation can break is a guard that teaches the
  // next reader the wrong thing.
  const endMs = Date.parse(`${firstPeriodEndsOn}T00:00:00Z`);
  if (!Number.isFinite(endMs)) return null;
  // AND IT MUST BE A REAL DAY. Neither the pattern above nor Date.parse
  // rejects 2026-02-31: it rolls over to 3 March, so an admin's typo would
  // quietly become an anchor three days into another month. Round-tripping
  // the parsed date is what catches it. (Found by mutating the pattern check
  // and watching nothing fail — it was redundant, and this is the check it
  // should have been.)
  if (new Date(endMs).toISOString().slice(0, 10) !== firstPeriodEndsOn) return null;
  const anchorMs = endMs + 24 * 60 * 60 * 1000;

  // PAST MEANS OFF. The comparison is against the anchor rather than the end
  // date, so a join during 31 December still belongs to the cohort — the
  // period it is paying for has not ended yet.
  if (anchorMs <= now.getTime()) return null;

  // AND INSIDE 48 HOURS MEANS OFF TOO, because Stripe says so: `trial_end`
  // "Has to be at least 48 hours in the future", and trial_end is the only
  // shape Checkout accepts here — measured on 2026-10-13, not deduced:
  //
  //   one-off + recurring + anchor + proration 'none'  → Checkout REFUSES:
  //       "You cannot set proration_behavior to none in a Checkout Session
  //        with one-time prices."
  //   one-off + recurring + anchor, no proration param → 365.35 charged now
  //       (Stripe prorates the stub period and adds it)
  //   one-off + recurring + trial_end                  → 300.00 now,
  //       300.00 on 1 January, no proration on any line
  //
  // So a join in the last two days before the anchor simply bills the
  // ordinary way, on its own anniversary. Refusing the join would be worse
  // than charging it normally, and silently charging a proration worse still.
  const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
  if (anchorMs - now.getTime() < FORTY_EIGHT_HOURS) return null;

  return { chargeFullNow: true, anchor: Math.floor(anchorMs / 1000), endsOn: firstPeriodEndsOn };
}
