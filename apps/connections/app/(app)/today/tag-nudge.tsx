'use client';

// Once in a while: "N tags could use tidying". Sjoerd, 2026-09-14 (ask 60).
//
// Only asks the API when the list is due on this device (lib/tag-cleaning-seen),
// so an ordinary morning costs nothing, and only shows for somebody who can
// act on it — a nudge a member cannot follow is noise.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n-ui';
import { safely } from '@/lib/safely';
import { markTagCleaningSeen, tagCleaningDue } from '@/lib/tag-cleaning-seen';
import { loadTagCleaning } from '../settings/tags/actions';

export function TagCleaningNudge({ locale }: { locale: Locale }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!tagCleaningDue()) return;
    let alive = true;
    void safely(loadTagCleaning, () => null).then((d) => {
      if (alive && d?.can_edit) setCount(d.count);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (count === 0) return null;
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm">
      <Sparkles size={15} strokeWidth={1.75} className="text-ink-muted" />
      <span>{t(locale, 'tagclean_nudge', { n: count })}</span>
      <span className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            markTagCleaningSeen();
            setCount(0);
          }}
          className="text-xs text-ink-muted hover:text-ink"
        >
          {t(locale, 'tagclean_later')}
        </button>
        <Link href="/settings/tags" className="text-sm font-medium underline-offset-2 hover:underline">
          {t(locale, 'tagclean_open')}
        </Link>
      </span>
    </div>
  );
}
