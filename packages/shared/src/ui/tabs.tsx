'use client';

// THE tab bar. One reference, per docs/brand-design.md.
//
// Born 2026-09-14 when Settings → Website became the second screen to need
// tabs (Sjoerd: "Make tabs for different parts of the design"). The first was
// The Thread's thread-settings dialog, which had the markup written inline;
// it now renders this, unchanged in look.
//
// It is only the bar. Panels are the caller's, and should stay MOUNTED and be
// hidden rather than unmounted when inactive: a form split across tabs must
// still submit every field, and an unmounted panel's inputs are not in the
// FormData.

import type { ReactNode } from 'react';

export type TabItem<V extends string> = { value: V; label: ReactNode };

export function Tabs<V extends string>({
  tabs,
  value,
  onChange,
  className = '',
}: {
  tabs: readonly TabItem<V>[];
  value: V;
  onChange: (v: V) => void;
  className?: string;
}) {
  return (
    <nav className={`border-b border-line ${className}`}>
      <ul role="tablist" className="flex flex-wrap gap-1 -mb-px">
        {tabs.map((tb) => (
          <li key={tb.value}>
            <button
              type="button"
              role="tab"
              aria-selected={value === tb.value}
              onClick={() => onChange(tb.value)}
              className={`inline-block px-3 py-2 text-sm border-b-2 transition-colors ${
                value === tb.value
                  ? 'border-ink text-ink'
                  : 'border-transparent text-ink-subtle hover:text-ink hover:border-line-strong'
              }`}
            >
              {tb.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
