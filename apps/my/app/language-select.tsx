'use client';

// The language menu on the sign-in screen — for somebody who has not signed
// in, so there is no profile to save to and the browser's guess may be wrong.
//
// It writes ONLY the thefibre.locale cookie, which is domain-wide: choosing
// Dutch here is choosing it for every Thread app in this browser, the same
// one setting the apps' own pickers write. Once signed in, the You page's
// picker is the place, and it carries the choice to other devices too.

import { useRouter } from 'next/navigation';
import { LOCALES, LOCALE_LABELS, type Locale } from '@thefibre/shared/i18n';
import { COOKIE_LOCALE, writePrefCookie } from '@thefibre/shared/prefs';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { t } from '@/lib/i18n';

export function LanguageSelect() {
  const router = useRouter();
  const locale = useLocale();
  return (
    <label className="inline-flex items-center gap-2 text-xs text-ink-muted">
      {t(locale, 'language')}
      <select
        value={locale}
        onChange={(e) => {
          writePrefCookie(COOKIE_LOCALE, e.target.value as Locale, process.env.NEXT_PUBLIC_COOKIE_DOMAIN);
          router.refresh();
        }}
        className="min-h-11 rounded-md border border-line bg-surface px-2 text-xs text-ink"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
