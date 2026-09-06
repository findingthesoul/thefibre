'use client';

// Shim: the sidebar chrome lives in @thefibre/shared/ui/sidebar-shell
// (extraction phase 3). This file keeps only what is the app's: the NAV.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarClock,
  CalendarRange,
  Settings,
  Users,
  Contact as ContactIcon,
  UsersRound,
  Receipt,
} from 'lucide-react';
import { createSidebarShell, type SidebarNavSection } from '@thefibre/shared/ui/sidebar-shell';
import { createBottomNav } from '@thefibre/shared/ui/bottom-nav';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { t } from '@/lib/i18n-ui';
import type { SidebarMode } from '@/lib/prefs-shared';
import { APPS } from '@thefibre/shared';

const BRAND = APPS['fibre-meet'];

// One nav, two chromes, six languages — labels come from the app catalog
// (the app-name section label is brand and stays).
function buildNav(locale: Parameters<typeof t>[0]): SidebarNavSection[] {
  return [
  {
    items: [{ href: '/dashboard', label: t(locale, 'nav_home'), icon: LayoutDashboard }],
  },
  {
    label: 'Meet',
    items: [
      { href: '/meeting-types', label: t(locale, 'nav_meeting_types'), icon: CalendarRange },
      { href: '/teams', label: t(locale, 'nav_teams'), icon: Users },
      { href: '/bookings', label: t(locale, 'nav_bookings'), icon: CalendarClock },
      { href: '/invoices', label: t(locale, 'nav_invoices'), icon: Receipt },
    ],
  },
  {
    label: t(locale, 'nav_workspace'),
    items: [
      { href: '/contacts', label: t(locale, 'nav_contacts'), icon: ContactIcon },
      { href: '/internal-team', label: t(locale, 'nav_internal_team'), icon: UsersRound },
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
