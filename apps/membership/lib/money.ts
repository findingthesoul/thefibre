// Cents → localized currency string. All Membership amounts are integer cents
// in the tier currency (EUR default). Whole-euro amounts drop the decimals;
// a €19,50 tier keeps them (Pulse's always-round-down would misprice it).
// `intl` is a BCP-47 tag (INTL_LOCALES[locale], i18n P3); the nl-NL default
// keeps locale-less call sites (and the previous behaviour) intact.
export function money(cents: number, currency = 'EUR', intl = 'nl-NL'): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(intl, {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

export function formatPeriod(startIso: string): string {
  return new Date(startIso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
