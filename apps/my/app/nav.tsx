'use client';

// The portal's chrome: four destinations, two shapes.
//
// Mobile is `@thefibre/shared/ui/bottom-nav`, unchanged and uninstrumented —
// four items is exactly its no-"More"-sheet case, which is one reason the
// plan stops at four (docs/member-portal-plan.md §3).
//
// Desktop is a LOCAL rail rather than `ui/sidebar-shell`. The shared sidebar
// is organiser chrome: a brand tile, a workspace switcher, collapse
// preferences, a Help link. A member has one identity, one list and no
// preferences, so all of that would be dead furniture. This is the one place
// in the family where forking is the right call, and it is a fork of nothing
// — no second caller exists, because slice 6 of the plan retires the other
// two member pages INTO this one rather than alongside it.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, IdCard, Receipt, User } from 'lucide-react';
import { createBottomNav } from '@thefibre/shared/ui/bottom-nav';
import type { SidebarNavSection } from '@thefibre/shared/ui/sidebar-shell';

// Time first, because "what is next" is the question the page exists to
// answer. YOU last, because it is where you go once, not where you live.
export const NAV: SidebarNavSection[] = [
  {
    items: [
      { href: '/', label: 'Next', icon: CalendarDays },
      { href: '/memberships', label: 'Memberships', icon: IdCard },
      { href: '/purchases', label: 'Purchases', icon: Receipt },
      { href: '/you', label: 'You', icon: User },
    ],
  },
];

const BottomNavShell = createBottomNav(Link, usePathname);

export function MemberTabs({ version }: { version: string }) {
  return <BottomNavShell nav={NAV} version={version} />;
}

/** `/` matches everything by prefix, so it is the exception: exact only. */
function isActive(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function MemberRail() {
  const pathname = usePathname();
  return (
    <nav className="hidden md:flex w-56 shrink-0 flex-col gap-1 border-r border-line bg-surface-sunken p-3">
      {NAV[0]!.items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm ${
              active
                ? 'bg-surface text-ink ring-1 ring-line'
                : 'text-ink-subtle hover:text-ink'
            }`}
          >
            <Icon size={18} strokeWidth={active ? 2 : 1.75} className="shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
