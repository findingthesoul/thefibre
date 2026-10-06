import { describe, it, expect } from 'vitest';
import { canManageWorkspace } from './workspace-admin.js';

const platform = (role: string) => ({ app: { slug: 'fibre-platform' }, role });

describe('canManageWorkspace', () => {
  it('is true for a super admin, whatever else they hold', () => {
    expect(canManageWorkspace({ user: { is_super_admin: true } })).toBe(true);
  });

  it('is true for admin on the fibre-platform app', () => {
    expect(canManageWorkspace({ user: {}, memberships: [platform('admin')] })).toBe(true);
  });

  it('is FALSE for every other role on that app', () => {
    for (const role of ['organiser', 'member', 'viewer', '']) {
      expect(canManageWorkspace({ user: {}, memberships: [platform(role)] }), role).toBe(false);
    }
  });

  it('is false for admin on a DIFFERENT app', () => {
    // Admin in Thread does not make you admin of the workspace.
    expect(
      canManageWorkspace({ user: {}, memberships: [{ app: { slug: 'the-thread' }, role: 'admin' }] }),
    ).toBe(false);
  });

  // The fail-closed cases. A hub that cannot load who you are must not show
  // the management doors: an admin loses one reload, everyone else loses a
  // door that bounces them back to where they stood.
  it('fails CLOSED on missing or unloadable facts', () => {
    expect(canManageWorkspace(null)).toBe(false);
    expect(canManageWorkspace(undefined)).toBe(false);
    expect(canManageWorkspace({ user: {} })).toBe(false);
    expect(canManageWorkspace({ user: {}, memberships: [] })).toBe(false);
  });

  it('reads PostgREST’s array-shaped join as well as the object one', () => {
    // The same row comes back either way depending on the query; a rule that
    // only understood one shape would silently refuse half the admins.
    expect(
      canManageWorkspace({ user: {}, memberships: [{ app: [{ slug: 'fibre-platform' }], role: 'admin' }] }),
    ).toBe(true);
  });
});
