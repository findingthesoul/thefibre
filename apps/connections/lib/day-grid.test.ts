import { describe, expect, it } from 'vitest';
import { hourRange, layoutDay, minutesOfDay, MIN_BLOCK_MIN, type Block } from './day-grid';

const at = (id: string, from: string, to: string): Block => {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  return { id, startMin: m(from), endMin: m(to) };
};

describe('columns', () => {
  it('gives a day with no clashes one full-width column each', () => {
    const out = layoutDay([at('a', '09:00', '10:00'), at('b', '11:00', '12:00')]);
    expect(out.map((o) => [o.id, o.lane, o.lanes])).toEqual([
      ['a', 0, 1],
      ['b', 0, 1],
    ]);
  });

  it('splits two that overlap', () => {
    const out = layoutDay([at('a', '09:00', '10:30'), at('b', '10:00', '11:00')]);
    expect(out.map((o) => [o.id, o.lane, o.lanes])).toEqual([
      ['a', 0, 2],
      ['b', 1, 2],
    ]);
  });

  it('reuses a column once its meeting has ended', () => {
    // c starts after a ends, so it takes a's column even though b is running.
    const out = layoutDay([
      at('a', '09:00', '10:00'),
      at('b', '09:30', '12:00'),
      at('c', '10:00', '11:00'),
    ]);
    const lane = (id: string) => out.find((o) => o.id === id)!;
    expect(lane('a').lane).toBe(0);
    expect(lane('b').lane).toBe(1);
    expect(lane('c').lane).toBe(0);
    // One cluster, so all three are drawn at the same width.
    expect(out.every((o) => o.lanes === 2)).toBe(true);
  });

  it('keeps a whole chain at one width, even where only the ends clash', () => {
    const out = layoutDay([
      at('a', '09:00', '10:00'),
      at('b', '09:45', '11:00'),
      at('c', '10:45', '12:00'),
    ]);
    expect(new Set(out.map((o) => o.lanes))).toEqual(new Set([2]));
  });

  it('separates clusters that merely touch', () => {
    // b starts exactly when a ends. Not a clash: both are full width.
    const out = layoutDay([at('a', '09:00', '10:00'), at('b', '10:00', '11:00')]);
    expect(out.every((o) => o.lanes === 1)).toBe(true);
  });

  it('does not narrow a lone meeting because a later pair clash', () => {
    // a ends exactly when b starts, so a is alone and belongs at full width.
    // Only b and c clash. Merging the two clusters would draw a half-width
    // for no reason the reader can see.
    const out = layoutDay([
      at('a', '09:00', '10:00'),
      at('b', '10:00', '11:00'),
      at('c', '10:30', '11:30'),
    ]);
    expect(out.find((o) => o.id === 'a')!.lanes).toBe(1);
    expect(out.find((o) => o.id === 'b')!.lanes).toBe(2);
    expect(out.find((o) => o.id === 'c')!.lanes).toBe(2);
  });

  it('treats a very short meeting as its drawn height, not its real one', () => {
    // A 5-minute meeting is DRAWN 30 minutes tall, so the 09:10 one would sit
    // underneath it. It has to take its own column.
    const out = layoutDay([at('a', '09:00', '09:05'), at('b', '09:10', '09:40')]);
    expect(out.every((o) => o.lanes === 2)).toBe(true);
  });

  it('is stable and total: every block comes back exactly once', () => {
    const blocks = [at('a', '09:00', '10:00'), at('b', '09:30', '10:30'), at('c', '14:00', '15:00')];
    const out = layoutDay(blocks);
    expect(out.map((o) => o.id).sort()).toEqual(['a', 'b', 'c']);
    expect(layoutDay(blocks)).toEqual(out);
  });

  it('does not mind an empty day', () => {
    expect(layoutDay([])).toEqual([]);
  });
});

describe('the hours drawn', () => {
  it('is a working day when nothing is on', () => {
    expect(hourRange([], null)).toEqual({ from: 7, to: 22 });
  });

  it('opens earlier for an early meeting and later for a late one', () => {
    expect(hourRange([at('a', '06:15', '07:00')], null).from).toBe(6);
    expect(hourRange([at('a', '21:00', '23:30')], null).to).toBe(24);
  });

  it('always contains now, so the line has somewhere to be', () => {
    expect(hourRange([], 5 * 60 + 30).from).toBe(5);
    expect(hourRange([], 23 * 60 + 50).to).toBe(24);
  });

  it('holds a meeting drawn taller than it is long', () => {
    // 21:50–21:55 is drawn to 22:20, so the grid has to reach 23.
    expect(hourRange([at('a', '21:50', '21:55')], null).to).toBe(23);
  });

  it('never leaves the day, and is never empty', () => {
    const r = hourRange([at('a', '00:00', '00:10')], null, 0, 0);
    expect(r.from).toBeGreaterThanOrEqual(0);
    expect(r.to).toBeLessThanOrEqual(24);
    expect(r.to).toBeGreaterThan(r.from);
  });
});

describe('minutes of the day', () => {
  it('reads the viewer’s own clock', () => {
    const d = new Date();
    d.setHours(14, 30, 0, 0);
    expect(minutesOfDay(d)).toBe(14 * 60 + 30);
  });
});

describe('the minimum height', () => {
  it('is long enough for a title', () => {
    expect(MIN_BLOCK_MIN).toBeGreaterThanOrEqual(20);
  });
});
