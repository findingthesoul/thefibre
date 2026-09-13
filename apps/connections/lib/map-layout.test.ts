import { describe, expect, it } from 'vitest';
import {
  FAR_DAYS,
  daysSince,
  defaultStartPerson,
  layout,
  radiusFor,
  thin,
  unitHash,
  type MapPerson,
} from './map-layout';

const NOW = Date.UTC(2026, 8, 13);
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();
const person = (id: string, days: number | null, attention = false): MapPerson => ({
  id,
  name: id,
  rung: 'touched',
  lastContactAt: days === null ? null : ago(days),
  attention,
});

/** Distance of a dot from the centre of the unit square. */
const dist = (d: { x: number; y: number }) => Math.hypot(d.x - 0.5, d.y - 0.5);

describe('stability — the reason the map is computed, not simulated', () => {
  it('puts the same person in the same place every time', () => {
    const a = layout([person('wilma', 10)], NOW).dots[0]!;
    const b = layout([person('wilma', 10)], NOW).dots[0]!;
    expect([a.x, a.y]).toEqual([b.x, b.y]);
  });

  it('does not move anybody when somebody else is added', () => {
    // The failure of a force simulation, and the whole point of D38.
    const alone = layout([person('wilma', 10)], NOW).dots.find((d) => d.id === 'wilma')!;
    const crowded = layout(
      [person('wilma', 10), person('joost', 3), person('aniek', 200)],
      NOW,
    ).dots.find((d) => d.id === 'wilma')!;
    expect([crowded.x, crowded.y]).toEqual([alone.x, alone.y]);
  });

  it('keeps a person on the same bearing as they drift out over time', () => {
    const recent = layout([person('wilma', 2)], NOW).dots[0]!;
    const later = layout([person('wilma', 200)], NOW).dots[0]!;
    const bearing = (d: { x: number; y: number }) => Math.atan2(d.y - 0.5, d.x - 0.5);
    expect(bearing(later)).toBeCloseTo(bearing(recent), 10);
  });
});

describe('radius is recency', () => {
  it('draws somebody spoken to recently nearer the centre than somebody gone quiet', () => {
    const { dots } = layout([person('recent', 1), person('quiet', 300)], NOW);
    const d = Object.fromEntries(dots.map((x) => [x.id, dist(x)]));
    expect(d.recent!).toBeLessThan(d.quiet!);
  });

  it('gives the first weeks more room than the later months', () => {
    // Yesterday-to-last-week matters more to a decision than month 7 to month 8.
    const earlyGap = radiusFor(7) - radiusFor(1);
    const lateGap = radiusFor(240) - radiusFor(234);
    expect(earlyGap).toBeGreaterThan(lateGap);
  });

  it('never puts anybody on the very centre or the very edge', () => {
    const { dots } = layout([person('today', 0), person('almost-a-year', FAR_DAYS)], NOW);
    for (const d of dots) {
      expect(dist(d)).toBeGreaterThan(0.02);
      expect(dist(d)).toBeLessThan(0.47);
    }
  });
});

describe('the far field is haze', () => {
  it('turns a person unseen for over a year into haze, not a dot', () => {
    const { dots, far } = layout([person('long-gone', FAR_DAYS + 1)], NOW);
    expect(dots).toHaveLength(0);
    expect(far.map((p) => p.id)).toEqual(['long-gone']);
  });

  it('keeps a person seen within the year as a dot', () => {
    // The twin of the case above, so the rule is proved to separate the two.
    const { dots, far } = layout([person('just-in', FAR_DAYS)], NOW);
    expect(dots).toHaveLength(1);
    expect(far).toHaveLength(0);
  });

  it('treats never contacted as haze', () => {
    expect(layout([person('stranger', null)], NOW).far).toHaveLength(1);
  });
});

describe('size is attention', () => {
  it('draws a person needing attention larger', () => {
    const { dots } = layout([person('calm', 10), person('needs-you', 10, true)], NOW);
    const s = Object.fromEntries(dots.map((d) => [d.id, d.size]));
    expect(s['needs-you']!).toBeGreaterThan(s.calm!);
  });

  it('draws the larger dots last, so attention is never hidden underneath', () => {
    const { dots } = layout([person('needs-you', 10, true), person('calm', 10)], NOW);
    expect(dots[dots.length - 1]!.id).toBe('needs-you');
  });
});

describe('helpers', () => {
  it('hashes into [0, 1) and differs by salt', () => {
    for (const s of ['a', 'wilma', '00000000-0000-0000-0000-000000000000']) {
      const h = unitHash(s);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
      expect(unitHash(s, 7)).not.toBe(h);
    }
  });

  it('spreads bearings rather than clumping them', () => {
    // 200 ids into 4 quadrants: none should be nearly empty. The first hash
    // put 10 in one — a fake cluster of unrelated people. Sequential ids are
    // the hard case, so they are used deliberately.
    const q = [0, 0, 0, 0];
    for (let i = 0; i < 200; i += 1) q[Math.floor(unitHash(`person-${i}`) * 4)]! += 1;
    for (const n of q) expect(n).toBeGreaterThan(25);
  });

  it('spreads real-shaped uuids too', () => {
    // Uuids that differ only in their last characters, as rows created in a
    // burst often do.
    const q = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 400; i += 1) {
      const id = `3f2a1b4c-0000-4000-8000-${i.toString(16).padStart(12, '0')}`;
      q[Math.floor(unitHash(id) * 8)]! += 1;
    }
    for (const n of q) expect(n).toBeGreaterThan(25);
  });

  it('reads an unparseable date as never, not as today', () => {
    expect(daysSince('not a date', NOW)).toBeNull();
  });
});

describe('thinning — each tick is a requirement', () => {
  type Kind = 'stated' | 'tag' | 'organisation' | 'mentioned';
  const n = (id: string, ...kinds: Kind[]) => ({ id, reasons: kinds.map((kind) => ({ kind, label: '' })) });
  const all = [n('both', 'tag', 'organisation'), n('tag-only', 'tag'), n('org-only', 'organisation')];
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

  it('keeps everyone when nothing is ticked', () => {
    expect(ids(thin(all, new Set<Kind>()))).toEqual(['both', 'tag-only', 'org-only']);
  });

  it('keeps a link that has the one ticked reason', () => {
    // The success twin of the narrowing case below.
    expect(ids(thin(all, new Set<Kind>(['tag'])))).toEqual(['both', 'tag-only']);
  });

  it('narrows, never widens, as a second box is ticked', () => {
    // An OR filter would return all three here. That is the misreading D47
    // warns about, and it looks like a working feature.
    expect(ids(thin(all, new Set<Kind>(['tag', 'organisation'])))).toEqual(['both']);
  });
});

describe('where the cloud opens', () => {
  const p = (name: string, lastContactAt: string | null) => ({ name, lastContactAt });

  it('opens on the person you were in touch with most recently', () => {
    const who = defaultStartPerson([
      p('Old friend', '2024-01-01T00:00:00Z'),
      p('Spoke yesterday', '2026-09-12T00:00:00Z'),
      p('Last spring', '2026-03-01T00:00:00Z'),
    ]);
    expect(who?.name).toBe('Spoke yesterday');
  });

  it('never opens on somebody never spoken to while anyone else qualifies', () => {
    // Landing on a stranger would open the map on its emptiest corner, which
    // is how it came to look broken in the first place.
    const who = defaultStartPerson([p('Never spoken', null), p('Spoke once', '2025-05-05T00:00:00Z')]);
    expect(who?.name).toBe('Spoke once');
  });

  it('falls back to somebody rather than nobody when no one has been contacted', () => {
    expect(defaultStartPerson([p('Bea', null), p('Ann', null)])?.name).toBe('Ann');
  });

  it('opens the same way twice when dates tie', () => {
    const same = '2026-09-01T00:00:00Z';
    expect(defaultStartPerson([p('Zoe', same), p('Ann', same)])?.name).toBe('Ann');
  });

  it('has nobody to open on in an empty workspace', () => {
    expect(defaultStartPerson([])).toBeUndefined();
  });
});
