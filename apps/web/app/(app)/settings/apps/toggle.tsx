'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { activateApp, deactivateApp } from './actions';
import { t, type Locale } from '@/lib/i18n-ui';

export function AppToggle({
  slug,
  active,
  locale,
}: {
  slug: string;
  active: boolean;
  locale: Locale;
}) {
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useState(active);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function toggle() {
    setError(null);
    const next = !optimistic;
    setOptimistic(next);
    start(async () => {
      const r = next ? await activateApp(slug) : await deactivateApp(slug);
      if (r.error) {
        setOptimistic(!next); // revert
        setError(r.error);
      } else {
        router.refresh();
      }
    });
  }

  const on = optimistic;

  return (
    <div className="flex flex-col items-end gap-2 shrink-0">
      <div className="flex items-center gap-3">
        <span
          className={`text-[10px] uppercase tracking-wider ${
            on ? 'text-emerald-700' : 'text-ink-muted'
          }`}
        >
          {on ? t(locale, 'app_status_active') : t(locale, 'not_active')}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          disabled={pending}
          onClick={toggle}
          className={[
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            on ? 'bg-emerald-600' : 'bg-neutral-300 dark:bg-neutral-700',
            pending ? 'opacity-60 cursor-wait' : 'cursor-pointer',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
              on ? 'translate-x-5' : 'translate-x-0.5',
            ].join(' ')}
          />
        </button>
      </div>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
