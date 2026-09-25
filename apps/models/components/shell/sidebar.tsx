'use client';

// Shim: the sidebar chrome lives in @thefibre/shared/ui/sidebar-shell. This
// file keeps only what is the app's: the NAV.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Settings } from 'lucide-react';
import { createSidebarShell, type SidebarNavSection } from '@thefibre/shared/ui/sidebar-shell';
import { createBottomNav } from '@thefibre/shared/ui/bottom-nav';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { t } from '@/lib/i18n-ui';
import type { SidebarMode } from '@/lib/prefs-shared';
import { APPS } from '@thefibre/shared';

const BRAND = APPS['fibre-models'];

function buildNav(locale: Parameters<typeof t>[0]): SidebarNavSection[] {
  return [
    { items: [{ href: '/dashboard', label: t(locale, 'nav_models'), icon: LayoutDashboard }] },
    { items: [{ href: '/settings', label: t(locale, 'nav_settings'), icon: Settings }] },
  ];
}

const SidebarShell = createSidebarShell(Link, usePathname);
const BottomNavShell = createBottomNav(Link, usePathname);

export function Sidebar({ mode, version, brandTileSrc }: { mode: SidebarMode; version: string; brandTileSrc?: string | null }) {
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

export function MobileNav({ version }: { version: string }) {
  const locale = useLocale();
  return <BottomNavShell nav={buildNav(locale)} version={version} />;
}
