// The way out, for somebody who has somewhere to go.
//
// Sjoerd asked for a hamburger top right, and it is here rather than in the
// You tab because that is where a person looks when they are trying to LEAVE
// a page — not three taps into their own settings.
//
// IT IS ABSENT FOR ALMOST EVERYONE, on purpose. The portal's whole premise is
// that a member has one identity and one list; a menu of apps nobody can open
// would be furniture. It renders only when the signed-in person actually
// holds a seat somewhere, which lib/app-access.ts reads from their own token.
//
// `<details>` rather than a popover with state: it opens on tap, closes on
// tap-away in every browser that matters, works before hydration, and is
// reachable by keyboard without anybody writing focus handling. The one thing
// it needs help with is closing after a click, which a plain link does by
// navigating away.

import { LayoutGrid } from 'lucide-react';
import type { ReachableApp } from '@/lib/app-access';

export function AppSwitcher({ apps, className }: { apps: ReachableApp[]; className?: string }) {
  if (!apps.length) return null;

  return (
    <details className={`relative ${className ?? ''}`}>
      <summary
        className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-sunken hover:text-ink [&::-webkit-details-marker]:hidden"
        aria-label="Your other apps"
      >
        <LayoutGrid className="h-5 w-5" aria-hidden />
      </summary>

      {/* Right-aligned: it sits at the right edge of a phone header, and a
          menu that opens leftward off-screen is the classic version of this. */}
      <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
        <p className="border-b border-line px-4 py-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Your apps
        </p>
        <ul>
          {apps.map((a) => (
            <li key={a.slug}>
              <a
                href={a.url}
                className="flex min-h-11 items-center px-4 text-sm text-ink hover:bg-surface-sunken"
              >
                {a.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
