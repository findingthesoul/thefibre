import { describe, expect, it } from 'vitest';
import { ROLE_RANK, raisedRole } from './role-floor.js';
// @ts-expect-error — a plain .mjs script helper, no type declarations
import { RANK as SCRIPT_RANK } from '../../scripts/lib/role-floor.mjs';

describe('role floor', () => {
  it('never lowers: a senior role is left as it is', () => {
    expect(raisedRole('super_admin', 'organiser')).toBeNull();
    expect(raisedRole('super_admin', 'admin')).toBeNull();
    expect(raisedRole('admin', 'organiser')).toBeNull();
    expect(raisedRole('organiser', 'organiser')).toBeNull();
  });
  it('raises a lower or missing role to the floor', () => {
    expect(raisedRole('organiser', 'admin')).toBe('admin');
    expect(raisedRole(null, 'organiser')).toBe('organiser');
    expect(raisedRole('something-old', 'organiser')).toBe('organiser');
  });
  it('agrees with the rank the --all-members script uses', () => {
    expect(ROLE_RANK).toEqual(SCRIPT_RANK);
  });
});
