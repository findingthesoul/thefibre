'use client';

// Shim: the sidebar chrome lives in @thefibre/shared/ui/sidebar-shell
// (extraction phase 3). This file keeps only what is the app's: the NAV.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarRange,
  Users,
  LayoutTemplate,
  BookUser,
  UsersRound,
  ShieldCheck,
  Settings,
  Receipt,
} from 'lucide-react';
import { createSidebarShell, type SidebarNavSection } from '@thefibre/shared/ui/sidebar-shell';
import { createBottomNav } from '@thefibre/shared/ui/bottom-nav';
import type { SidebarMode } from '@/lib/prefs-shared';
import { APPS } from '@thefibre/shared';

const BRAND = APPS['the-thread'];

const NAV: SidebarNavSection[] = [
  {
    items: [{ href: '/dashboard', label: 'Home', icon: LayoutDashboard }],
  },
  {
    label: 'Thread',
    items: [
      { href: '/threads', label: 'Threads', icon: CalendarRange },
      { href: '/enrolments', label: 'Enrolments', icon: Users },
      { href: '/invoices', label: 'Invoices', icon: Receipt },
      { href: '/templates', label: 'Templates', icon: LayoutTemplate },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/contacts', label: 'Contacts', icon: BookUser },
      { href: '/teams', label: 'Teams', icon: UsersRound },
      { href: '/internal-team', label: 'Internal team', icon: ShieldCheck },
    ],
  },
  {
    label: 'Workspace',
    items: [{ href: '/settings', label: 'Settings', icon: Settings }],
  },
];

const SidebarShell = createSidebarShell(Link, usePathname);
const BottomNavShell = createBottomNav(Link, usePathname);

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

// The same NAV as a bottom tab bar — rendered by the layout below `md`.
export function MobileNav({ version }: { version: string }) {
  return <BottomNavShell nav={NAV} version={version} />;
}
