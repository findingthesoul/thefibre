'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { PersonLink } from '@/components/person-popup';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n-ui';
// Band labels for whichever axis the landscape sent us in on. Imported
// rather than redeclared: this file used to carry its own maturity-only
// copy, and a second copy of a label map is how two surfaces start
// disagreeing about what a band is called. ../landscape/axes holds no JSX
// precisely so a 'use client' file like this one can read it.
import { bandName, type Axis, type BandLabels } from '../landscape/axes';

export type Person = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  country: string | null;
  created_at: string;
};

export function displayName(p: Person): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || p.id.slice(0, 8);
}

export function PeopleList({
  items,
  q,
  total,
  rungById,
  axis,
  band,
  bandTotal,
  tagName,
  tagTotal,
  tagId,
  labels,
  hasMore,
  nextPages,
  locale,
}: {
  items: Person[];
  q: string;
  /** People in the workspace, or null when it could not be read. */
  total: number | null;
  /** person id → band ON `axis`. Empty when the landscape read failed; a row
   *  whose id is absent simply shows no band rather than a guess. */
  rungById: Record<string, string>;
  /** Which question the bands answer. Arrives in the URL from the landscape. */
  axis: Axis;
  /** The band being filtered to, or null for everybody. */
  band: string | null;
  /** What this workspace calls its bands. Sparse; absent falls back. */
  labels?: BandLabels;
  /** How many people are in `band` workspace-wide — from the landscape, not
   *  from the loaded rows, so the number is the band's true size. */
  bandTotal: number | null;
  /** The tag being filtered to, when the tag cloud sent us here. */
  tagName: string | null;
  /** Carried so search and Load more keep the filter. */
  tagId: string | null;
  /** How many people carry it workspace-wide, for the same reason as above. */
  tagTotal: number | null;
  hasMore: boolean;
  nextPages: number;
  locale: Locale;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(q);
  const [pending, startTransition] = useTransition();
  // The URL is the search state, so a result is linkable and survives a
  // reload. Typing only pushes after a pause — one navigation per thought,
  // not one per keystroke.
  const applied = useRef(q);

  useEffect(() => {
    applied.current = q;
    setTerm(q);
  }, [q]);

  useEffect(() => {
    if (term === applied.current) return;
    const id = setTimeout(() => {
      applied.current = term;
      // The band filter survives a search: narrowing "who is in touch" down
      // to one name is the point, and dropping the filter on the first
      // keystroke would silently widen the list under the person typing.
      const qs = new URLSearchParams();
      if (term.trim()) qs.set('q', term.trim());
      if (band) {
        qs.set('axis', axis);
        qs.set('band', band);
      }
      if (tagId) qs.set('tag', tagId);
      startTransition(() => {
        router.replace(qs.toString() ? `/people?${qs.toString()}` : '/people');
      });
    }, 300);
    return () => clearTimeout(id);
  }, [term, router, axis, band, tagId]);

  const moreHref = `/people?${new URLSearchParams({
    ...(q ? { q } : {}),
    ...(band ? { axis, band } : {}),
    ...(tagId ? { tag: tagId } : {}),
    pages: String(nextPages),
  }).toString()}`;

  const bandLabel = (b: string) => bandName(locale, labels, axis, b);

  return (
    <div className="mt-6">
      <div className="relative">
        <Search
          size={15}
          strokeWidth={1.75}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t(locale, 'people_search_ph')}
          aria-label={t(locale, 'search')}
          className="w-full rounded-md border border-line bg-surface-raised py-2 pl-9 pr-3 text-sm placeholder:text-ink-muted focus:border-line-strong focus:outline-none"
        />
      </div>

      {/* Arriving from a band, the first thing to establish is WHICH band —
          otherwise a shortened list reads as a broken one. The way out is on
          the same line, because a filter you cannot see how to leave is a
          trap rather than a lens. */}
      {(band || tagName) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {band && (
            <span className="rounded-full border border-ink bg-ink px-3 py-1 text-xs text-surface">
              {bandLabel(band)}
              {bandTotal !== null && <span className="ml-1.5 tabular-nums">{bandTotal}</span>}
            </span>
          )}
          {/* Both filters can be on at once and both are named, because a
              list narrowed twice with only one label showing reads as broken. */}
          {tagName && (
            <span className="rounded-full border border-ink bg-ink px-3 py-1 text-xs text-surface">
              {tagName}
              {tagTotal !== null && <span className="ml-1.5 tabular-nums">{tagTotal}</span>}
            </span>
          )}
          <Link
            href={q ? `/people?q=${encodeURIComponent(q)}` : '/people'}
            className="text-xs text-ink-muted underline underline-offset-2 hover:text-ink"
          >
            {t(locale, 'people_show_everyone')}
          </Link>
        </div>
      )}

      <div className="mt-2 h-4 text-xs text-ink-muted tabular-nums">
        {/* With a band filter on, `total` is the whole workspace and saying
            "3 of 12" would be comparing the filtered list against the
            unfiltered population. The chip above already carries the band's
            size, so this line stands down to a plain count. */}
        {pending
          ? t(locale, 'loading')
          : band || tagName
            ? items.length > 0
              ? `${items.length} ${t(locale, 'landscape_people')}`
              : ''
            : total !== null && items.length < total
              ? t(locale, 'people_showing', { shown: items.length, total })
              : items.length > 0
                ? `${items.length} ${t(locale, 'landscape_people')}`
                : ''}
      </div>

      {items.length === 0 && (
        <p className="mt-6 text-sm text-ink-muted">
          {band || tagName
            ? t(locale, 'people_none_in_band')
            : q
              ? t(locale, 'people_none')
              : t(locale, 'landscape_empty')}
        </p>
      )}

      {items.length > 0 && (
        // Rows, not a table: at 375px a table either scrolls sideways or
        // drops the column that mattered.
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-raised">
          {items.map((p) => {
            const rung = rungById[p.id];
            return (
              <li key={p.id}>
                <PersonLink
                  personId={p.id}
                  className="flex items-baseline justify-between gap-3 px-4 py-3 hover:bg-surface-sunken"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{displayName(p)}</span>
                    {p.email && (
                      <span className="block truncate text-xs text-ink-subtle">{p.email}</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2 text-xs text-ink-muted">
                    {/* Where they stand, in words. Deliberately not a colour
                        and not a score — nothing on this ladder is good or
                        bad, and green/amber/red would say otherwise about
                        people. */}
                    {rung && (
                      <span className="rounded-full border border-line px-2 py-0.5">
                        {bandLabel(rung)}
                      </span>
                    )}
                    {p.country && <span>{p.country}</span>}
                  </span>
                </PersonLink>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <div className="mt-4">
          <Link
            href={moreHref}
            scroll={false}
            className="inline-flex h-8 items-center rounded-md border border-line bg-surface-raised px-3 text-sm hover:bg-surface-sunken"
          >
            {t(locale, 'load_more')}
          </Link>
        </div>
      )}
    </div>
  );
}
