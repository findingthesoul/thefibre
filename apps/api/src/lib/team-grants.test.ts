import { describe, it, expect } from 'vitest';
import { mergeGrants } from './team-grants.js';

// The merge is where "teams as access groups" either keeps its promise or
// quietly takes an app away from somebody. Union, never intersection.
describe('mergeGrants', () => {
  it('keeps a direct grant when no team confers anything', () => {
    const out = mergeGrants([{ app_id: 'pulse', role: 'member' }], []);
    expect(out).toEqual([{ app_id: 'pulse', role: 'member', direct: true, via: [] }]);
  });

  it('adds an app a team confers', () => {
    const out = mergeGrants(
      [],
      [{ name: 'Finance', lead: false, apps: [{ app_id: 'pulse', lead_is_app_admin: false }] }],
    );
    expect(out).toEqual([{ app_id: 'pulse', role: 'member', direct: false, via: ['Finance'] }]);
  });

  it('keeps the direct tick when a team confers the same app', () => {
    const out = mergeGrants(
      [{ app_id: 'pulse', role: 'member' }],
      [{ name: 'Finance', lead: false, apps: [{ app_id: 'pulse', lead_is_app_admin: false }] }],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ app_id: 'pulse', direct: true, via: ['Finance'] });
  });

  it('names every team that confers an app', () => {
    const out = mergeGrants(
      [],
      [
        { name: 'Finance', lead: false, apps: [{ app_id: 'pulse', lead_is_app_admin: false }] },
        { name: 'Ops', lead: false, apps: [{ app_id: 'pulse', lead_is_app_admin: false }] },
      ],
    );
    expect(out[0]?.via).toEqual(['Finance', 'Ops']);
  });

  it('makes a team LEAD an app admin when the grant says so', () => {
    const out = mergeGrants(
      [],
      [{ name: 'Finance', lead: true, apps: [{ app_id: 'pulse', lead_is_app_admin: true }] }],
    );
    expect(out[0]?.role).toBe('admin');
  });

  it('leaves an ordinary member a plain member of the same team', () => {
    const out = mergeGrants(
      [],
      [{ name: 'Finance', lead: false, apps: [{ app_id: 'pulse', lead_is_app_admin: true }] }],
    );
    expect(out[0]?.role).toBe('member');
  });

  it('never downgrades a direct admin to member', () => {
    const out = mergeGrants(
      [{ app_id: 'pulse', role: 'admin' }],
      [{ name: 'Finance', lead: false, apps: [{ app_id: 'pulse', lead_is_app_admin: false }] }],
    );
    expect(out[0]?.role).toBe('admin');
  });

  it('upgrades a direct member to admin when a lead grant says so', () => {
    const out = mergeGrants(
      [{ app_id: 'pulse', role: 'member' }],
      [{ name: 'Finance', lead: true, apps: [{ app_id: 'pulse', lead_is_app_admin: true }] }],
    );
    expect(out[0]?.role).toBe('admin');
    expect(out[0]?.direct).toBe(true);
  });

  it('unions across teams rather than intersecting them', () => {
    const out = mergeGrants(
      [],
      [
        { name: 'Finance', lead: false, apps: [{ app_id: 'pulse', lead_is_app_admin: false }] },
        { name: 'Sales', lead: false, apps: [{ app_id: 'meet', lead_is_app_admin: false }] },
      ],
    );
    expect(out.map((g) => g.app_id).sort()).toEqual(['meet', 'pulse']);
  });

  it('grants nothing when the person is in no team and was ticked for nothing', () => {
    expect(mergeGrants([], [])).toEqual([]);
  });
});
