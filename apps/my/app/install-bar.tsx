'use client';

// my.thread's words for the shared install bar (@thefibre/shared/ui/install-prompt).
// Sjoerd, 2026-10-16: "In the app, on mobile, there should be some sort of a
// message that you can download the app as a webapp." The rules — phone only,
// not when installed, Chrome's own dialog or Safari's steps, "Not now" for 30
// days — live in the shared component; this only supplies the language.

import { InstallPrompt } from '@thefibre/shared/ui/install-prompt';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { t } from '@/lib/i18n';

export function InstallBar() {
  const locale = useLocale();
  return (
    <InstallPrompt
      storageKey="my.install.snoozed-until"
      helpHref="/help"
      labels={{
        title: t(locale, 'install_title'),
        install: t(locale, 'install_button'),
        notNow: t(locale, 'not_now'),
        iosSteps: t(locale, 'install_ios_steps'),
        help: t(locale, 'install_help'),
        close: t(locale, 'close'),
      }}
    />
  );
}
