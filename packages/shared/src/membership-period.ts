// Which day a membership period runs TO.
//
// Stripe thinks in renewal moments: `period.end` is the instant the next one
// begins. A person thinks in last days — Sjoerd, setting the launch cohort:
// *"runs up 31/12/2026"*. Those are the same period named a day apart, and
// until 2026-10-13 the two halves of this product named it both ways: the join
// panel promised "runs to 31 December 2026 and renews on 1 January 2027",
// while the invoice for that very payment said "(until 2027-01-01)".
//
// Neither was wrong. Both on one purchase is what makes it a problem — a
// money document and the page that sold it should not need reconciling. So
// everything shown to a MEMBER names the last day, from here.
//
// Not applied retrospectively: a receipt already sent is a document, and
// documents are not rewritten.

/**
 * The last day of a period that ENDS at `periodEnd`, as YYYY-MM-DD in UTC.
 *
 * Accepts what the callers actually hold: unix seconds (Stripe), an ISO
 * string (our own columns), or a Date. Returns null for anything it cannot
 * read, because a label with a wrong date is worse than a label with none.
 */
export function periodLastDay(periodEnd: number | string | Date | null | undefined): string | null {
  if (periodEnd === null || periodEnd === undefined || periodEnd === '') return null;

  const ms =
    typeof periodEnd === 'number'
      ? // Stripe's seconds. A value small enough to be seconds is treated as
        // seconds; nobody is billing in 1970.
        periodEnd * 1000
      : periodEnd instanceof Date
        ? periodEnd.getTime()
        : Date.parse(periodEnd);
  if (!Number.isFinite(ms)) return null;

  // A whole day back, then read in UTC. Not "subtract one from the date
  // part": that would turn 2027-01-01 into 2027-01-00 at a month boundary,
  // which is where this is always needed.
  return new Date(ms - 86_400_000).toISOString().slice(0, 10);
}
