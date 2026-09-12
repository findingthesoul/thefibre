'use client';

// Shim: the sidebar chrome lives in @thefibre/shared/ui/sidebar-shell.
// This file keeps only what is Connections': the NAV.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, Bell, CalendarCheck, Users, DoorOpen } from 'lucide-react';
import {
  createSidebarShell,
  type SidebarNavSection,
} from '@thefibre/shared/ui/sidebar-shell';
import { createBottomNav } from '@thefibre/shared/ui/bottom-nav';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { t } from '@/lib/i18n-ui';
import type { SidebarMode } from '@/lib/prefs-shared';
import { APPS } from '@thefibre/shared';

// The slug stays fibre-sales — it tags curator data and never changes. The
// display name is Connections; see docs/connections-naming.md.
const BRAND = APPS['fibre-sales'];

// Deliberately short. The landscape IS the app; everything else is a lens on
// it or a queue derived from it, so a nav with eight entries would be
// describing a different product from the one in docs/connections-model.md.
function buildNav(locale: Parameters<typeof t>[0]): SidebarNavSection[] {
  // Today first: it is the surface with a reason to open it every morning.
  // The landscape is for orientation and changes slowly; the queue changes
  // daily (docs/connections-mobile.md §1, the shape vs the queue).
  return [
    {
      items: [
        { href: '/today', label: t(locale, 'nav_today'), icon: CalendarCheck },
        { href: '/attention', label: t(locale, 'nav_attention'), icon: Bell },
      ],
    },
    {
      items: [
        { href: '/landscape', label: t(locale, 'nav_landscape'), icon: Map },
        { href: '/people', label: t(locale, 'nav_people'), icon: Users },
        { href: '/entries', label: t(locale, 'nav_entries'), icon: DoorOpen },
      ],
    },
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

export function MobileNav({ version }: { version: string }) {
  const locale = useLocale();
  return <BottomNavShell nav={buildNav(locale)} version={version} />;
}
