'use client';

// Shim: the sidebar chrome lives in @thefibre/shared/ui/sidebar-shell
// (extraction phase 3). This file keeps only what is the app's: the NAV.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Workflow,
  CheckSquare,
  Contact as ContactIcon,
} from 'lucide-react';
import { createSidebarShell, type SidebarNavSection } from '@thefibre/shared/ui/sidebar-shell';
import { createBottomNav } from '@thefibre/shared/ui/bottom-nav';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { t } from '@/lib/i18n-ui';
import type { SidebarMode } from '@/lib/prefs-shared';
import { APPS } from '@thefibre/shared';

const BRAND = APPS['fibre-flow'];

// One nav, two chromes, six languages — labels come from the app catalog
// (the app-name section label is brand and stays).
function buildNav(locale: Parameters<typeof t>[0]): SidebarNavSection[] {
  return [
  {
    items: [{ href: '/dashboard', label: t(locale, 'nav_home'), icon: LayoutDashboard }],
  },
  {
    label: 'Flow',
    items: [
      { href: '/flows', label: t(locale, 'nav_flows'), icon: Workflow },
      { href: '/tasks', label: t(locale, 'nav_tasks'), icon: CheckSquare },
    ],
  },
  {
    label: t(locale, 'nav_workspace'),
    items: [
      { href: '/contacts', label: t(locale, 'nav_contacts'), icon: ContactIcon },
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
