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
import { savePref } from '@/lib/prefs-actions';
import { COOKIE_LAUNCHER } from '@/lib/prefs-shared';

const SESSION_KEY = 'fibre.launcher.shown';

export type LauncherApp = {
  slug: string;
  name: string;
  tagline: string;
  letters: string;
  /** Matisse tile crop (/brand/apps/<slug>.png) — null falls back to letters. */
  art: string | null;
  href: string;
};

export function LauncherOverlay({
  apps,
  fillers = [],
  locale,
}: {
  apps: LauncherApp[];
  /** Decorative crops completing the 4×2 poster around the app tiles. */
  fillers?: string[];
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [optOut, setOptOut] = useState(false);

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
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {apps.map((app) => (
            <a key={app.slug} href={app.href} className="group block min-w-0">
              {app.art ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={app.art}
                  alt=""
                  className="aspect-square w-full rounded-lg object-cover transition-transform group-hover:scale-[1.02]"
                />
              ) : (
                <span className="flex aspect-square w-full items-center justify-center rounded-lg bg-yellow-300 text-ink font-semibold text-2xl tracking-tight transition-transform group-hover:scale-[1.02]">
                  {app.letters}
                </span>
              )}
              <span className="mt-1.5 block text-center text-sm font-medium truncate">
                {app.name}
              </span>
            </a>
          ))}
          {fillers.map((src) => (
            <span key={src} className="block min-w-0" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="aspect-square w-full rounded-lg object-cover" />
              <span className="mt-1.5 block text-sm">&nbsp;</span>
            </span>
          ))}
        </div>
        <label className="mt-6 flex items-center gap-2.5 text-sm text-ink-subtle cursor-pointer select-none">
          <input
            type="checkbox"
            checked={optOut}
            onChange={(e) => {
              const off = e.target.checked;
              setOptOut(off);
              // Persist immediately — the popup may be dismissed any way.
              void savePref(COOKIE_LAUNCHER, off ? 'off' : '');
            }}
            className="h-4 w-4 rounded border-line accent-ink"
          />
          {t(locale, 'dont_show_at_login')}
        </label>
      </div>
    </div>
  );
}
