// Pulse's binding of the shared money helpers (@thefibre/shared/money, one
// copy since 2026-09-14). A cashflow plan reads in whole units, so Pulse
// pins `decimals: 'never'`; all Pulse amounts are integer cents in the
// workspace currency (pulse_settings.currency, EUR default).
import { money as sharedMoney } from '@thefibre/shared/money';

export const money = (cents: number, currency = 'EUR') =>
  sharedMoney(cents, currency, 'nl-NL', { decimals: 'never' });

// (startIso, intlLocale = 'en-GB') — the shared signature is Pulse's.
export { formatPeriod } from '@thefibre/shared/money';
