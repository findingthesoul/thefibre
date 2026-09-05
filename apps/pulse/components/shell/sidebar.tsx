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
import type { SidebarMode } from '@/lib/prefs-shared';
import { APPS } from '@thefibre/shared';

const BRAND = APPS['fibre-pulse'];

const NAV: SidebarNavSection[] = [
  {
    items: [{ href: '/dashboard', label: 'Pulse', icon: LayoutDashboard }],
  },
  {
    label: 'Plan',
    items: [
      { href: '/cashflow', label: 'Cashflow', icon: TrendingUp },
      { href: '/projects', label: 'Projects', icon: FolderKanban },
      { href: '/budget', label: 'Budget', icon: Table2 },
    ],
  },
  {
    // Teams live under People, the Thread pattern (Sjoerd 2026-07-09).
    label: 'People',
    items: [{ href: '/teams', label: 'Teams', icon: UsersRound }],
  },
  {
    label: 'Money',
    items: [
      { href: '/invoices', label: 'Invoices', icon: Receipt },
      { href: '/accounts', label: 'Accounts', icon: Landmark },
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
