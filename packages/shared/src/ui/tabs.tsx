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
//
// Two ways to switch, same look:
//   - buttons: pass `onChange`; the caller holds the value in state.
//   - links:   give each tab an `href` and pass the app's `link` component
//              (next/link). For views that live in the URL, so they can be
//              shared and work before JavaScript arrives — Connections'
//              Landscape Browse / Movement. Shared keeps no next/link import,
//              the same arrangement as createButtonLink.

import type { ReactNode } from 'react';

export type TabItem<V extends string> = { value: V; label: ReactNode; href?: string };

/** next/link, structurally. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LinkLike = (props: any) => any;

export function Tabs<V extends string>({
  tabs,
  value,
  onChange,
  link: LinkComponent,
  className = '',
}: {
  tabs: readonly TabItem<V>[];
  value: V;
  /** For button tabs. Not needed when every tab has an `href`. */
  onChange?: (v: V) => void;
  /** The app's link component, for tabs with an `href`. */
  link?: LinkLike;
  className?: string;
}) {
  const classFor = (on: boolean) =>
    `inline-block px-3 py-2 text-sm border-b-2 transition-colors ${
      on ? 'border-ink text-ink' : 'border-transparent text-ink-subtle hover:text-ink hover:border-line-strong'
    }`;
  return (
    <nav className={`border-b border-line ${className}`}>
      <ul role="tablist" className="flex flex-wrap gap-1 -mb-px">
        {tabs.map((tb) => {
          const on = value === tb.value;
          if (tb.href && LinkComponent) {
            return (
              <li key={tb.value}>
                <LinkComponent
                  href={tb.href}
                  role="tab"
                  aria-selected={on}
                  aria-current={on ? 'page' : undefined}
                  className={classFor(on)}
                >
                  {tb.label}
                </LinkComponent>
              </li>
            );
          }
          return (
            <li key={tb.value}>
              <button
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => onChange?.(tb.value)}
                className={classFor(on)}
              >
                {tb.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
