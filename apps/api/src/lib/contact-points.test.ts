import { describe, it, expect } from 'vitest';
import { cleanContactPoints, normaliseContactValue, pairOrder } from './contact-points.js';

describe('normaliseContactValue — mirrors contact_point_normalise() in SQL', () => {
  it('lower-cases and trims emails', () => {
    expect(normaliseContactValue('email', '  Sjoerd@Soul.com ')).toBe('sjoerd@soul.com');
  });
  it('keeps + and digits of a phone', () => {
    expect(normaliseContactValue('phone', '+31 (6) 15-08 03 45')).toBe('+31615080345');
  });
  it('reads a 00 international prefix as +', () => {
    expect(normaliseContactValue('phone', '0031 6 15080345')).toBe('+31615080345');
  });
  it('a blank is nothing', () => {
    expect(normaliseContactValue('email', '   ')).toBeNull();
  });
});

describe('cleanContactPoints', () => {
  it('settles one primary per kind, the flagged one', () => {
    const r = cleanContactPoints([
      { kind: 'email', value: 'work@soul.com', label: 'work', is_primary: false },
      { kind: 'email', value: 'me@gmail.com', label: 'private', is_primary: true },
      { kind: 'phone', value: '+31 6 12345678', label: 'private' },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.primaryEmail).toBe('me@gmail.com');
    expect(r.points.filter((p) => p.kind === 'email' && p.is_primary)).toHaveLength(1);
    expect(r.primaryPhone).toBe('+31612345678');
  });

  it('first email is primary when none is flagged', () => {
    const r = cleanContactPoints([
      { kind: 'email', value: 'a@x.org' },
      { kind: 'email', value: 'b@x.org' },
    ]);
    expect(r.ok && r.primaryEmail).toBe('a@x.org');
  });

  it('drops repeats that differ only in spelling', () => {
    const r = cleanContactPoints([
      { kind: 'email', value: 'A@x.org', label: 'work' },
      { kind: 'email', value: 'a@x.org ', label: 'private' },
    ]);
    expect(r.ok && r.points).toHaveLength(1);
    expect(r.ok && r.points[0]!.label).toBe('work');
  });

  it('only a work address carries an organisation', () => {
    const org = '11111111-1111-4111-8111-111111111111';
    const r = cleanContactPoints([
      { kind: 'email', value: 'a@x.org', label: 'private', org_id: org },
      { kind: 'email', value: 'b@x.org', label: 'work', org_id: org },
    ]);
    expect(r.ok && r.points.map((p) => p.org_id)).toEqual([null, org]);
  });

  it('refuses a list without an email', () => {
    expect(cleanContactPoints([{ kind: 'phone', value: '+31612345678' }]).ok).toBe(false);
  });

  it('refuses a malformed email', () => {
    expect(cleanContactPoints([{ kind: 'email', value: 'not-an-address' }]).ok).toBe(false);
  });
});

describe('pairOrder', () => {
  it('is the same whichever way round', () => {
    expect(pairOrder('b', 'a')).toEqual(pairOrder('a', 'b'));
  });
});
