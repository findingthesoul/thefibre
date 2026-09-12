'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n-ui';

export type Person = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  country: string | null;
  created_at: string;
};

// The maturity ladder's labels. Explicit map, never a computed
// t(locale, `rung_${x}`) — the catalog is typed so a missing translation is a
// compile error, and a template key throws that guarantee away. Same keys the
// landscape's bands render; the labels live in the catalog once and this is a
// second reference to them, not a second copy.
const RUNG_KEYS = {
  facilitator: 'rung_facilitator',
  contributor: 'rung_contributor',
  returned: 'rung_returned',
  attended: 'rung_attended',
  touched: 'rung_touched',
  never: 'rung_never',
} as const;

type Rung = keyof typeof RUNG_KEYS;

function isRung(v: string | undefined): v is Rung {
  return !!v && v in RUNG_KEYS;
}

export function displayName(p: Person): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || p.id.slice(0, 8);
}

export function PeopleList({
  items,
  q,
  total,
  rungById,
  hasMore,
  nextPages,
  locale,
}: {
  items: Person[];
  q: string;
  /** People in the workspace, or null when it could not be read. */
  total: number | null;
  /** person id → maturity band. Empty when the landscape read failed; a row
   *  whose id is absent simply shows no band rather than a guess. */
  rungById: Record<string, string>;
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
      const qs = new URLSearchParams();
      if (term.trim()) qs.set('q', term.trim());
      startTransition(() => {
        router.replace(qs.toString() ? `/people?${qs.toString()}` : '/people');
      });
    }, 300);
    return () => clearTimeout(id);
  }, [term, router]);

  const moreHref = `/people?${new URLSearchParams({
    ...(q ? { q } : {}),
    pages: String(nextPages),
  }).toString()}`;

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

      <div className="mt-2 h-4 text-xs text-ink-muted tabular-nums">
        {pending
          ? t(locale, 'loading')
          : total !== null && items.length < total
            ? t(locale, 'people_showing', { shown: items.length, total })
            : items.length > 0
              ? `${items.length} ${t(locale, 'landscape_people')}`
              : ''}
      </div>

      {items.length === 0 && (
        <p className="mt-6 text-sm text-ink-muted">
          {q ? t(locale, 'people_none') : t(locale, 'landscape_empty')}
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
                <Link
                  href={`/people/${p.id}`}
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
                    {isRung(rung) && (
                      <span className="rounded-full border border-line px-2 py-0.5">
                        {t(locale, RUNG_KEYS[rung])}
                      </span>
                    )}
                    {p.country && <span>{p.country}</span>}
                  </span>
                </Link>
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
