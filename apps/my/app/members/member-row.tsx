// One member, as a ROW in the list.
//
// Sjoerd, 2026-10-12, looking at "Members of soul.com" on production with his
// own card showing his whole bio as raw tags: *"Does not wokr like this.
// Should e a list. Name, photo, location... Email and phone"* — and then
// *"Click on user - full bio"*.
//
// So the overview is a list and the bio is not in it. The bio belongs to the
// member's own page, where there is room to render it properly; in a list it
// was both unreadable and, since every stored bio is now HTML, literally
// tags on screen.
//
// THE WHOLE ROW IS THE LINK, which is why email and phone are TEXT here and
// not mailto:/tel: anchors. The card this replaces made the name a link
// precisely because anchors inside anchors misbehave, and that left a list
// where the tappable part was a few characters wide. A row that is entirely
// tappable is the phone-list shape (iOS Recents, Gmail), and the real
// mailto:/tel: links live one tap away on the member's page.
//
// What shows is still the server's decision: email and phone are null unless
// the directory settings and that member's own choice allow them. Nothing
// here widens anything — it moves what was already there into a row.

import Link from 'next/link';
import type { DirectoryMember } from '@/lib/portal-api';

export function MemberRow({
  member: m,
  href,
}: {
  member: DirectoryMember;
  href: string;
}) {
  const place = [m.city, m.country].filter(Boolean).join(', ');
  // Email and phone on one line under the place, in the order Sjoerd named
  // them. A member who shows neither simply has a shorter row.
  const contact = [m.email, m.phone].filter(Boolean).join(' · ');
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-sunken/60 sm:px-5"
      >
        {m.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.photo_url}
            alt=""
            className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-line"
          />
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-sm font-medium text-ink-subtle ring-1 ring-line"
          >
            {m.display_name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-ink">{m.display_name}</span>
          {place && <span className="block truncate text-xs text-ink-muted">{place}</span>}
          {contact && <span className="block truncate text-xs text-ink-muted">{contact}</span>}
        </span>
      </Link>
    </li>
  );
}
