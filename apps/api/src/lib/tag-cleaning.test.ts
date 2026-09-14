import { describe, expect, it } from 'vitest';
import { findDoubles, findStale, findUnused, mentions, singularKey, type TagFacts } from './tag-cleaning.js';

let n = 0;
const tag = (name: string, over: Partial<TagFacts> = {}): TagFacts => ({
  id: `t${++n}`,
  name,
  organisation_id: null,
  people: 1,
  last_used: '2026-09-01T00:00:00Z',
  ...over,
});

describe('doubles', () => {
  it('groups tags that differ only in case, spaces or hyphens', () => {
    const groups = findDoubles([tag('Deep Democracy'), tag('deep-democracy'), tag('facilitation')]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.reason).toBe('spelling');
    expect([groups[0]!.keep, ...groups[0]!.others].map((t) => t.name).sort()).toEqual([
      'Deep Democracy',
      'deep-democracy',
    ]);
  });

  it('groups a plural with its singular', () => {
    const groups = findDoubles([tag('retreat'), tag('retreats'), tag('workshop'), tag('workshops')]);
    expect(groups.map((g) => g.reason)).toEqual(['plural', 'plural']);
  });

  it('groups a one-letter typo in a long word, and not in a short one', () => {
    expect(findDoubles([tag('facilitation'), tag('facilitaton')])[0]?.reason).toBe('typo');
    expect(findDoubles([tag('art'), tag('arc')])).toEqual([]);
  });

  it('keeps the most used one', () => {
    const [g] = findDoubles([tag('Retreat', { people: 2 }), tag('retreat', { people: 9 })]);
    expect(g!.keep.people).toBe(9);
  });

  it("keeps an organisation's tag over a plain word, whatever the counts", () => {
    const [g] = findDoubles([tag('ebbf', { people: 20 }), tag('EBBF', { organisation_id: 'o1', people: 1 })]);
    expect(g!.keep.organisation_id).toBe('o1');
  });

  it('never groups two organisations together', () => {
    // Two real companies with near names: merging would move one company's
    // people onto the other.
    expect(findDoubles([tag('Zaailing', { organisation_id: 'o1' }), tag('zaailing', { organisation_id: 'o2' })])).toEqual(
      [],
    );
  });

  it('places a tag in one group only', () => {
    const groups = findDoubles([tag('retreat'), tag('Retreat'), tag('retreats')]);
    const ids = groups.flatMap((g) => [g.keep, ...g.others].map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('leaves short words that only look plural alone', () => {
    expect(singularKey('bus')).toBe('bus');
    expect(singularKey('trainingen')).toBe('training');
    expect(singularKey('communities')).toBe('community');
  });
});

describe('unused and stale', () => {
  const now = new Date('2026-09-14T00:00:00Z');

  it('lists tags on nobody, but not an organisation’s tag', () => {
    const out = findUnused([tag('old', { people: 0 }), tag('EBBF', { people: 0, organisation_id: 'o1' }), tag('live')]);
    expect(out.map((t) => t.name)).toEqual(['old']);
  });

  it('lists tags not used within the period, oldest first', () => {
    const out = findStale(
      [
        tag('recent', { last_used: '2026-09-01T00:00:00Z' }),
        tag('older', { last_used: '2026-01-01T00:00:00Z' }),
        tag('oldest', { last_used: '2025-06-01T00:00:00Z' }),
      ],
      now,
      180,
    );
    expect(out.map((t) => t.name)).toEqual(['oldest', 'older']);
  });

  it('does not call a tag stale when nothing dated says when it was used', () => {
    expect(findStale([tag('undated', { last_used: null })], now, 180)).toEqual([]);
  });
});

describe('a note mentioning a tag', () => {
  it('matches #tag and plain words, as whole words', () => {
    expect(mentions('Great #deep-democracy session', 'deep democracy')).toBe(true);
    expect(mentions('We talked about art.', 'art')).toBe(true);
    expect(mentions('A party', 'art')).toBe(false);
  });
});
