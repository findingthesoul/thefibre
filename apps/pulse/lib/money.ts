// Cents → localized currency string. All Pulse amounts are integer cents in
// the workspace currency (pulse_settings.currency, EUR default).
export function money(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// `intlLocale` is a BCP-47 tag (INTL_LOCALES[locale], i18n P3) — defaults to
// en-GB so untouched callers keep their output.
export function formatPeriod(startIso: string, intlLocale = 'en-GB'): string {
  return new Date(startIso + 'T00:00:00Z').toLocaleDateString(intlLocale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
