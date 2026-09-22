import { describe, it, expect } from 'vitest';
import { groupByDay, type TaskItem } from './my-tasks.js';

const at = (due: string | null, extra: Partial<TaskItem> = {}): TaskItem => ({
  id: 'x', source: null, title: 't', due_on: due, app: null, subject: null, href: null,
  state: 'open', snoozed_until: null, done_at: null, sort: 0, ...extra,
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
