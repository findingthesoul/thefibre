// The billing interval a manually added membership actually runs on.
//
// Born 2026-09-23 from the soul.com launch test. The add-member dialog derived
// the interval from the tier's prices, and a tier with NO price at all (the
// cooperative members' tier, comped) fell through to 'month' — so every
// cooperative member was dated one month out, which the overdue sweep would
// grace a month later and lapse two weeks after that, revoking the year-agenda
// enrolment. Production carried one such row. The rule now lives here, on the
// server, so no caller can send a month for an unpriced tier again:
//
//   - no price on the tier          → year (comped memberships are annual)
//   - the requested interval priced → as requested
//   - only the other interval priced → that one
export type Interval = 'year' | 'month';

export function effectiveInterval(
  tier: { price_cents_year?: number | null; price_cents_month?: number | null } | null | undefined,
  requested: Interval,
): Interval {
  const hasYear = (tier?.price_cents_year ?? 0) > 0;
  const hasMonth = (tier?.price_cents_month ?? 0) > 0;
  if (!hasYear && !hasMonth) return 'year';
  if (requested === 'year') return hasYear ? 'year' : 'month';
  return hasMonth ? 'month' : 'year';
}
