'use client';

// The launcher as a POPUP above the dashboard (Sjoerd 2026-09-07: "a popup
// screen above the rest, slight darker background"). Shows once per browser
// session on entry — sessionStorage, a per-tab convenience, not state
// (wrapped in try/catch: private windows may throw). Choosing an app
// navigates; Esc / backdrop / × just reveal the dashboard, where the same
// tiles live below the stats.

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n-ui';

const SESSION_KEY = 'fibre.launcher.shown';

export type LauncherApp = {
  slug: string;
  name: string;
  tagline: string;
  letters: string;
  href: string;
};

export function LauncherOverlay({ apps, locale }: { apps: LauncherApp[]; locale: Locale }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (apps.length === 0) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, '1');
      setOpen(true);
    } catch {
      /* storage unavailable — show nothing rather than nag every nav */
    }
  }, [apps.length]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-3xl max-h-[90dvh] overflow-y-auto rounded-xl border border-line bg-surface-raised shadow-xl p-6 sm:p-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between gap-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-muted pt-1">
            {t(locale, 'your_apps')}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-ink-muted hover:text-ink"
            aria-label={t(locale, 'close')}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {apps.map((app) => (
            <a
              key={app.slug}
              href={app.href}
              className="flex items-center gap-4 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-surface-sunken"
            >
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-lg bg-yellow-300 text-ink font-semibold text-lg tracking-tight shrink-0">
                {app.letters}
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-medium leading-tight">{app.name}</span>
                <span className="mt-0.5 block text-sm text-ink-subtle truncate">
                  {app.tagline}
                </span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
