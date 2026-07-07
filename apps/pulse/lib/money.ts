// Cents → localized currency string. All Pulse amounts are integer cents in
// the workspace currency (pulse_settings.currency, EUR default).
export function money(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatPeriod(startIso: string): string {
  return new Date(startIso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
