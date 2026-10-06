import { describe, it, expect } from 'vitest';
import { canManageWorkspace } from './workspace-admin.js';

describe('canManageWorkspace', () => {
  it('is true for a workspace admin', () => {
    expect(canManageWorkspace({ user: {}, workspace_role: 'admin' })).toBe(true);
  });

  it('is true for a workspace super_admin', () => {
    expect(canManageWorkspace({ user: {}, workspace_role: 'super_admin' })).toBe(true);
  });

  // The case that was broken, and the reason this changed at all: a real
  // person was a workspace admin and the settings pages refused her, because
  // they were reading her app role instead. She now gets in.
  it('lets in a workspace admin who holds NO fibre-platform app-admin role', () => {
    expect(canManageWorkspace({ user: { is_super_admin: false }, workspace_role: 'admin' })).toBe(
      true,
    );
  });

  // The behaviour change, asserted rather than left implicit. Admin of the
  // Fibre APP was never the same as running the workspace, and somebody in
  // that state LOSES these pages. If this ever goes green the other way, the
  // old conflation has crept back.
  it('keeps out a fibre-platform app admin who is only an organiser here', () => {
    expect(canManageWorkspace({ user: {}, workspace_role: 'organiser' })).toBe(false);
  });

  it('is false for every other workspace role', () => {
    for (const role of ['organiser', 'member', 'viewer', '']) {
      expect(canManageWorkspace({ user: {}, workspace_role: role }), role).toBe(false);
    }
  });

  // A platform super admin is not a member of every workspace and still has
  // to be able to help inside one.
  it('is true for a platform super admin with no seat at all', () => {
    expect(canManageWorkspace({ user: { is_super_admin: true }, workspace_role: null })).toBe(true);
  });

  // Fails CLOSED. An older API that does not send the field, a failed load, a
  // person with no seat row: all "not an admin". Showing the doors on unknown
  // would put us back to entries that bounce.
  it('fails closed on missing, null or unloadable facts', () => {
    expect(canManageWorkspace(null)).toBe(false);
    expect(canManageWorkspace(undefined)).toBe(false);
    expect(canManageWorkspace({ user: {} })).toBe(false);
    expect(canManageWorkspace({ user: {}, workspace_role: null })).toBe(false);
    expect(canManageWorkspace({ user: { is_super_admin: null }, workspace_role: undefined })).toBe(
      false,
    );
  });

  it('is not fooled by a near-miss role', () => {
    for (const role of ['Admin', 'ADMIN', 'admin ', ' admin', 'superadmin']) {
      expect(canManageWorkspace({ user: {}, workspace_role: role }), role).toBe(false);
    }
  });
});
