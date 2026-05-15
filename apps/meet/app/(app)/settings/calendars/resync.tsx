'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { resyncCalendars } from './actions';

export function ResyncButton() {
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
            ? `${r.added} new calendar${r.added === 1 ? '' : 's'} added.`
            : `${r.found ?? 0} calendar${r.found === 1 ? '' : 's'} — all up to date.`,
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
        {pending ? 'Syncing…' : 'Re-sync from Google'}
      </button>
      {msg && <span className="text-xs text-ink-subtle">{msg}</span>}
    </div>
  );
}
