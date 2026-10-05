'use client';

// Search over the member list.
//
// Sjoerd: "members should be a fifth category on the menu with a search
// field."
//
// IT SEARCHES ONLY WHAT IS ALREADY ON THE PAGE. Name, place, bio, tags and
// categories — the things this viewer can already see. It never searches
// contact details, and that is not an oversight to tidy up later: a member
// who chose to hide their email would otherwise still be FINDABLE by it,
// which hands back the thing they withheld. Typing a full address and
// getting one hit tells you that address belongs to that person just as
// surely as displaying it would.
//
// Filtering is client-side on purpose. The server already decided who this
// viewer may see; narrowing a list they have been given needs no round trip
// and cannot widen it.

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { DirectoryMember } from '@/lib/portal-api';
import { MemberCard } from './member-card';

export function MemberSearch({ members }: { members: DirectoryMember[] }) {
  const [q, setQ] = useState('');

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((m) =>
      [m.display_name, m.city, m.country, m.bio, ...m.tags, ...m.categories]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [q, members]);

  return (
    <>
      <label className="mt-6 flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2">
        <Search size={15} strokeWidth={1.75} className="shrink-0 text-ink-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, place or interest"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
          aria-label="Search members"
        />
      </label>

      {shown.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-subtle">
          Nobody matches “{q.trim()}”. Search looks at names, places and interests — not contact
          details.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((m) => (
            <MemberCard key={m.person_id} member={m} />
          ))}
        </ul>
      )}
    </>
  );
}
