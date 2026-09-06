'use client';

// Shim: the sidebar chrome lives in @thefibre/shared/ui/sidebar-shell
// (extraction phase 3). This file keeps only what is the platform's: the
// NAV, the admin sections, and the handwritten wordmark.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  LayoutGrid,
  Users,
  Building2,
  Activity,
  Shield,
  Settings,
  CalendarRange,
  UserCheck,
  Boxes,
  Layers,
  Receipt,
  ReceiptText,
  Percent,
  TrendingUp,
} from 'lucide-react';
import { createSidebarShell, type SidebarNavSection } from '@thefibre/shared/ui/sidebar-shell';
import { createBottomNav } from '@thefibre/shared/ui/bottom-nav';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { t } from '@/lib/i18n-ui';
import type { SidebarMode } from '@/lib/prefs-shared';
import { APPS } from '@thefibre/shared';

const BRAND = APPS['fibre-platform'];

// Labels come from the app catalog (i18n P3) — six languages, one nav.
const baseNav = (locale: Parameters<typeof t>[0]): SidebarNavSection[] => [
  {
    items: [{ href: '/dashboard', label: t(locale, 'nav_home'), icon: LayoutDashboard }],
  },
  {
    label: t(locale, 'nav_contact_graph'),
    items: [
      { href: '/contacts', label: t(locale, 'nav_contacts'), icon: Users },
      { href: '/organisations', label: t(locale, 'nav_organisations'), icon: Building2 },
    ],
  },
  {
    label: t(locale, 'nav_programmes'),
    items: [
      { href: '/programmes', label: t(locale, 'nav_programmes'), icon: CalendarRange },
      { href: '/activity', label: t(locale, 'nav_activity'), icon: Activity },
    ],
  },
  {
    label: t(locale, 'nav_workspace'),
    items: [
      { href: '/privacy', label: t(locale, 'nav_privacy'), icon: Shield },
      { href: '/settings', label: t(locale, 'nav_settings'), icon: Settings },
    ],
  },
];

const SidebarShell = createSidebarShell(Link, usePathname);
const BottomNavShell = createBottomNav(Link, usePathname);

// One nav for both chromes: the sidebar (≥md) and the bottom tab bar.
function buildSections(
  locale: Parameters<typeof t>[0],
  isSuperAdmin: boolean,
  isWorkspaceAdmin: boolean,
): SidebarNavSection[] {
  return [
    ...baseNav(locale),
    ...(isSuperAdmin || isWorkspaceAdmin
      ? [
          {
            label: t(locale, 'nav_admin'),
            items: [
              ...(isWorkspaceAdmin
                ? [{ href: '/settings/apps', label: t(locale, 'nav_apps'), icon: LayoutGrid }]
                : []),
              ...(isSuperAdmin
                ? [
                    { href: '/admin/access-requests', label: t(locale, 'nav_access_requests'), icon: UserCheck },
                    { href: '/admin/workspaces', label: t(locale, 'nav_workspaces'), icon: Layers },
                    { href: '/admin/plans', label: t(locale, 'nav_plans'), icon: Receipt },
                    { href: '/admin/economics', label: t(locale, 'nav_economics'), icon: TrendingUp },
                    { href: '/admin/invoices', label: t(locale, 'nav_invoices'), icon: ReceiptText },
                    { href: '/admin/vat', label: t(locale, 'nav_vat'), icon: Percent },
                    { href: '/admin/apps', label: t(locale, 'nav_app_registry'), icon: Boxes },
                  ]
                : []),
            ],
          },
        ]
      : []),
  ];
}

export function Sidebar({
  mode,
  version,
  isSuperAdmin = false,
  isWorkspaceAdmin = false,
}: {
  mode: SidebarMode;
  version: string;
  isSuperAdmin?: boolean;
  isWorkspaceAdmin?: boolean;
}) {
  const locale = useLocale();
  return (
    <SidebarShell
      nav={buildSections(locale, isSuperAdmin, isWorkspaceAdmin)}
      brandLetters={BRAND.brandLetters}
      brandName={BRAND.name}
      brandContent={
        // Handwritten wordmark instead of plain text when the sidebar is
        // open. Same asset as in the auth emails — single source of truth
        // via packages/shared/branding.ts.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/brand/the-fibre.png"
          alt={BRAND.name}
          className="h-6 w-auto select-none"
          draggable={false}
        />
      }
      mode={mode}
      version={version}
    />
  );
}

// The same nav as a bottom tab bar — rendered by the layout below `md`.
export function MobileNav({
  version,
  isSuperAdmin = false,
  isWorkspaceAdmin = false,
}: {
  version: string;
  isSuperAdmin?: boolean;
  isWorkspaceAdmin?: boolean;
}) {
  const locale = useLocale();
  return <BottomNavShell nav={buildSections(locale, isSuperAdmin, isWorkspaceAdmin)} version={version} />;
}
