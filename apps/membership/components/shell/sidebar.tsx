'use client';

// Shim: the sidebar chrome lives in @thefibre/shared/ui/sidebar-shell
// (extraction phase 3). This file keeps only what is the app's: the NAV.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Layers,
  Package,
  Receipt,
  Settings,
  UsersRound,
} from 'lucide-react';
import { createSidebarShell, type SidebarNavSection } from '@thefibre/shared/ui/sidebar-shell';
import type { SidebarMode } from '@/lib/prefs-shared';
import { APPS } from '@thefibre/shared';

const BRAND = APPS['membership'];

const NAV: SidebarNavSection[] = [
  {
    items: [{ href: '/dashboard', label: 'Membership', icon: LayoutDashboard }],
  },
  {
    label: 'Community',
    items: [
      { href: '/members', label: 'Members', icon: UsersRound },
      { href: '/tiers', label: 'Tiers', icon: Layers },
      { href: '/products', label: 'Products', icon: Package },
    ],
  },
  {
    label: 'Money',
    items: [{ href: '/invoices', label: 'Invoices', icon: Receipt }],
  },
  {
    // Access lives ON products (2026-09-05) — no separate nav entry; the
    // sync overview is linked from the Products page.
    label: 'Setup',
    items: [{ href: '/settings', label: 'Settings', icon: Settings }],
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
