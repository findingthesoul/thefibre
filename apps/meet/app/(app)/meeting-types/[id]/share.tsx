'use client';

// The Share button on a meeting type. The menu itself is
// @thefibre/shared/ui/share-menu — this is the Meet-bound wrapper that gives
// it the app's own translations, the same way every shared component here
// takes its app-bound pieces as props.

import { ShareMenu } from '@thefibre/shared/ui/share-menu';
import { t, type Locale } from '@/lib/i18n-ui';

export function ShareMeetingType({ path, locale }: { path: string; locale: Locale }) {
  return (
    <ShareMenu
      url={path}
      labels={{
        share: t(locale, 'share'),
        visit: t(locale, 'visit_page'),
        copy: t(locale, 'copy_link'),
        copied: t(locale, 'copied'),
      }}
    />
  );
}
