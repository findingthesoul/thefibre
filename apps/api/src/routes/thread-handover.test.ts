// A handover request's expiry is CHECKED, not swept: a stored 'pending' past
// its expires_at reads as expired, everywhere, without any job flipping it.

import { describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({ adminClient: {} }));
vi.mock('./thread.js', () => ({ provisionOrganiser: vi.fn(), threadLocked: vi.fn() }));

const { effectiveStatus, HANDOVER_DAYS, personName } = await import('./thread-handover.js');

describe('personName', () => {
  it('prefers the organiser display name', () => {
    expect(personName({ display_name: 'Anna', user: { full_name: 'Anna B', email: 'a@x.test' } })).toBe('Anna');
  });
  it('falls back to the account name, then the address — never "—" when a person exists', () => {
    expect(personName({ display_name: null, user: { full_name: 'Anna B', email: 'a@x.test' } })).toBe('Anna B');
    expect(personName({ display_name: '  ', user: [{ full_name: null, email: 'a@x.test' }] })).toBe('a@x.test');
  });
  it('is null when there is nobody', () => {
    expect(personName(null)).toBeNull();
  });
});

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
