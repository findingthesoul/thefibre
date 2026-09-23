import { describe, it, expect } from 'vitest';
import { TODO_GROUPS } from '@thefibre/shared/todo-groups';
import { groupByDay, type TaskItem } from './my-tasks.js';

const at = (due: string | null, extra: Partial<TaskItem> = {}): TaskItem => ({
  id: 'x', source: null, title: 't', due_on: due, app: null, subject: null, href: null,
  state: 'open', snoozed_until: null, done_at: null, team: null, sort: 0, ...extra,
});

describe('groupByDay', () => {
  const now = new Date('2026-09-23T10:00:00Z');

  it('puts each date in the bucket a person would expect', () => {
    const g = groupByDay(
      [at('2026-09-20'), at('2026-09-23'), at('2026-09-24'), at('2026-09-28'), at('2026-10-15'), at(null)],
      now,
    );
    expect(g.overdue).toHaveLength(1);
    expect(g.today).toHaveLength(1);
    expect(g.tomorrow).toHaveLength(1);
    expect(g.this_week).toHaveLength(1);
    expect(g.later).toHaveLength(1);
    expect(g.no_date).toHaveLength(1);
  });

  it('a snoozed item belongs to the day it was pushed to, not its due date', () => {
    const g = groupByDay([at('2026-09-20', { state: 'snoozed', snoozed_until: '2026-09-24' })], now);
    expect(g.overdue).toHaveLength(0);
    expect(g.tomorrow).toHaveLength(1);
  });

  it('keeps hand order inside a day', () => {
    const g = groupByDay([at('2026-09-23', { title: 'b', sort: 2 }), at('2026-09-23', { title: 'a', sort: 1 })], now);
    expect(g.today.map((i) => i.title)).toEqual(['a', 'b']);
  });

  it('the seventh day is still this week, the eighth is later', () => {
    const g = groupByDay([at('2026-09-30'), at('2026-10-01')], now);
    expect(g.this_week).toHaveLength(1);
    expect(g.later).toHaveLength(1);
  });
});

// ── The two sides must AGREE on the bucket names ──────────────────────────
//
// Not "groupByDay works" and separately "the panel renders" — that is how a
// feature ships inert. The panel only draws the keys it knows, so a bucket it
// has never heard of is one it silently DROPS, with no error anywhere. This
// pins the API's output to the single list both import.
describe('the group names the panel draws and the API emits', () => {
  it('are exactly the same set, in the same order', () => {
    const emitted = Object.keys(groupByDay([], new Date('2026-09-23T12:00:00Z')));
    expect(emitted).toEqual([...TODO_GROUPS]);
  });

  it('covers every item — nothing lands in a bucket that does not exist', () => {
    const now = new Date('2026-09-23T12:00:00Z');
    const days = [null, '2026-09-01', '2026-09-23', '2026-09-24', '2026-09-27', '2027-01-01'];
    const items = days.map((d) => at(d));
    const groups = groupByDay(items, now);
    const placed = Object.values(groups).reduce((n, list) => n + list.length, 0);
    expect(placed).toBe(items.length);
    // And each of the six buckets is reachable, so none is dead code the
    // panel renders a heading for and never fills.
    for (const key of TODO_GROUPS) expect(groups[key].length).toBeGreaterThan(0);
  });
});
