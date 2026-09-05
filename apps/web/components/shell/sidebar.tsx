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
import type { SidebarMode } from '@/lib/prefs-shared';
import { APPS } from '@thefibre/shared';

const BRAND = APPS['fibre-platform'];

const NAV: SidebarNavSection[] = [
  {
    items: [{ href: '/dashboard', label: 'Home', icon: LayoutDashboard }],
  },
  {
    label: 'Contact graph',
    items: [
      { href: '/contacts', label: 'Contacts', icon: Users },
      { href: '/organisations', label: 'Organisations', icon: Building2 },
    ],
  },
  {
    label: 'Programmes',
    items: [
      { href: '/programmes', label: 'Programmes', icon: CalendarRange },
      { href: '/activity', label: 'Activity', icon: Activity },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { href: '/privacy', label: 'Privacy', icon: Shield },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const SidebarShell = createSidebarShell(Link, usePathname);
const BottomNavShell = createBottomNav(Link, usePathname);

// One nav for both chromes: the sidebar (≥md) and the bottom tab bar.
function buildSections(isSuperAdmin: boolean, isWorkspaceAdmin: boolean): SidebarNavSection[] {
  return [
    ...NAV,
    ...(isSuperAdmin || isWorkspaceAdmin
      ? [
          {
            label: 'Admin',
            items: [
              ...(isWorkspaceAdmin
                ? [{ href: '/settings/apps', label: 'Apps', icon: LayoutGrid }]
                : []),
              ...(isSuperAdmin
                ? [
                    { href: '/admin/access-requests', label: 'Access requests', icon: UserCheck },
                    { href: '/admin/workspaces', label: 'Workspaces', icon: Layers },
                    { href: '/admin/plans', label: 'Plans', icon: Receipt },
                    { href: '/admin/economics', label: 'Economics', icon: TrendingUp },
                    { href: '/admin/invoices', label: 'Invoices', icon: ReceiptText },
                    { href: '/admin/vat', label: 'VAT', icon: Percent },
                    { href: '/admin/apps', label: 'App registry', icon: Boxes },
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
  return (
    <SidebarShell
      nav={buildSections(isSuperAdmin, isWorkspaceAdmin)}
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
  return <BottomNavShell nav={buildSections(isSuperAdmin, isWorkspaceAdmin)} version={version} />;
}
