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

describe('seedRowsFor — the start date from the create form', () => {
  const single = TEMPLATE_LIBRARY.find((t) => t.id === 'single-event')!;
  const twoDay = TEMPLATE_LIBRARY.find((t) => t.id === 'two-day-event')!;

  it('places the first activity on the given date, so the thread is not born broken', () => {
    // The bug this locks: the date went only to the `program` row, so a new
    // organiser who filled in "Starts on" still landed in the editor with
    // "The event — NO DATE" and a thank-you message already labelled
    // "won't send: the anchor has no date".
    const rows = seedRowsFor(single, base, { startsOn: '2026-09-26', timezone: 'Europe/Amsterdam' });
    const event = rows.find((r) => r.key === 'event')!;

    // 10:00 Amsterdam in September is UTC+2.
    expect(event.insert.starts_at).toBe('2026-09-26T08:00:00.000Z');
  });

  it('respects the thread timezone rather than treating the clock as UTC', () => {
    const ams = seedRowsFor(single, base, { startsOn: '2026-09-26', timezone: 'Europe/Amsterdam' });
    const utc = seedRowsFor(single, base, { startsOn: '2026-09-26', timezone: 'UTC' });

    expect(ams.find((r) => r.key === 'event')!.insert.starts_at).not.toBe(
      utc.find((r) => r.key === 'event')!.insert.starts_at,
    );
    expect(utc.find((r) => r.key === 'event')!.insert.starts_at).toBe('2026-09-26T10:00:00.000Z');
  });

  it('survives a DST boundary — a winter date is UTC+1, not UTC+2', () => {
    const rows = seedRowsFor(single, base, { startsOn: '2026-12-05', timezone: 'Europe/Amsterdam' });

    expect(rows.find((r) => r.key === 'event')!.insert.starts_at).toBe('2026-12-05T09:00:00.000Z');
  });

  it('ends a multi-day shape on its last day', () => {
    const rows = seedRowsFor(twoDay, base, { startsOn: '2026-09-26', timezone: 'UTC' });
    const event = rows.find((r) => r.key === 'event')!;

    expect(event.insert.starts_at).toBe('2026-09-26T10:00:00.000Z');
    expect(event.insert.ends_at).toBe('2026-09-27T10:00:00.000Z');
  });

  it('dates ONLY the first activity — the rest of the timeline stays the organiser’s', () => {
    const rows = seedRowsFor(single, base, { startsOn: '2026-09-26', timezone: 'UTC' });
    const thanks = rows.find((r) => r.key === 'thanks')!;

    expect(thanks.insert).not.toHaveProperty('starts_at');
    // It still hangs off the event, which now HAS a date — so it will send.
    expect(thanks.anchorKey).toBe('event');
  });

  it('changes nothing when the form gave no date', () => {
    const without = seedRowsFor(single, base);
    const empty = seedRowsFor(single, base, { startsOn: null, timezone: 'UTC' });

    for (const rows of [without, empty]) {
      for (const row of rows) expect(row.insert).not.toHaveProperty('starts_at');
    }
  });

  it('ignores a malformed date rather than writing an Invalid Date', () => {
    const rows = seedRowsFor(single, base, { startsOn: 'next tuesday', timezone: 'UTC' });

    for (const row of rows) expect(row.insert).not.toHaveProperty('starts_at');
  });

  it('never seeds a daily_schedule, date or no date', () => {
    for (const tpl of TEMPLATE_LIBRARY) {
      for (const row of seedRowsFor(tpl, base, { startsOn: '2026-09-26', timezone: 'UTC' })) {
        expect(row.insert).not.toHaveProperty('daily_schedule');
      }
    }
  });
});
