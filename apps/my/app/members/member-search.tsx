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
import { bioToPlain } from '@thefibre/shared';
import { richTextToPlain } from '@thefibre/shared/rich-text-plain';
import { ROW_LIST } from '@thefibre/shared/ui/recipes';
import type { DirectoryMember } from '@/lib/portal-api';
import { MemberRow } from './member-row';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { t } from '@/lib/i18n';

export function MemberSearch({
  members,
  workspaceId,
}: {
  members: DirectoryMember[];
  /** So each row can link to that member's page in this community. */
  workspaceId: string;
}) {
  const [q, setQ] = useState('');
  const locale = useLocale();

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((m) =>
      // The bio as TEXT. Every stored bio is HTML now, so searching the
      // stored value matched markup: "p" found everybody, and a word that
      // happened to be a tag name found people whose bios did not contain
      // it. Still searched, though it is no longer shown here — it is on the
      // member's own page, and this searches what the viewer can see.
      [
        m.display_name,
        m.city,
        m.country,
        bioToPlain(m.bio, richTextToPlain),
        ...m.tags,
        ...m.categories,
      ]
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
          placeholder={t(locale, 'members_search_placeholder')}
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
          aria-label={t(locale, 'members_search_label')}
        />
      </label>

      {shown.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-subtle">
          {t(locale, 'members_no_match', { q: q.trim() })}
        </p>
      ) : (
        // ROW_LIST: edge to edge on a phone, a card from `sm` up. The
        // recipe cancels the page's own side padding, which is why the shell
        // and this list have to agree on it — see PAGE_PX in
        // packages/shared/src/ui/recipes.ts.
        <ul className={`mt-4 ${ROW_LIST}`}>
          {shown.map((m) => (
            <MemberRow
              key={m.person_id}
              member={m}
              href={`/members/${workspaceId}/${m.person_id}`}
            />
          ))}
        </ul>
      )}
    </>
  );
}
