'use client';

// The visitor's filter row on the public thread list embed, and the cards it
// narrows (backlog 2jt). The cards are rendered on the server and passed in
// with the facts each filter needs; this only decides which to show. The
// choice lives in the URL hash, so a shared link reopens filtered.

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SelectField } from '@thefibre/shared/ui/fields';
import { applyFilters, filterOptions, type DateChoice, type FilterChoice, type FilterKey, type FilterableItem } from '@/lib/embed-filters';
import { t, LOCALE_LABELS, isLocale, type Locale } from '@/lib/i18n';

export type Card = FilterableItem & { id: string; node: ReactNode };

function readHash(): FilterChoice {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const out: FilterChoice = {};
  const date = p.get('date') as DateChoice | null;
  if (date && ['upcoming', 'this_month', 'next_month', 'past', 'all'].includes(date)) out.date = date;
  for (const k of ['team', 'category', 'language'] as const) {
    const v = p.get(k);
    if (v) out[k] = v;
  }
  return out;
}

export function FilteredList({
  cards,
  filters,
  locale,
  compact,
}: {
  cards: Card[];
  filters: FilterKey[];
  locale: Locale;
  compact: boolean;
}) {
  const options = useMemo(() => filterOptions(cards), [cards]);
  // Upcoming by default when the date filter is on — a list a visitor opens
  // is about what they can still go to.
  const [choice, setChoice] = useState<FilterChoice>(filters.includes('date') ? { date: 'upcoming' } : {});
  useEffect(() => {
    const fromHash = readHash();
    if (Object.keys(fromHash).length) setChoice((c) => ({ ...c, ...fromHash }));
  }, []);
  function set(k: keyof FilterChoice, v: string) {
    const next = { ...choice, [k]: v || undefined } as FilterChoice;
    setChoice(next);
    const p = new URLSearchParams();
    for (const [key, val] of Object.entries(next)) if (val) p.set(key, val);
    window.history.replaceState(null, '', `#${p.toString()}`);
  }

  const shown = applyFilters(cards, choice, new Date());
  const show = (k: FilterKey) =>
    filters.includes(k) &&
    (k === 'date' || (k === 'team' ? options.team.length : k === 'category' ? options.category.length : options.language.length) > 0);

  return (
    <div>
      {filters.some(show) && (
        <div className="te-filters mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {show('date') && (
            <SelectField
              label={t(locale, 'filter_when')}
              value={choice.date ?? 'all'}
              onChange={(e) => set('date', e.target.value)}
              options={[
                { value: 'upcoming', label: t(locale, 'filter_upcoming') },
                { value: 'this_month', label: t(locale, 'filter_this_month') },
                { value: 'next_month', label: t(locale, 'filter_next_month') },
                { value: 'past', label: t(locale, 'filter_past') },
                { value: 'all', label: t(locale, 'filter_any_time') },
              ]}
            />
          )}
          {show('team') && (
            <SelectField
              label={t(locale, 'filter_team')}
              value={choice.team ?? ''}
              onChange={(e) => set('team', e.target.value)}
              options={[{ value: '', label: t(locale, 'filter_all') }, ...options.team]}
            />
          )}
          {show('category') && (
            <SelectField
              label={t(locale, 'filter_category')}
              value={choice.category ?? ''}
              onChange={(e) => set('category', e.target.value)}
              options={[{ value: '', label: t(locale, 'filter_all') }, ...options.category]}
            />
          )}
          {show('language') && (
            <SelectField
              label={t(locale, 'filter_language')}
              value={choice.language ?? ''}
              onChange={(e) => set('language', e.target.value)}
              options={[
                { value: '', label: t(locale, 'filter_all') },
                ...options.language.map((l) => ({ value: l, label: isLocale(l) ? LOCALE_LABELS[l] : l })),
              ]}
            />
          )}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="te-empty text-sm text-ink-subtle">{t(locale, 'filter_nothing')}</p>
      ) : (
        <ul className={`te-list ${compact ? 'space-y-2' : 'space-y-3'}`}>
          {/* Each node IS the card's <li class="te-card"> — the same markup
              as before filters existed, so a site's custom CSS still fits. */}
          {shown.map((c) => (
            <Fragment key={c.id}>{c.node}</Fragment>
          ))}
        </ul>
      )}
    </div>
  );
}
