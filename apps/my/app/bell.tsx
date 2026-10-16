// The way to Notifications, with a dot when something is unread. In the
// phone header and the desktop bar beside the app switcher — top right,
// where a person looks for "has anything happened" — rather than as a sixth
// tab, which would push You off the phone's bottom bar.

import Link from 'next/link';
import { Bell as BellIcon } from 'lucide-react';
import type { Locale } from '@thefibre/shared/i18n';
import { t } from '@/lib/i18n';

export function Bell({ unread, locale, className = '' }: { unread: number; locale: Locale; className?: string }) {
  return (
    <Link
      href="/notifications"
      aria-label={unread ? t(locale, 'notifications_unread', { n: unread }) : t(locale, 'notifications')}
      className={`relative inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-subtle hover:text-ink ${className}`}
    >
      <BellIcon size={20} strokeWidth={1.75} aria-hidden />
      {unread > 0 && (
        <span aria-hidden className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-600 ring-2 ring-surface" />
      )}
    </Link>
  );
}
