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
import { COOKIE_GUIDE, COOKIE_LAUNCHER, COOKIE_LAUNCHER_PENDING } from '@/lib/prefs-shared';

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
  soon = [],
  locale,
  initialOpen = false,
  guide = false,
}: {
  apps: LauncherApp[];
  /** Unbuilt apps closing the poster: art + muted name, unclickable. */
  soon?: { name: string; art: string }[];
  locale: Locale;
  /** True right after sign-in (the callback's one-shot cookie). */
  initialOpen?: boolean;
  /** The digital facilitator (Sjoerd, 2026-09-08): ask, then point the way
   *  to The Thread with an arrow on the REAL tile — the existing interface
   *  is the guide's stage. */
  guide?: boolean;
}) {
  const [open, setOpen] = useState((initialOpen || guide) && apps.length > 0);
  const [optOut, setOptOut] = useState(false);
  const [guideStep, setGuideStep] = useState<'ask' | 'point' | null>(guide ? 'ask' : null);

  // Consume the one-shot sign-in cookie so a plain refresh doesn't re-pop.
  useEffect(() => {
    if (initialOpen) void savePref(COOKIE_LAUNCHER_PENDING, '');
  }, [initialOpen]);

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
        {guideStep === 'ask' && (
          <div className="mt-4 rounded-lg border border-line bg-surface p-4">
            <p className="text-sm font-medium">{t(locale, 'guide_question')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setGuideStep('point');
                  void savePref(COOKIE_GUIDE, 'done');
                }}
                className="rounded-lg bg-ink px-4 py-1.5 text-sm font-semibold text-surface hover:opacity-90"
              >
                {t(locale, 'guide_yes')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setGuideStep(null);
                  void savePref(COOKIE_GUIDE, 'done');
                }}
                className="rounded-lg border border-line px-4 py-1.5 text-sm text-ink-subtle hover:text-ink"
              >
                {t(locale, 'guide_no')}
              </button>
            </div>
          </div>
        )}
        {guideStep === 'point' && (
          <p className="mt-4 text-sm font-medium text-ink">{t(locale, 'guide_point')}</p>
        )}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {apps.map((app) => (
            <a
              key={app.slug}
              href={app.href}
              className={`group relative block min-w-0 ${
                guideStep === 'point' && app.slug !== 'the-thread' ? 'opacity-40' : ''
              }`}
            >
              {guideStep === 'point' && app.slug === 'the-thread' && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 animate-bounce text-2xl"
                >
                  ↓
                </span>
              )}
              {app.art ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={app.art}
                  alt=""
                  className={`aspect-square w-full rounded-lg object-cover transition-transform group-hover:scale-[1.02] ${
                    guideStep === 'point' && app.slug === 'the-thread'
                      ? 'ring-4 ring-yellow-300'
                      : ''
                  }`}
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
          {soon.map((app) => (
            <span key={app.name} className="block min-w-0 opacity-90">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={app.art} alt="" className="aspect-square w-full rounded-lg object-cover" />
              <span className="mt-1.5 block text-center text-sm text-ink-muted truncate">
                {app.name}
              </span>
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
