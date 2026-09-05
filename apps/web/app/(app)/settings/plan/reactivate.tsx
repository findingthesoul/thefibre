'use client';

// The reactivation path out of the 13-month Free archive. Rendered on
// Settings → Plan when workspace.archived_at is set — the one page an
// archived workspace still leads to. One click, admin-only (the API
// enforces; non-admins get the error text instead of a dead button).

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reactivateWorkspace } from './actions';

export function ReactivateBanner({ archivedOn }: { archivedOn: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="mt-6 rounded-lg border border-amber-600/40 bg-amber-500/10 px-5 py-4 text-sm leading-relaxed">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-medium">This workspace was archived on {archivedOn}</span> after 13
          months without sign-ins or activity. Nothing was deleted — everything is exactly where you
          left it, waiting behind this one button.
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            start(async () => {
              const r = await reactivateWorkspace();
              if (r.error) setError(r.error);
              else router.refresh();
            });
          }}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {pending ? 'Reactivating…' : 'Reactivate workspace'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
