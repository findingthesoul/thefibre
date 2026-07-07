'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  FolderKanban,
  Table2,
  Landmark,
  HelpCircle,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { SidebarMode } from '@/lib/prefs-shared';
import { APPS } from '@thefibre/shared';

const BRAND = APPS['fibre-pulse'];

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavSection = { label?: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    items: [{ href: '/dashboard', label: 'Pulse', icon: LayoutDashboard }],
  },
  {
    label: 'Plan',
    items: [
      { href: '/pipeline', label: 'Pipeline', icon: TrendingUp },
      { href: '/projects', label: 'Teams & projects', icon: FolderKanban },
      { href: '/budget', label: 'Budget', icon: Table2 },
    ],
  },
  {
    label: 'Money',
    items: [
      { href: '/accounts', label: 'Accounts', icon: Landmark },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const RAIL_W = 'w-14';
const PANEL_W = 'w-60';

export function Sidebar({
  mode,
  version,
}: {
  mode: SidebarMode;
  version: string;
}) {
  const [hovered, setHovered] = useState(false);

  // Expanded means the wide panel is visible.
  // In hover mode, the rail stays at RAIL_W and the panel overlays content.
  // In expanded mode, the panel takes flow width and shifts content.
  const pinnedWide = mode === 'expanded';
  const showPanel = pinnedWide || (mode === 'hover' && hovered);

  // Reserved width in the flex layout (what main content moves around).
  const reservedW = pinnedWide ? PANEL_W : RAIL_W;
  // Actual rendered width of the floating panel.
  const renderedW = showPanel ? PANEL_W : RAIL_W;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`${reservedW} shrink-0 relative`}
    >
      <aside
        className={`absolute inset-y-0 left-0 ${renderedW} bg-surface-sunken border-r border-line flex flex-col transition-[width] duration-150 ease-out z-30 ${
          showPanel && !pinnedWide ? 'shadow-[4px_0_24px_-12px_rgb(0_0_0_/_0.18)]' : ''
        }`}
      >
        <Brand showLabel={showPanel} />

        <NavSections expanded={showPanel} />

        <Footer expanded={showPanel} version={version} />
      </aside>
    </div>
  );
}

function Brand({ showLabel }: { showLabel: boolean }) {
  return (
    <div className="h-14 flex items-center px-3 shrink-0">
      <Link href="/dashboard" className="flex items-center gap-2.5">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-yellow-300 text-ink font-semibold text-[11px] tracking-tight shrink-0">
          {BRAND.brandLetters}
        </span>
        {showLabel && (
          <span className="text-sm font-medium tracking-tight whitespace-nowrap">
            {BRAND.name}
          </span>
        )}
      </Link>
    </div>
  );
}

function NavSections({ expanded }: { expanded: boolean }) {
  const pathname = usePathname();

  // Find the longest href that matches the current pathname. Only that one
  // gets highlighted — prevents /settings + /settings/apps both lighting up.
  const allHrefs = NAV.flatMap((s) => s.items.map((i) => i.href));
  const activeHref = allHrefs
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
      {NAV.map((section, i) => (
        <NavGroup key={i} section={section} expanded={expanded} activeHref={activeHref} />
      ))}
    </nav>
  );
}

function NavGroup({
  section,
  expanded,
  activeHref,
}: {
  section: NavSection;
  expanded: boolean;
  activeHref: string | undefined;
}) {
  return (
    <div>
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
  );
}

function NavLink({
  item,
  expanded,
  active,
}: {
  item: NavItem;
  expanded: boolean;
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
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
    </Link>
  );
}

function Footer({ expanded, version }: { expanded: boolean; version: string }) {
  return (
    <div className="px-2 py-3 border-t border-line">
      <Link
        href="/help"
        title="Help"
        className="flex items-center gap-3 h-9 rounded-md px-2.5 text-sm text-ink-subtle hover:text-ink hover:bg-surface-raised/60"
      >
        <HelpCircle size={18} strokeWidth={1.75} className="shrink-0" />
        {expanded && <span>Help</span>}
      </Link>
      {expanded && (
        <div className="px-2.5 pt-2 text-[10px] text-ink-muted tracking-wider">
          v{version}
        </div>
      )}
    </div>
  );
}
