'use client';

// The mobile half of the app shell (Sjoerd 2026-09-05: "make the interface
// mobile ready — bottom menu"). Below `md` the sidebar is hidden and this
// tab bar takes over: the first few nav items as tabs plus a "More" sheet
// carrying the full sectioned nav, Help and the version line. NAV stays
// per-app — the same SidebarNavSection[] arrays feed both chromes.
//
// Same factory-injection pattern as sidebar-shell (no Next dependency in
// the package):
//
//   const BottomNavShell = createBottomNav(Link, usePathname);
//   <BottomNavShell nav={NAV} version={VERSION} />
//
// Renders as a flex sibling below <main> (not fixed), so it never overlaps
// content; the layout hides it at `md:` where the sidebar returns.

import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { HelpCircle, Menu, X } from 'lucide-react';
import type { SidebarNavItem, SidebarNavSection } from './sidebar-shell.js';
import { chromeT, useLocale } from './i18n-ui.js';

type LinkLike = (props: {
  href: string;
  className?: string;
  title?: string;
  /** Marks the tab you are on for screen readers. Hyphenated, because React
   *  passes it to the <a> verbatim; the camelCase spelling would land as an
   *  unknown attribute. */
  'aria-current'?: 'page' | undefined;
  children?: ReactNode;
}) => ReactNode;
type UsePathname = () => string;
type IconLike = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

/** Longest matching href wins — same rule as the sidebar. */
function activeHrefIn(hrefs: string[], pathname: string): string | undefined {
  return hrefs
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];
}

// The tab you are ON is a button that looks pressed in, not merely darker
// text (Sjoerd, 2026-09-21: "I can't really clearly see which icon I am on…
// maybe give it clear pushed button design"). Role tokens only, per
// docs/brand-design.md: the bar is `surface-sunken`, so the current tab lifts
// out of it in `surface-raised` with the standard line and a shadow, and
// carries aria-current for anyone not going by looks.
const TAB_INNER =
  'flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg py-1 min-w-0 transition-colors';
const TAB_ACTIVE = 'bg-surface-raised text-ink ring-1 ring-line shadow-sm';
const TAB_IDLE = 'text-ink-subtle';

export function createBottomNav(LinkComponent: LinkLike, usePathname: UsePathname) {
  function Tab({
    href,
    label,
    icon: Icon,
    active,
  }: {
    href: string;
    label: string;
    icon: IconLike;
    active: boolean;
  }) {
    return (
      <LinkComponent
        href={href}
        title={label}
        aria-current={active ? 'page' : undefined}
        className="flex-1 flex items-stretch min-w-0 p-1"
      >
        <span className={`${TAB_INNER} ${active ? TAB_ACTIVE : TAB_IDLE}`}>
          <Icon size={20} strokeWidth={active ? 2 : 1.75} className="shrink-0" />
          <span className="text-[10px] leading-tight truncate max-w-full px-1">{label}</span>
        </span>
      </LinkComponent>
    );
  }

  function BottomNavShell({
    nav,
    version,
    helpHref = '/help',
    maxPrimary = 4,
  }: {
    nav: SidebarNavSection[];
    version: string;
    helpHref?: string;
    /** Tabs shown directly on the bar; the rest live in the More sheet. */
    maxPrimary?: number;
  }) {
    const pathname = usePathname();
    const locale = useLocale();
    const [moreOpen, setMoreOpen] = useState(false);

    // Route changed (a link in the sheet was tapped) — close the sheet.
    useEffect(() => {
      setMoreOpen(false);
    }, [pathname]);

    const allItems: SidebarNavItem[] = nav.flatMap((s) => s.items);
    const primary = allItems.slice(0, maxPrimary);
    const hasMore = allItems.length > primary.length;

    const activeHref = activeHrefIn(
      [...allItems.map((i) => i.href), helpHref],
      pathname,
    );
    const activeInPrimary = primary.some((i) => i.href === activeHref);

    return (
      <div className="md:hidden shrink-0">
        {moreOpen && (
          <div
            className="fixed inset-0 z-40 bg-ink/40 flex items-end"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setMoreOpen(false);
            }}
          >
            <div className="w-full max-h-[80dvh] overflow-y-auto rounded-t-xl bg-surface-raised border-t border-line pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <span className="text-sm font-medium">{chromeT(locale, 'menu')}</span>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="text-ink-muted hover:text-ink p-1"
                  aria-label={chromeT(locale, 'close')}
                >
                  <X size={18} strokeWidth={1.75} />
                </button>
              </div>
              <div className="px-2 pb-3 space-y-3">
                {nav.map((section, i) => (
                  <div key={i}>
                    {section.label && (
                      <div className="px-2.5 pt-2 pb-1 text-[10px] uppercase tracking-wider text-ink-muted">
                        {section.label}
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const active = item.href === activeHref;
                        return (
                          <LinkComponent
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 h-10 rounded-md px-2.5 text-sm ${
                              active
                                ? 'bg-surface-sunken text-ink ring-1 ring-line'
                                : 'text-ink-subtle'
                            }`}
                          >
                            <Icon size={18} strokeWidth={1.75} className="shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </LinkComponent>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="border-t border-line pt-2">
                  <LinkComponent
                    href={helpHref}
                    className={`flex items-center gap-3 h-10 rounded-md px-2.5 text-sm ${
                      helpHref === activeHref ? 'bg-surface-sunken text-ink ring-1 ring-line' : 'text-ink-subtle'
                    }`}
                  >
                    <HelpCircle size={18} strokeWidth={1.75} className="shrink-0" />
                    <span>{chromeT(locale, 'help')}</span>
                  </LinkComponent>
                  <div className="px-2.5 pt-2 text-[10px] text-ink-muted tracking-wider">
                    v{version}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* The inset alone is not enough: on a phone with no home indicator it
            is zero, and on one with an indicator it is exactly the indicator,
            leaving the labels flush against it. `max()` keeps a real gap
            either way (Sjoerd, 2026-09-23: "Today and More are almost out of
            the screen"). The inset only has a value at all because the apps
            now set viewportFit: cover — see APP_VIEWPORT. */}
        <nav className="flex items-stretch bg-surface-sunken border-t border-line pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {primary.map((item) => (
            <Tab
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={item.href === activeHref}
            />
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className="flex-1 flex items-stretch min-w-0 p-1"
            >
              <span
                className={`${TAB_INNER} ${
                  moreOpen || (!activeInPrimary && activeHref) ? TAB_ACTIVE : TAB_IDLE
                }`}
              >
                <Menu size={20} strokeWidth={moreOpen || (!activeInPrimary && activeHref) ? 2 : 1.75} className="shrink-0" />
                <span className="text-[10px] leading-tight">{chromeT(locale, 'more')}</span>
              </span>
            </button>
          )}
        </nav>
      </div>
    );
  }

  return BottomNavShell;
}
