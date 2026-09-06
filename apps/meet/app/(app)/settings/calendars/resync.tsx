'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n-ui';
import { resyncCalendars } from './actions';

export function ResyncButton({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run() {
    setMsg(null);
    startTransition(async () => {
      const r = await resyncCalendars();
      if (r.error) setMsg(r.error);
      else {
        setMsg(
          r.added
            ? r.added === 1
              ? t(locale, 'cal_added_one')
              : t(locale, 'cal_added_many', { n: r.added })
            : (r.found ?? 0) === 1
              ? t(locale, 'cal_up_to_date_one')
              : t(locale, 'cal_up_to_date_many', { n: r.found ?? 0 }),
        );
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md border border-line bg-surface-raised px-3 py-1.5 text-sm hover:bg-surface-sunken disabled:opacity-50"
      >
        <RefreshCw
          className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`}
          strokeWidth={1.5}
        />
        {pending ? t(locale, 'syncing') : t(locale, 'resync')}
      </button>
      {msg && <span className="text-xs text-ink-subtle">{msg}</span>}
    </div>
  );
}
