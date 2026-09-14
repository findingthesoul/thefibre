// The movement board's arithmetic, apart from its drawing.
//
// Sjoerd, 2026-09-14: *"I want to see the movement — like columns next to each
// other... and maybe there could be sub categories (extra column) like tag,
// location, company"*.
//
// No directive on purpose: pure functions, read by a client component and by
// tests, and a module both sides read must carry none (see axes.ts).

export type GroupBy = 'none' | 'tag' | 'location' | 'company';

export type PersonStanding = { person_id: string; rung: string; was: string | null };

export type Facet = {
  person_id: string;
  tags: string[];
  location: string | null;
  companies: string[];
};

/** The values one person carries for a grouping. A person can be in several. */
export function valuesFor(f: Facet | undefined, by: GroupBy): string[] {
  if (!f || by === 'none') return [];
  if (by === 'tag') return f.tags;
  if (by === 'company') return f.companies;
  return f.location ? [f.location] : [];
}

/**
 * The values a grouping offers, busiest first, among the people on the board.
 *
 * Counted over the people actually on this reading rather than over every
 * person the workspace holds, so a tag carried only by somebody outside it is
 * not offered as a choice that shows an empty board.
 */
export function groupOptions(
  people: readonly PersonStanding[],
  facets: ReadonlyMap<string, Facet>,
  by: GroupBy,
): { value: string; count: number }[] {
  if (by === 'none') return [];
  const counts = new Map<string, number>();
  for (const p of people) {
    for (const v of new Set(valuesFor(facets.get(p.person_id), by))) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export type Card = {
  person_id: string;
  /** Where they stood at the start of the period, when that differs. */
  from: string | null;
  /** 'up' / 'down' along the ladder, 'new' for somebody who arrived, or 'still'. */
  movement: 'up' | 'down' | 'new' | 'still';
};

export type Column = { rung: string; cards: Card[]; arrivedIn: number; leftFrom: number };

/**
 * The board: one column per step, lowest step on the left so moving right is
 * moving on — the direction people read progress in.
 *
 * `ladderHighFirst` is the order the API returns steps in; it is reversed here
 * rather than at every call site, because getting it backwards would draw every
 * promotion as a demotion and nothing would look wrong.
 *
 * A step also says how many arrived IN over the period and how many LEFT it,
 * because a column whose size did not change can still have turned over.
 */
export function board(
  ladderHighFirst: readonly string[],
  people: readonly PersonStanding[],
  opts: { keep?: (personId: string) => boolean; onlyMoved?: boolean } = {},
): Column[] {
  const ladder = [...ladderHighFirst].reverse();
  const rank = (r: string) => ladder.indexOf(r);
  const cols = new Map<string, Column>(
    ladder.map((rung) => [rung, { rung, cards: [], arrivedIn: 0, leftFrom: 0 }]),
  );

  for (const p of people) {
    if (opts.keep && !opts.keep(p.person_id)) continue;
    const col = cols.get(p.rung);
    if (!col) continue;

    let movement: Card['movement'];
    if (p.was === null) movement = 'new';
    else if (p.was === p.rung) movement = 'still';
    else movement = rank(p.rung) > rank(p.was) ? 'up' : 'down';

    if (movement !== 'still') {
      col.arrivedIn += 1;
      if (p.was !== null) {
        const left = cols.get(p.was);
        if (left) left.leftFrom += 1;
      }
    }
    if (opts.onlyMoved && movement === 'still') continue;
    col.cards.push({ person_id: p.person_id, from: movement === 'still' ? null : p.was, movement });
  }

  // Movers first within a step — the board exists to show them — then stable.
  const weight: Record<Card['movement'], number> = { up: 0, down: 1, new: 2, still: 3 };
  for (const c of cols.values()) c.cards.sort((a, b) => weight[a.movement] - weight[b.movement]);
  return [...cols.values()];
}
