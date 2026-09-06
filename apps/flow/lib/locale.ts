import { cookies } from 'next/headers';
import { toLocale, type Locale } from '@thefibre/shared';

// The signed-in interface language (i18n P3). ONE user-level setting,
// app-wide (D1): the thefibre.locale cookie written by savePref from
// Settings → Profile, with identity_profile.locale as the durable copy.
// No cookie (or an unknown value) → English.
const COOKIE_LOCALE = 'thefibre.locale';

export async function uiLocale(): Promise<Locale> {
  const store = await cookies();
  return toLocale(store.get(COOKIE_LOCALE)?.value);
}
