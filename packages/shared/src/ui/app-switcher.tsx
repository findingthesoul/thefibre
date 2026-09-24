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
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { chromeT, useLocale } from './i18n-ui.js';

export type AppEntry = {
  slug: string;
  name: string;
  url: string;
  current?: boolean;
};

/** next/link, structurally. See HelpLink in help.tsx for why it is loose. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LinkLike = (props: {
  href: string;
  className?: string;
  onClick?: () => void;
  children?: any;
}) => any;

/** Bind the app's next/link once, at module scope, in the shim:
 *  `export const AppSwitcher = createAppSwitcher(Link);` */
/** The origin of an app's URL, for preconnect. A relative or malformed URL
 *  has no origin to warm, and must not throw inside a render. */
function originOf(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

export function createAppSwitcher(LinkComponent: LinkLike) {
  return function AppSwitcher({
    current,
    apps,
    portal,
  }: {
    current: { slug: string; name: string };
    apps: AppEntry[];
    /** The participant portal. NOT an app — it has no catalogue slug, no
     *  workspace activation and no seat — so it sits under its own heading
     *  rather than in the app list (branding.ts SURFACES draws the same
     *  line). Everyone has one, including people who also run a workspace:
     *  an organiser enrols in other people's threads too, and had no way to
     *  reach the place that shows them (Sjoerd, 2026-09-24). */
    portal?: { url: string; name: string } | undefined;
  }) {
    const locale = useLocale();
    const [open, setOpen] = useState(false);
    // Which app you just clicked. Every entry here is a DIFFERENT ORIGIN, so
    // the hop is a full page load the router cannot make feel instant — but
    // it can say it heard you. Without this the menu sits there looking
    // ignored for the length of a cold connection (Sjoerd, 2026-09-23:
    // *"show a loading icon when something is loading"*).
    const [going, setGoing] = useState<string | null>(null);
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
            {/* Opening the menu is the moment we learn a hop is likely, so the
                browser can do the DNS lookup and TLS handshake for the other
                apps' origins now instead of after the click. Only here — not
                on every page load — because eight idle sockets to prove a
                point is not a speed-up. */}
            {apps.map((a) => {
              if (a.current ?? a.slug === current.slug) return null;
              const origin = originOf(a.url);
              if (!origin) return null;
              return <link key={`pc-${a.slug}`} rel="preconnect" href={origin} />;
            })}
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
                <LinkComponent
                  key={a.slug}
                  href={a.url}
                  className={cls}
                  onClick={() => setGoing(a.slug)}
                >
                  <span>{a.name}</span>
                  {going === a.slug && (
                    <Loader2 size={14} className="animate-spin text-ink-muted" />
                  )}
                </LinkComponent>
              );
            })}

            {portal && (
              <>
                <div className="my-1.5 border-t border-line" />
                <div className="px-3 pt-1 pb-1.5 text-[10px] uppercase tracking-wider text-ink-muted">
                  {chromeT(locale, 'your_own_page')}
                </div>
                <LinkComponent
                  href={portal.url}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-surface-sunken"
                  onClick={() => setGoing('__portal')}
                >
                  <span>{portal.name}</span>
                  {going === '__portal' && (
                    <Loader2 size={14} className="animate-spin text-ink-muted" />
                  )}
                </LinkComponent>
              </>
            )}
          </div>
        )}
      </div>
    );
  };
}
