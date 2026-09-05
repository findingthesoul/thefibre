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
import type { SidebarMode } from '@/lib/prefs-shared';
import { APPS } from '@thefibre/shared';

const BRAND = APPS['fibre-meet'];

const NAV: SidebarNavSection[] = [
  {
    items: [{ href: '/dashboard', label: 'Home', icon: LayoutDashboard }],
  },
  {
    label: 'Meet',
    items: [
      { href: '/meeting-types', label: 'Meeting types', icon: CalendarRange },
      { href: '/teams', label: 'Teams', icon: Users },
      { href: '/bookings', label: 'Bookings', icon: CalendarClock },
      { href: '/invoices', label: 'Invoices', icon: Receipt },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { href: '/contacts', label: 'Contacts', icon: ContactIcon },
      { href: '/internal-team', label: 'Internal team', icon: UsersRound },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const SidebarShell = createSidebarShell(Link, usePathname);

export function Sidebar({ mode, version }: { mode: SidebarMode; version: string }) {
  return (
    <SidebarShell
      nav={NAV}
      brandLetters={BRAND.brandLetters}
      brandName={BRAND.name}
      mode={mode}
      version={version}
    />
  );
}
