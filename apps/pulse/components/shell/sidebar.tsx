'use client';

// Shim: the sidebar chrome lives in @thefibre/shared/ui/sidebar-shell
// (extraction phase 3). This file keeps only what is Pulse's: the NAV.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  TrendingUp,
  FolderKanban,
  Table2,
  Landmark,
  Receipt,
  Settings,
  UsersRound,
} from 'lucide-react';
import {
  createSidebarShell,
  type SidebarNavSection,
} from '@thefibre/shared/ui/sidebar-shell';
import { createBottomNav } from '@thefibre/shared/ui/bottom-nav';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { t } from '@/lib/i18n-ui';
import type { SidebarMode } from '@/lib/prefs-shared';
import { APPS } from '@thefibre/shared';

const BRAND = APPS['fibre-pulse'];

// One nav, two chromes, six languages — labels come from the app catalog.
function buildNav(locale: Parameters<typeof t>[0]): SidebarNavSection[] {
  return [
  {
    items: [{ href: '/dashboard', label: t(locale, 'nav_pulse'), icon: LayoutDashboard }],
  },
  {
    label: t(locale, 'nav_plan'),
    items: [
      { href: '/cashflow', label: t(locale, 'nav_cashflow'), icon: TrendingUp },
      { href: '/projects', label: t(locale, 'nav_projects'), icon: FolderKanban },
      { href: '/budget', label: t(locale, 'nav_budget'), icon: Table2 },
    ],
  },
  {
    // Teams live under People, the Thread pattern (Sjoerd 2026-07-09).
    label: t(locale, 'nav_people'),
    items: [{ href: '/teams', label: t(locale, 'nav_teams'), icon: UsersRound }],
  },
  {
    label: t(locale, 'nav_money'),
    items: [
      { href: '/invoices', label: t(locale, 'nav_invoices'), icon: Receipt },
      { href: '/accounts', label: t(locale, 'nav_accounts'), icon: Landmark },
      { href: '/settings', label: t(locale, 'nav_settings'), icon: Settings },
    ],
  },
  ];
}

const SidebarShell = createSidebarShell(Link, usePathname);
const BottomNavShell = createBottomNav(Link, usePathname);

export function Sidebar({ mode, version }: { mode: SidebarMode; version: string }) {
  const locale = useLocale();
  return (
    <SidebarShell
      nav={buildNav(locale)}
      brandLetters={BRAND.brandLetters}
      brandName={BRAND.name}
      mode={mode}
      version={version}
    />
  );
}

// The same NAV as a bottom tab bar — rendered by the layout below `md`.
export function MobileNav({ version }: { version: string }) {
  const locale = useLocale();
  return <BottomNavShell nav={buildNav(locale)} version={version} />;
}
