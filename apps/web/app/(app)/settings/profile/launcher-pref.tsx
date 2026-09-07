'use client';

// Reset for the launcher popup's "don't show at login" checkbox (Sjoerd
// 2026-09-07) — the popup can only turn itself OFF; this is where it comes
// back. Save-on-change, same pattern as the LanguagePicker beside it.

import { useState } from 'react';
import { SwitchField } from '@thefibre/shared/ui/switch';
import { t, type Locale } from '@/lib/i18n-ui';
import { savePref } from '@/lib/prefs-actions';
import { COOKIE_LAUNCHER } from '@/lib/prefs-shared';

export function LauncherPref({ initialShow, locale }: { initialShow: boolean; locale: Locale }) {
  const [show, setShow] = useState(initialShow);

  return (
    <section className="mt-12 border-t border-line pt-8">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">
        {t(locale, 'launcher_heading')}
      </div>
      <div className="mt-3 max-w-md">
        <SwitchField
          label={t(locale, 'show_launcher_at_login')}
          checked={show}
          onChange={(next) => {
            setShow(next);
            void savePref(COOKIE_LAUNCHER, next ? '' : 'off');
          }}
        />
      </div>
    </section>
  );
}
