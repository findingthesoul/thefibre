import { describe, expect, it } from 'vitest';
import { TEMPLATE_LIBRARY, seedRowsFor } from './thread-template-library.js';

const base = { workspace_id: 'ws', thread_id: 'th' };

describe('seedRowsFor', () => {
  it('never seeds a daily_schedule — a schedule row needs a date a template lacks', () => {
    for (const tpl of TEMPLATE_LIBRARY) {
      for (const row of seedRowsFor(tpl, base)) {
        expect(row.insert).not.toHaveProperty('daily_schedule');
      }
    }
  });

  it('marks every relative trigger as anchored to an engagement', () => {
    for (const tpl of TEMPLATE_LIBRARY) {
      for (const row of seedRowsFor(tpl, base)) {
        if (row.insert.trigger_kind === 'relative') {
          expect(row.insert.trigger_anchor).toBe('engagement');
          expect(row.anchorKey).toBeTruthy();
        } else {
          expect(row.anchorKey).toBeNull();
        }
      }
    }
  });

  it('names an anchor that exists in the same blueprint, even one defined later', () => {
    for (const tpl of TEMPLATE_LIBRARY) {
      const rows = seedRowsFor(tpl, base);
      const keys = new Set(rows.map((r) => r.key));
      for (const row of rows) {
        if (row.anchorKey) expect(keys.has(row.anchorKey)).toBe(true);
      }
    }
    const circle = TEMPLATE_LIBRARY.find((t) => t.id === 'conversation-circle')!;
    const rows = seedRowsFor(circle, base);
    const remind = rows.find((r) => r.key === 'remind')!;
    expect(rows.findIndex((r) => r.key === remind.anchorKey)).toBeGreaterThan(
      rows.indexOf(remind),
    );
  });

  it('keeps timeline order in position and scopes every row to the thread', () => {
    const rows = seedRowsFor(TEMPLATE_LIBRARY[0]!, base);
    expect(rows.map((r) => r.insert.position)).toEqual([10, 20]);
    for (const row of rows) {
      expect(row.insert.workspace_id).toBe('ws');
      expect(row.insert.thread_id).toBe('th');
      expect(row.insert.status).toBe('draft');
    }
  });
});
