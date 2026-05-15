'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type TabDef = {
  href: string;
  label: string;
};

export function TabNav({ tabs }: { tabs: TabDef[] }) {
  const pathname = usePathname();
  return (
    <nav className="mt-6 border-b border-line">
      <ul className="flex gap-1 -mb-px overflow-x-auto">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`inline-block px-3 py-2 text-sm border-b-2 transition-colors ${
                  active
                    ? 'border-ink text-ink'
                    : 'border-transparent text-ink-subtle hover:text-ink hover:border-line-strong'
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
