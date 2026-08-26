// Workspace roles — one place for the vocabulary and the one rule that must
// hold across every screen that can change a role.
//
// The values come from 20260704090000_role_tiers:
//   super_admin | admin | organiser        (default 'organiser')
// 'member' was the old second value and has not been legal since that
// migration. Anything still writing it violates the CHECK constraint.
//
// NOTE: workspace admin is NOT `user.is_super_admin`. That is the PLATFORM
// super admin — what lets someone approve an app registration — and it grants
// no authority over any workspace. Same word, different thing.

import { adminClient } from '../db.js';

export const WORKSPACE_ROLES = ['super_admin', 'admin', 'organiser'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** Roles that satisfy a workspace-admin check. */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

/**
 * Would changing this user to `nextRole` leave the workspace with no admin?
 *
 * A workspace with no admin cannot be repaired from the UI: every screen that
 * could grant the role is itself behind an admin check. That is the bug fixed
 * in v0.18.8, and self-demotion is the one path that could recreate it — so
 * the last admin is not allowed to step down until someone else steps up.
 */
export async function wouldOrphanWorkspace(
  userId: string,
  workspaceId: string,
  nextRole: string,
): Promise<boolean> {
  if (isAdminRole(nextRole)) return false;

  const { data } = await adminClient
    .from('workspace_member')
    .select('user_id, workspace_role')
    .eq('workspace_id', workspaceId);

  const admins = (data ?? []).filter((m) => isAdminRole(m.workspace_role as string));
  // Only a problem if the user being demoted is currently the sole admin.
  return admins.length === 1 && admins[0]?.user_id === userId;
}

export const ORPHAN_ERROR =
  'this is the workspace’s only admin — promote someone else first';
