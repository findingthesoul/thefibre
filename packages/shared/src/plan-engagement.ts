// What a plan costs BEFORE the subscription starts, as one sentence.
//
// Sjoerd, 2026-09-27: *"for enterprise plan we should have a setup cost - and
// training costs"* — a day rate and a one-off, shown rather than charged.
//
// The rule the whole thing rests on: NULL MEANS NOT OFFERED, and not offered
// is not free. Every plan but Enterprise has none of these, and "none" must
// print nothing at all. A "€0 setup" on a price list is a promise — it says
// this plan includes setup at no cost — and nobody said that. So each branch
// asks whether the number EXISTS, never whether it is non-zero: `if (cents)`
// would swallow a deliberate zero and invent a promise from a missing value
// in the same line of code.
//
// Here rather than in the pricing page because a quote, an admin screen and
// the public card should not each invent their own phrasing for the same
// three numbers.

export type PlanEngagement = {
  setup_cents?: number | null;
  training_onboarding_cents?: number | null;
  training_day_cents?: number | null;
};

export function engagementParts(
  p: PlanEngagement,
  money: (cents: number) => string,
): string[] {
  const parts: string[] = [];
  if (typeof p.setup_cents === 'number') parts.push(`${money(p.setup_cents)} setup`);
  if (typeof p.training_onboarding_cents === 'number') {
    parts.push(`${money(p.training_onboarding_cents)} onboarding training`);
  }
  if (typeof p.training_day_cents === 'number') {
    parts.push(`${money(p.training_day_cents)} per training day`);
  }
  return parts;
}

/** The line a card shows, or null when the plan offers none of it. */
export function engagementLine(
  p: PlanEngagement,
  money: (cents: number) => string,
): string | null {
  const parts = engagementParts(p, money);
  return parts.length ? `${parts.join(' · ')}, one-off` : null;
}
