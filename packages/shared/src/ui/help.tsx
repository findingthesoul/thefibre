// THE canonical Help page — one layout, five apps.
//
// Every Fibre sidebar has always had a Help link in its footer; until v0.18.1
// none of the five apps had a route behind it. Rather than write the page
// five times (and watch the copies drift, the way date-field did before
// v0.13.105), the chrome lives here and each app passes its own content:
//
//   app/(app)/help/page.tsx  →  <HelpPage appId=… sections=… otherApps=… />
//
// Server-renderable on purpose — no hooks, no 'use client'. `link` is
// next/link, injected so this package keeps no Next.js dependency.

import type { ReactNode } from 'react';
import { APPS, type AppBrand } from '../branding.js';
import type { AppId } from '../index.js';
import { DEFAULT_LOCALE, type Locale } from '../i18n.js';
import { serverChromeT } from './chrome-server-i18n.js';

/** next/link, structurally. Injected by the caller.
 *
 *  `children` is deliberately loose: Next.js augments React's `ReactNode` for
 *  async server components, so a strict `ReactNode` here does not accept the
 *  real `next/link` — this package compiles without that augmentation. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HelpLink = (props: { href: string; className?: string; children?: any }) => any;

/** One row of "getting around this app" — mirrors a sidebar entry. */
export type HelpSection = {
  /** Sidebar label, verbatim. */
  label: string;
  /** App-relative route. */
  href: string;
  /** What it is for, in one sentence. */
  blurb: string;
};

/** An AppEntry from lib/available-apps.ts — apps this user can actually open. */
export type HelpOtherApp = { slug: string; name: string; url: string };

export function HelpPage({
  appId,
  sections,
  otherApps,
  aboutHref,
  link: Link,
  locale = DEFAULT_LOCALE,
}: {
  /** Which app this Help page belongs to. Supplies the name + tagline. */
  appId: AppId;
  sections: HelpSection[];
  /** Everything from buildAppList(); the current app is filtered out here. */
  otherApps: HelpOtherApp[];
  /** Where "How The Fibre works" lives — relative on the platform, absolute elsewhere. */
  aboutHref: string;
  link: HelpLink;
  /** The signed-in interface language (i18n P3) — pass `await uiLocale()`. */
  locale?: Locale;
}) {
  const me: AppBrand = APPS[appId];
  const others = otherApps.filter((a) => a.slug !== appId);

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <header>
        <h1 className="text-2xl font-medium tracking-tight text-ink">{serverChromeT(locale, 'help_title')}</h1>
        <p className="mt-1 text-sm text-ink-subtle">
          {me.name} &middot; {me.tagline}
        </p>
      </header>

      {/* ---------------------------------------------------------- */}
      <section className="mt-10">
        <SectionLabel>{serverChromeT(locale, 'help_getting_around', { app: me.shortName })}</SectionLabel>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {sections.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="flex h-full flex-col rounded-lg border border-line bg-surface-raised p-4 transition-colors hover:border-line-strong"
              >
                <span className="text-sm font-medium text-ink">{s.label}</span>
                <span className="mt-1 text-sm leading-relaxed text-ink-subtle">{s.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------------- */}
      <section className="mt-12">
        <SectionLabel>{serverChromeT(locale, 'help_rest')}</SectionLabel>
        {others.length === 0 ? (
          <div className="mt-3 rounded-lg border border-line bg-surface-sunken p-5 text-sm text-ink-subtle">
            {serverChromeT(locale, 'help_nothing_else')}
          </div>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface-raised">
              {others.map((a) => {
                const brand = APPS[a.slug as AppId];
                return (
                  <li key={a.slug}>
                    <Link
                      href={a.url}
                      className="flex items-baseline justify-between gap-4 px-4 py-3 hover:bg-surface-sunken"
                    >
                      <span className="text-sm font-medium text-ink">{a.name}</span>
                      <span className="text-sm text-ink-subtle text-right">
                        {brand?.tagline ?? ''}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-ink-muted">{serverChromeT(locale, 'help_each_one')}</p>
          </>
        )}
      </section>

      {/* ---------------------------------------------------------- */}
      <section className="mt-12 border-t border-line pt-6">
        <SectionLabel>{serverChromeT(locale, 'help_read_more')}</SectionLabel>
        <Link
          href={aboutHref}
          className="mt-3 block rounded-lg border border-line bg-surface-raised p-4 transition-colors hover:border-line-strong"
        >
          <span className="text-sm font-medium text-ink">{serverChromeT(locale, 'help_how_works')} &rarr;</span>
          <span className="mt-1 block text-sm leading-relaxed text-ink-subtle">
            {serverChromeT(locale, 'help_about_blurb')}
          </span>
        </Link>
        <p className="mt-4 text-sm leading-relaxed text-ink-subtle">
          If you are building against the platform, the contract is in the repository at{' '}
          <code className="font-mono text-xs">docs/building-on-the-fibre.md</code>, and{' '}
          <code className="font-mono text-xs">apps/api/scripts/verify-external-app.mjs</code> is the
          runnable version of everything it claims. The release history is in{' '}
          <code className="font-mono text-xs">CHANGELOG.md</code>.
        </p>
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wider text-ink-muted">{children}</div>;
}
