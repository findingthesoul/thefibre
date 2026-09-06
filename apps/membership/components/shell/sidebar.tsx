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
import { createBottomNav } from '@thefibre/shared/ui/bottom-nav';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { t } from '@/lib/i18n-ui';
import type { SidebarMode } from '@/lib/prefs-shared';
import { APPS } from '@thefibre/shared';

const BRAND = APPS['membership'];

// One nav, two chromes, six languages — labels come from the app catalog.
function buildNav(locale: Parameters<typeof t>[0]): SidebarNavSection[] {
  return [
  {
    items: [{ href: '/dashboard', label: t(locale, 'nav_membership'), icon: LayoutDashboard }],
  },
  {
    label: t(locale, 'nav_community'),
    items: [
      { href: '/members', label: t(locale, 'nav_members'), icon: UsersRound },
      { href: '/tiers', label: t(locale, 'nav_tiers'), icon: Layers },
      { href: '/products', label: t(locale, 'nav_products'), icon: Package },
    ],
  },
  {
    label: t(locale, 'nav_money'),
    items: [{ href: '/invoices', label: t(locale, 'nav_invoices'), icon: Receipt }],
  },
  {
    // Access lives ON products (2026-09-05) — no separate nav entry; the
    // sync overview is linked from the Products page.
    label: t(locale, 'nav_setup'),
    items: [{ href: '/settings', label: t(locale, 'nav_settings'), icon: Settings }],
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
