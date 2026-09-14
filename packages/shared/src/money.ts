// Cents → a localised currency string. ONE implementation (2026-09-14).
//
// Membership and Pulse each had a lib/money.ts and they had drifted in
// opposite directions: Membership learned a locale for `money` and keeps the
// cents on a €19,50 tier; Pulse learned a locale for `formatPeriod` and
// always rounds to whole units, which is right for a cashflow plan and would
// misprice a tier. Both behaviours are legitimate, so the difference is now
// an option instead of a fork.
//
// All amounts on the platform are integer cents in the stated currency
// (EUR default). `intl` is a BCP-47 tag (INTL_LOCALES[locale], i18n P3); the
// nl-NL default keeps locale-less call sites, and their output, intact.

export type MoneyOptions = {
  /**
   * 'auto' (default): whole amounts drop the decimals, others keep two —
   * €19 and €19,50. 'never': always whole units, rounded — a planner's view.
   */
  decimals?: 'auto' | 'never';
};

export function money(
  cents: number,
  currency = 'EUR',
  intl = 'nl-NL',
  { decimals = 'auto' }: MoneyOptions = {},
): string {
  const whole = decimals === 'never' || cents % 100 === 0;
  return new Intl.NumberFormat(intl, {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

/** A YYYY-MM-DD period start as "5 Dec" in the given locale, UTC-anchored. */
export function formatPeriod(startIso: string, intl = 'en-GB'): string {
  return new Date(startIso + 'T00:00:00Z').toLocaleDateString(intl, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
