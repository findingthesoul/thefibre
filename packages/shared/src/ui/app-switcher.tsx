'use client';

// THE canonical app switcher — extracted 2026-09-05 (component-inventory
// Phase 1) from six identical, fully prop-driven copies.
//
// It needs next/link, and this package keeps no Next.js dependency (same
// arrangement as HelpPage in help.tsx): each app's
// components/shell/app-switcher.tsx shim ('use client' too) calls
// `createAppSwitcher(Link)` with the real next/link at module scope and
// re-exports the result.

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { chromeT, useLocale } from './i18n-ui.js';

export type AppEntry = {
  slug: string;
  name: string;
  url: string;
  current?: boolean;
};

/** next/link, structurally. See HelpLink in help.tsx for why it is loose. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LinkLike = (props: { href: string; className?: string; children?: any }) => any;

/** Bind the app's next/link once, at module scope, in the shim:
 *  `export const AppSwitcher = createAppSwitcher(Link);` */
export function createAppSwitcher(LinkComponent: LinkLike) {
  return function AppSwitcher({
    current,
    apps,
  }: {
    current: { slug: string; name: string };
    apps: AppEntry[];
  }) {
    const locale = useLocale();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      function onDown(e: MouseEvent) {
        if (!ref.current?.contains(e.target as Node)) setOpen(false);
      }
      if (open) document.addEventListener('mousedown', onDown);
      return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    return (
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-ink hover:bg-surface-sunken"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {current.name}
          <ChevronDown size={14} strokeWidth={1.75} className="text-ink-muted" />
        </button>

        {open && (
          <div className="absolute left-0 mt-2 w-56 rounded-lg bg-surface-raised border border-line shadow-lg py-2 text-sm z-40">
            <div className="px-3 pt-1 pb-1.5 text-[10px] uppercase tracking-wider text-ink-muted">
              {chromeT(locale, 'switch_app')}
            </div>
            {apps.map((a) => {
              const isCurrent = a.current ?? a.slug === current.slug;
              const cls =
                'flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-surface-sunken';
              const inner = (
                <>
                  <span className={isCurrent ? 'font-medium' : ''}>{a.name}</span>
                  {isCurrent && <Check size={14} strokeWidth={2} className="text-ink-subtle" />}
                </>
              );
              if (isCurrent) {
                return (
                  <div key={a.slug} className={`${cls} cursor-default`}>
                    {inner}
                  </div>
                );
              }
              return (
                <LinkComponent key={a.slug} href={a.url} className={cls}>
                  {inner}
                </LinkComponent>
              );
            })}
          </div>
        )}
      </div>
    );
  };
}
