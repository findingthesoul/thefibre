'use client';

// Shim: the sidebar chrome lives in @thefibre/shared/ui/sidebar-shell
// (extraction phase 3). This file keeps only what is the app's: the NAV.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarRange,
  Users,
  ScanLine,
  LayoutTemplate,
  BookUser,
  UsersRound,
  ShieldCheck,
  Settings,
  Receipt,
} from 'lucide-react';
import { createSidebarShell, type SidebarNavSection } from '@thefibre/shared/ui/sidebar-shell';
import { createBottomNav } from '@thefibre/shared/ui/bottom-nav';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { t } from '@/lib/i18n-ui';
import type { SidebarMode } from '@/lib/prefs-shared';
import { APPS } from '@thefibre/shared';

const BRAND = APPS['the-thread'];

// One nav, two chromes, six languages — labels come from the app catalog
// (the app-name section label is brand and stays).
function buildNav(locale: Parameters<typeof t>[0]): SidebarNavSection[] {
  return [
  {
    items: [{ href: '/dashboard', label: t(locale, 'nav_home'), icon: LayoutDashboard }],
  },
  {
    label: 'Thread',
    items: [
      { href: '/threads', label: t(locale, 'nav_threads'), icon: CalendarRange },
      { href: '/enrolments', label: t(locale, 'nav_enrolments'), icon: Users },
      // Third, so it lands in the mobile tab bar rather than the More sheet:
      // it is the one screen used standing up, at a door, with one hand.
      { href: '/checkin', label: t(locale, 'nav_checkin'), icon: ScanLine },
      { href: '/invoices', label: t(locale, 'nav_invoices'), icon: Receipt },
      { href: '/templates', label: t(locale, 'nav_templates'), icon: LayoutTemplate },
    ],
  },
  {
    label: t(locale, 'nav_people'),
    items: [
      { href: '/contacts', label: t(locale, 'nav_contacts'), icon: BookUser },
      { href: '/teams', label: t(locale, 'nav_teams'), icon: UsersRound },
    ],
  },
  // Settings lives in the avatar menu, one place only (Sjoerd, 2026-09-11).
  ];
}

const SidebarShell = createSidebarShell(Link, usePathname);
const BottomNavShell = createBottomNav(Link, usePathname);

export function Sidebar({
  mode,
  version,
  brandTileSrc,
}: {
  mode: SidebarMode;
  version: string;
  brandTileSrc?: string | null;
}) {
  const locale = useLocale();
  return (
    <SidebarShell
      nav={buildNav(locale)}
      brandLetters={BRAND.brandLetters}
      brandTileSrc={brandTileSrc}
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
