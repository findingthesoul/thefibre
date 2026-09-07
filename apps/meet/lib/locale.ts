import { cookies } from 'next/headers';
import { isLocale, toLocale, type Locale } from '@thefibre/shared';

// The signed-in interface language (i18n P3). ONE user-level setting,
// app-wide (D1): the thefibre.locale cookie written by savePref from
// Settings → Profile, with identity_profile.locale as the durable copy.
// The cookie is PER-BROWSER — pass /auth/me's `locale` as the fallback so
// the setting follows the user to every device (Sjoerd's phone stayed
// English while his desktop went NL, 2026-09-07). No cookie, no fallback
// (or unknown values) → English.
const COOKIE_LOCALE = 'thefibre.locale';

export async function uiLocale(fallback?: string | null): Promise<Locale> {
  const store = await cookies();
  const fromCookie = store.get(COOKIE_LOCALE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return toLocale(fallback);
}
