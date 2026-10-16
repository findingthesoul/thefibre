// A handover request's expiry is CHECKED, not swept: a stored 'pending' past
// its expires_at reads as expired, everywhere, without any job flipping it.

import { describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({ adminClient: {} }));
vi.mock('./thread.js', () => ({ provisionOrganiser: vi.fn(), threadLocked: vi.fn() }));

const { effectiveStatus, HANDOVER_DAYS } = await import('./thread-handover.js');

describe('effectiveStatus', () => {
  const now = new Date('2026-10-16T12:00:00Z');
  it('a pending request inside its window is pending', () => {
    expect(effectiveStatus({ status: 'pending', expires_at: '2026-10-20T12:00:00Z' }, now)).toBe('pending');
  });
  it('a pending request past its window is expired', () => {
    expect(effectiveStatus({ status: 'pending', expires_at: '2026-10-16T11:59:59Z' }, now)).toBe('expired');
  });
  it('expiry exactly now counts as expired, as the accept function refuses it', () => {
    expect(effectiveStatus({ status: 'pending', expires_at: now.toISOString() }, now)).toBe('expired');
  });
  it('a decided request keeps its answer whatever the date', () => {
    expect(effectiveStatus({ status: 'accepted', expires_at: '2020-01-01T00:00:00Z' }, now)).toBe('accepted');
  });
  it('the window is seven days (Sjoerd, 2026-10-16)', () => {
    expect(HANDOVER_DAYS).toBe(7);
  });
});
