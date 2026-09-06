'use client';

// The sidebar chrome (extraction phase 3): rail/panel/hover behaviour, brand
// block, nav groups with longest-match highlighting, help + version footer.
// NAV stays per-app — the app passes its sections in. next/link and
// usePathname are injected via the factory (the package keeps no Next
// dependency; see button.tsx for the pattern):
//
//   import Link from 'next/link';
//   import { usePathname } from 'next/navigation';
//   export const Sidebar = createSidebarShell(Link, usePathname);

import { useState, type ComponentType, type ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import type { SidebarMode } from '../prefs.js';
import { chromeT, useLocale } from './i18n-ui.js';

type IconLike = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
export type SidebarNavItem = { href: string; label: string; icon: IconLike };
export type SidebarNavSection = { label?: string; items: SidebarNavItem[] };

type LinkLike = (props: {
  href: string;
  className?: string;
  title?: string;
  children?: ReactNode;
}) => ReactNode;
type UsePathname = () => string;

const RAIL_W = 'w-14';
const PANEL_W = 'w-60';

export function createSidebarShell(LinkComponent: LinkLike, usePathname: UsePathname) {
  function SidebarShell({
    nav,
    brandLetters,
    brandName,
    brandContent,
    mode,
    version,
    homeHref = '/dashboard',
    helpHref = '/help',
  }: {
    nav: SidebarNavSection[];
    brandLetters: string;
    brandName: string;
    /** Replaces the plain-text brand name when the panel is open — web's
     *  handwritten wordmark image. The yellow tile always renders. */
    brandContent?: ReactNode;
    mode: SidebarMode;
    version: string;
    homeHref?: string;
    helpHref?: string;
  }) {
    const [hovered, setHovered] = useState(false);

    // Expanded means the wide panel is visible.
    // In hover mode, the rail stays at RAIL_W and the panel overlays content.
    // In expanded mode, the panel takes flow width and shifts content.
    const pinnedWide = mode === 'expanded';
    const showPanel = pinnedWide || (mode === 'hover' && hovered);

    const reservedW = pinnedWide ? PANEL_W : RAIL_W;
    const renderedW = showPanel ? PANEL_W : RAIL_W;

    return (
      // h-full is load-bearing: the aside positions absolutely against this
      // div, and since v0.45.0 the layouts wrap it in a plain `hidden
      // md:block` div — without an explicit height the chain collapses to 0
      // and the nav squeezes into an invisible scroll strip (Sjoerd, live,
      // 2026-09-05).
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`${reservedW} h-full shrink-0 relative`}
      >
        <aside
          className={`absolute inset-y-0 left-0 ${renderedW} bg-surface-sunken border-r border-line flex flex-col transition-[width] duration-150 ease-out z-30 ${
            showPanel && !pinnedWide ? 'shadow-[4px_0_24px_-12px_rgb(0_0_0_/_0.18)]' : ''
          }`}
        >
          <div className="h-14 flex items-center px-3 shrink-0">
            <LinkComponent href={homeHref} className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-yellow-300 text-ink font-semibold text-[11px] tracking-tight shrink-0">
                {brandLetters}
              </span>
              {showPanel &&
                (brandContent ?? (
                  <span className="text-sm font-medium tracking-tight whitespace-nowrap">
                    {brandName}
                  </span>
                ))}
            </LinkComponent>
          </div>

          <NavSections nav={nav} expanded={showPanel} />

          <Footer expanded={showPanel} version={version} helpHref={helpHref} />
        </aside>
      </div>
    );
  }

  function NavSections({ nav, expanded }: { nav: SidebarNavSection[]; expanded: boolean }) {
    const pathname = usePathname();

    // Find the longest href that matches the current pathname. Only that one
    // gets highlighted — prevents /settings + /settings/apps both lighting up.
    const allHrefs = nav.flatMap((s) => s.items.map((i) => i.href));
    const activeHref = allHrefs
      .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
      .sort((a, b) => b.length - a.length)[0];

    return (
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {nav.map((section, i) => (
          <div key={i}>
            {section.label && expanded && (
              <div className="px-2.5 pt-2 pb-1 text-[10px] uppercase tracking-wider text-ink-muted">
                {section.label}
              </div>
            )}
            {section.label && !expanded && <div className="h-px bg-line/60 mx-2 my-2" />}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  expanded={expanded}
                  active={item.href === activeHref}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    );
  }

  function NavLink({
    item,
    expanded,
    active,
  }: {
    item: SidebarNavItem;
    expanded: boolean;
    active: boolean;
  }) {
    const Icon = item.icon;
    return (
      <LinkComponent
        href={item.href}
        title={item.label}
        className={`flex items-center gap-3 h-9 rounded-md px-2.5 text-sm transition-colors ${
          active
            ? 'bg-surface-raised text-ink ring-1 ring-line'
            : 'text-ink-subtle hover:text-ink hover:bg-surface-raised/60'
        }`}
      >
        <Icon size={18} strokeWidth={1.75} className="shrink-0" />
        {expanded && <span className="truncate">{item.label}</span>}
      </LinkComponent>
    );
  }

  function Footer({
    expanded,
    version,
    helpHref,
  }: {
    expanded: boolean;
    version: string;
    helpHref: string;
  }) {
    const pathname = usePathname();
    const locale = useLocale();
    const helpActive = pathname === helpHref;
    return (
      <div className="px-2 py-3 border-t border-line">
        <LinkComponent
          href={helpHref}
          title={chromeT(locale, 'help')}
          className={`flex items-center gap-3 h-9 rounded-md px-2.5 text-sm transition-colors ${
            helpActive
              ? 'bg-surface-raised text-ink ring-1 ring-line'
              : 'text-ink-subtle hover:text-ink hover:bg-surface-raised/60'
          }`}
        >
          <HelpCircle size={18} strokeWidth={1.75} className="shrink-0" />
          {expanded && <span>{chromeT(locale, 'help')}</span>}
        </LinkComponent>
        {expanded && (
          <div className="px-2.5 pt-2 text-[10px] text-ink-muted tracking-wider">v{version}</div>
        )}
      </div>
    );
  }

  return SidebarShell;
}
