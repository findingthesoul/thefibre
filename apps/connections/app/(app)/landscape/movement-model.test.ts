// The movement board's arithmetic. The direction test matters most: reversing
// the ladder the wrong way would draw every promotion as a demotion, and the
// board would look entirely plausible while saying the opposite of the truth.

import { describe, expect, it } from 'vitest';
import { board, groupOptions, valuesFor, type Facet, type PersonStanding } from './movement-model';

// The order the API returns steps in: highest first.
const LADDER_HIGH_FIRST = ['facilitator', 'contributor', 'returned', 'attended', 'touched', 'never'];

const people: PersonStanding[] = [
  { person_id: 'up', rung: 'contributor', was: 'returned' },
  { person_id: 'down', rung: 'attended', was: 'returned' },
  { person_id: 'new', rung: 'touched', was: null },
  { person_id: 'still', rung: 'returned', was: 'returned' },
];

describe('the board', () => {
  it('puts the lowest step on the left', () => {
    expect(board(LADDER_HIGH_FIRST, people).map((c) => c.rung)).toEqual([
      'never',
      'touched',
      'attended',
      'returned',
      'contributor',
      'facilitator',
    ]);
  });

  it('calls a move to a higher step up, and a lower one down', () => {
    const cards = board(LADDER_HIGH_FIRST, people).flatMap((c) => c.cards);
    const of = (id: string) => cards.find((c) => c.person_id === id)!;
    expect(of('up')).toMatchObject({ movement: 'up', from: 'returned' });
    expect(of('down')).toMatchObject({ movement: 'down', from: 'returned' });
    expect(of('new')).toMatchObject({ movement: 'new', from: null });
    expect(of('still')).toMatchObject({ movement: 'still', from: null });
  });

  it('counts who arrived in a step and who left it, so turnover shows even when the size did not change', () => {
    const cols = Object.fromEntries(board(LADDER_HIGH_FIRST, people).map((c) => [c.rung, c]));
    expect(cols.returned!.leftFrom).toBe(2);
    expect(cols.returned!.arrivedIn).toBe(0);
    expect(cols.contributor!.arrivedIn).toBe(1);
    expect(cols.touched!.arrivedIn).toBe(1);
  });

  it('can show only the people who moved, without changing the turnover counts', () => {
    const cols = board(LADDER_HIGH_FIRST, people, { onlyMoved: true });
    expect(cols.flatMap((c) => c.cards).map((c) => c.person_id).sort()).toEqual(['down', 'new', 'up']);
    expect(cols.find((c) => c.rung === 'returned')!.leftFrom).toBe(2);
  });

  it('lists movers before people who stood still within a step', () => {
    const mixed: PersonStanding[] = [
      { person_id: 'a', rung: 'returned', was: 'returned' },
      { person_id: 'b', rung: 'returned', was: 'attended' },
    ];
    const col = board(LADDER_HIGH_FIRST, mixed).find((c) => c.rung === 'returned')!;
    expect(col.cards.map((c) => c.person_id)).toEqual(['b', 'a']);
  });

  it('keeps only the people a filter lets through', () => {
    const ids = board(LADDER_HIGH_FIRST, people, { keep: (id) => id !== 'up' })
      .flatMap((c) => c.cards)
      .map((c) => c.person_id);
    expect(ids).not.toContain('up');
  });
});

describe('grouping', () => {
  const facets = new Map<string, Facet>([
    ['up', { person_id: 'up', tags: ['retreat', 'athens'], location: 'Amsterdam', companies: ['EBBF'] }],
    ['down', { person_id: 'down', tags: ['retreat'], location: 'Athens', companies: [] }],
    ['new', { person_id: 'new', tags: [], location: null, companies: ['EBBF'] }],
  ]);

  it('offers the busiest values first, counted over the people on the board', () => {
    expect(groupOptions(people, facets, 'tag')).toEqual([
      { value: 'retreat', count: 2 },
      { value: 'athens', count: 1 },
    ]);
  });

  it('lets one person sit in several groups', () => {
    expect(valuesFor(facets.get('up'), 'tag')).toEqual(['retreat', 'athens']);
  });

  it('puts somebody with no location in no location group, rather than in an empty one', () => {
    expect(groupOptions(people, facets, 'location').map((o) => o.value)).toEqual(['Amsterdam', 'Athens']);
  });

  it('offers nothing to group by when grouping is off', () => {
    expect(groupOptions(people, facets, 'none')).toEqual([]);
  });
});
