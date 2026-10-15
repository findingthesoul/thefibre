// Visitor filters on the public thread list embed (backlog 2jt, 2026-10-16):
// the person on the site narrows what is shown, by date, team, category or
// language. Pure, so the rules — month boundaries especially — are pinned by
// a test with a fixed `now` rather than by whatever day CI runs on.
//
// Client-side over the full list: GET /public/embed/threads returns every
// showable thread of the scope in one response, up to an explicit cap. When
// it says `truncated`, the embed shows no filters at all, so a filter is
// never applied to a partial set.

export type FilterKey = 'date' | 'team' | 'category' | 'language';
export const FILTER_KEYS: readonly FilterKey[] = ['date', 'team', 'category', 'language'];

export type DateChoice = 'upcoming' | 'this_month' | 'next_month' | 'past' | 'all';

export type FilterableItem = {
  starts_on: string | null;
  ends_on: string | null;
  team: { slug: string; name: string } | null;
  categories: { slug: string; name: string }[];
  language: string;
};

export type FilterChoice = {
  date?: DateChoice;
  team?: string;
  category?: string;
  language?: string;
};

/** `data-filters="date,team"` → the valid keys, in the canonical order. */
export function parseFilters(raw: string | null | undefined): FilterKey[] {
  const asked = new Set((raw ?? '').split(',').map((s) => s.trim()));
  return FILTER_KEYS.filter((k) => asked.has(k));
}

/** YYYY-MM-DD of a date, in UTC, for comparing against date-only fields. */
const day = (d: Date) => d.toISOString().slice(0, 10);
const monthOf = (iso: string) => iso.slice(0, 7);

function matchesDate(item: FilterableItem, choice: DateChoice, now: Date): boolean {
  if (choice === 'all') return true;
  const today = day(now);
  const end = item.ends_on ?? item.starts_on;
  const start = item.starts_on ?? item.ends_on;
  if (choice === 'upcoming') return !end || end >= today;
  if (choice === 'past') return !!end && end < today;
  if (!start) return false;
  const thisMonth = monthOf(today);
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return monthOf(start) === (choice === 'this_month' ? thisMonth : monthOf(day(next)));
}

export function applyFilters<T extends FilterableItem>(items: T[], choice: FilterChoice, now: Date): T[] {
  return items.filter(
    (it) =>
      (!choice.date || matchesDate(it, choice.date, now)) &&
      (!choice.team || it.team?.slug === choice.team) &&
      (!choice.category || it.categories.some((c) => c.slug === choice.category)) &&
      (!choice.language || it.language === choice.language),
  );
}

/** The choices a filter can offer: only values present in the list, so a
 *  visitor is never offered an empty result. A filter with fewer than two
 *  distinct values offers nothing (and is not shown). */
export function filterOptions(items: FilterableItem[]): {
  team: { value: string; label: string }[];
  category: { value: string; label: string }[];
  language: string[];
} {
  const teams = new Map<string, string>();
  const cats = new Map<string, string>();
  const langs = new Set<string>();
  for (const it of items) {
    if (it.team) teams.set(it.team.slug, it.team.name);
    for (const c of it.categories) cats.set(c.slug, c.name);
    if (it.language) langs.add(it.language);
  }
  const sorted = (m: Map<string, string>) =>
    [...m].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  return {
    team: teams.size > 1 ? sorted(teams) : [],
    category: cats.size > 1 ? sorted(cats) : [],
    language: langs.size > 1 ? [...langs].sort() : [],
  };
}
