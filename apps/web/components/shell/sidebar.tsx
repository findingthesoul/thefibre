'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  Activity,
  Shield,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import type { SidebarMode } from '@/lib/prefs-shared';

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/organisations', label: 'Organisations', icon: Building2 },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/privacy', label: 'Privacy', icon: Shield },
];

export function Sidebar({ mode, version }: { mode: SidebarMode; version: string }) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);

  const expanded =
    mode === 'expanded' || (mode === 'hover' && hovered);
  const width = expanded ? 'w-56' : 'w-14';

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`${width} shrink-0 bg-surface-sunken border-r border-line flex flex-col transition-[width] duration-150 ease-out relative z-10`}
    >
      <div className="h-14 flex items-center px-3 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-yellow-300 text-ink font-semibold text-[11px] tracking-tight">
            tf
          </span>
          {expanded && (
            <span className="text-sm font-medium tracking-tight whitespace-nowrap">
              The Fibre
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 px-2 py-2 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`flex items-center gap-3 h-9 rounded-md px-2.5 text-sm transition-colors ${
                active
                  ? 'bg-surface-raised text-ink shadow-[0_0_0_1px_rgb(var(--line))]'
                  : 'text-ink-subtle hover:text-ink hover:bg-surface-raised/60'
              }`}
            >
              <Icon size={18} strokeWidth={1.75} className="shrink-0" />
              {expanded && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t border-line space-y-1">
        <Link
          href="/help"
          title="Help"
          className="flex items-center gap-3 h-9 rounded-md px-2.5 text-sm text-ink-subtle hover:text-ink hover:bg-surface-raised/60"
        >
          <HelpCircle size={18} strokeWidth={1.75} className="shrink-0" />
          {expanded && <span>Help</span>}
        </Link>
        {expanded && (
          <div className="px-2.5 pt-2 text-[10px] text-ink-muted tracking-wider uppercase">
            v{version}
          </div>
        )}
      </div>
    </aside>
  );
}
