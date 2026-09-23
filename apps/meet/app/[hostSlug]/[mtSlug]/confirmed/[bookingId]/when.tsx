'use client';

// When the meeting is, in the reader's OWN time zone.
//
// The page is server-rendered, and `toLocaleString(undefined, …)` on a server
// means the SERVER's zone — UTC on Fly. So a booking made for 09:00 in
// Amsterdam read "07:00 AM" to the person who had just made it (Sjoerd,
// 2026-09-23). The booking step gets this right because it runs in the
// browser; only the confirmation afterwards did not.
//
// The server still renders something — the host's zone, named — so the page
// is never blank and a reader with JavaScript off sees a true time rather
// than none. The browser then replaces it with their own zone, also named,
// because "15:00" without a zone is the ambiguity that started this.

import { useEffect, useState } from 'react';

export function When({
  iso,
  fallback,
}: {
  iso: string;
  /** Rendered on the server, in the host's zone. */
  fallback: string;
}) {
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    try {
      setLocal(
        new Intl.DateTimeFormat(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        }).format(new Date(iso)),
      );
    } catch {
      // Leave the server's string in place — a wrong-looking zone beats none.
    }
  }, [iso]);

  return <>{local ?? fallback}</>;
}
