// The currency options Sjoerd asked for (2026-07-10). ISO 4217 codes drive
// Intl formatting; labels are his names. El Salvador adopted the US dollar
// in 2001 — its colón (SVC) is defunct — so it maps to USD.
export const CURRENCY_OPTIONS: { code: string; label: string }[] = [
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'ZAR', label: 'South African Rand (R)' },
  { code: 'CHF', label: 'Swiss Franc (CHF)' },
  { code: 'CLP', label: 'Chilean Peso ($)' },
  { code: 'USD', label: 'El Salvador — US Dollar ($)' },
  { code: 'BRL', label: 'Brazilian Real (R$)' },
  { code: 'AED', label: 'UAE Dirham (AED)' },
];

export const CURRENCY_CODES = Array.from(new Set(CURRENCY_OPTIONS.map((c) => c.code)));
