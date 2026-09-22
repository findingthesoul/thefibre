'use client';

// Remember where you were.
//
// Sjoerd, 2026-09-22: *"when I open connect - save the last page used.... first
// timer is TODAY."*
//
// Written with document.cookie rather than through a server action, which is
// the opposite of what prefs-actions.ts does and is deliberate: this fires on
// every navigation, and a round trip per click to record something this small
// would be paid by everybody, for ever, to save the one moment of opening the
// app. Safari's ITP caps a cookie written by JavaScript at seven days — which
// is exactly the right behaviour here. If you have not opened Connect in a
// week, Today is the better answer anyway.
//
// Only the SECTION, never the whole path: being put back on one person's page
// is not "where I was".

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { COOKIE_LAST, sectionOf } from '@/lib/last-page';

export function RememberPage() {
  const pathname = usePathname();
  useEffect(() => {
    const section = sectionOf(pathname);
    if (!section) return;
    try {
      document.cookie = `${COOKIE_LAST}=${section}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${
        location.protocol === 'https:' ? '; secure' : ''
      }`;
    } catch {
      // A browser refusing cookies is not a reason to break the page; the
      // app simply opens on Today next time.
    }
  }, [pathname]);
  return null;
}
