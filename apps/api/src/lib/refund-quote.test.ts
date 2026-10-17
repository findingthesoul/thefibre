// When a thread with no key moment "starts", for counting a refund rule back
// from it: midnight in the THREAD's zone (refund rules, slice 3b).
import { describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({ adminClient: {} }));
const { startInstant } = await import('./refund-quote.js');

describe('startInstant', () => {
  it('a bare date is midnight in the thread’s zone, winter and summer', () => {
    expect(startInstant('2026-12-01', 'Europe/Amsterdam')!.toISOString()).toBe('2026-11-30T23:00:00.000Z');
    expect(startInstant('2026-07-01', 'Europe/Amsterdam')!.toISOString()).toBe('2026-06-30T22:00:00.000Z');
    expect(startInstant('2026-12-01', 'America/New_York')!.toISOString()).toBe('2026-12-01T05:00:00.000Z');
    expect(startInstant('2026-12-01', 'UTC')!.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });
  it('an instant is kept as it is; nothing is null', () => {
    expect(startInstant('2026-12-01T09:30:00.000Z', 'Europe/Amsterdam')!.toISOString()).toBe('2026-12-01T09:30:00.000Z');
    expect(startInstant(null, 'Europe/Amsterdam')).toBeNull();
  });
});
