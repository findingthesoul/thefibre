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
import { CalendarDays, CalendarPlus, FolderOpen, Home, IdCard, Receipt, User, Users, ShoppingBag } from 'lucide-react';
import { createBottomNav } from '@thefibre/shared/ui/bottom-nav';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import type { Locale } from '@thefibre/shared/i18n';
import { t } from '@/lib/i18n';
import { Wordmark } from './wordmark';
import type { SidebarNavSection } from '@thefibre/shared/ui/sidebar-shell';

// Time first, because "what is next" is the question the page exists to
// answer. YOU last, because it is where you go once, not where you live.
//
// MEMBERS is always present rather than conditional, and that is deliberate.
// Hiding it from people whose communities have no directory would mean the
// nav changes shape depending on data they cannot see, and somebody told
// "look under Members" would find no Members. The page answers honestly
// instead: it redirects to the one list, asks which when there are several,
// and says plainly when there are none.
//
// UPCOMING IS THE EXCEPTION, and on Sjoerd's word (2026-10-14): only somebody
// whose membership carries a team calendar sees it. Unlike Members it is not
// an empty page for everybody else — it is a thing they do not have, the way
// a person without a membership has no member price. It follows the
// ENTITLEMENT, not the list, so the nav does not change shape with the month.
//
// THE ORDER IS SJOERD'S (2026-10-14): "Home (new) · Next · Upcoming ·
// Members · ---- · You · Memberships · Purchases". Two groups: what is going
// on in your community, then what is yours. The groups are two SECTIONS, so
// the rail draws a line between them and the phone's More sheet keeps them
// apart; the phone bar itself shows the first four.
//
// HOME is the community page (item 4), and it is there only for somebody who
// has one — a live member of at least one community. Without one there is no
// Home at all and Next comes first: a Home that could only say "you have no
// community" would be a tab that is always empty. With several communities
// Home lists them.
//
// UPCOMING stays conditional on a team calendar, as before.
//
// FILES (Sjoerd 2ij, 2026-10-16) is always present, like Members: the page
// says plainly when there is nothing yet.
//
// FILES AND SHOP MOVED UP (Sjoerd, 2026-10-17: "files and shop can go above
// the line (under members)"): Home · Next · Upcoming · Members · Files · Shop
// · ---- · You · Memberships · Purchases. The phone bar still shows the
// first four items; Files and Shop open from More, where the sheet lists
// them in the first group, above the line, as on the rail.
export function navFor({
  upcoming,
  communities = 0,
  locale = 'en',
}: {
  upcoming: boolean;
  communities?: number;
  locale?: Locale;
}): SidebarNavSection[] {
  return [
    {
      items: [
        ...(communities > 0 ? [{ href: '/community', label: t(locale, 'nav_home'), icon: Home }] : []),
        { href: '/', label: t(locale, 'nav_next'), icon: CalendarDays },
        ...(upcoming ? [{ href: '/upcoming', label: t(locale, 'nav_upcoming'), icon: CalendarPlus }] : []),
        { href: '/members', label: t(locale, 'nav_members'), icon: Users },
        { href: '/files', label: t(locale, 'nav_files'), icon: FolderOpen },
        { href: '/shop', label: t(locale, 'nav_shop'), icon: ShoppingBag },
      ],
    },
    {
      items: [
        { href: '/you', label: t(locale, 'nav_you'), icon: User },
        { href: '/memberships', label: t(locale, 'nav_memberships'), icon: IdCard },
        { href: '/purchases', label: t(locale, 'nav_purchases'), icon: Receipt },
      ],
    },
  ];
}

/** The nav for somebody with no community and no team calendar — kept for
 *  any reader that wants the plain shape. */
export const NAV: SidebarNavSection[] = navFor({ upcoming: false, communities: 0 });

const BottomNavShell = createBottomNav(Link, usePathname);

export function MemberTabs({ version, upcoming, communities }: { version: string; upcoming: boolean; communities: number }) {
  const locale = useLocale();
  return <BottomNavShell nav={navFor({ upcoming, communities, locale })} version={version} />;
}

/** `/` matches everything by prefix, so it is the exception: exact only. */
function isActive(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function MemberRail({ upcoming, communities }: { upcoming: boolean; communities: number }) {
  const pathname = usePathname();
  const locale = useLocale();
  const nav = navFor({ upcoming, communities, locale });
  return (
    <nav className="hidden md:flex w-56 shrink-0 flex-col gap-1 border-r border-line bg-surface-sunken p-3">
      {/* Home, and the only thing on this surface that says whose app it is.
          A rail of four icons could belong to anything. */}
      <Link href="/" className="mb-3 flex min-h-11 items-center px-3">
        <Wordmark className="h-8" />
      </Link>
      {nav.flatMap((section, si) => [
        // The line between the two groups.
        ...(si > 0 ? [<div key={`sep-${si}`} className="my-2 border-t border-line" aria-hidden />] : []),
        ...section.items.map((item) => {
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
        }),
      ])}
    </nav>
  );
}
