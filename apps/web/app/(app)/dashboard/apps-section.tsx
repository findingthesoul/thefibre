'use client';

// The inline "Your apps" grid, foldable (Sjoerd 2026-09-07: "make the your
// APPS with a close arrow") — the popup serves entry, so the inline copy
// can get out of the way. Collapse state is a per-browser pref like the
// sidebar mode.

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n-ui';
import { savePref } from '@/lib/prefs-actions';
import { COOKIE_APPS_SECTION } from '@/lib/prefs-shared';
import type { LauncherApp } from './launcher-overlay';

export function AppsSection({
  apps,
  locale,
  initialCollapsed,
}: {
  apps: LauncherApp[];
  locale: Locale;
  initialCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    void savePref(COOKIE_APPS_SECTION, next ? 'collapsed' : '');
  }

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink-muted hover:text-ink"
        >
          {t(locale, 'your_apps')}
          <ChevronDown
            size={13}
            strokeWidth={1.75}
            className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}
          />
        </button>
        {!collapsed && (
          <Link
            href="/settings/apps"
            className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2"
          >
            {t(locale, 'manage')} →
          </Link>
        )}
      </div>
      {!collapsed && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {apps.map((app) => (
            <a
              key={app.slug}
              href={app.href}
              className="flex items-center gap-4 rounded-xl border border-line bg-surface-raised p-5 transition-colors hover:border-line-strong hover:bg-surface-sunken"
            >
              {app.art ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={app.art}
                  alt=""
                  className="h-14 w-14 rounded-lg object-cover shrink-0"
                />
              ) : (
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-lg bg-yellow-300 text-ink font-semibold text-lg tracking-tight shrink-0">
                  {app.letters}
                </span>
              )}
              <span className="min-w-0">
                <span className="block text-lg font-medium leading-tight">{app.name}</span>
                <span className="mt-0.5 block text-sm text-ink-subtle truncate">
                  {app.tagline}
                </span>
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
