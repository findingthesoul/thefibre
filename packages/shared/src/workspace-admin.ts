// Who may manage the workspace — ONE definition, for the hub and the pages.
//
// Sjoerd, 2026-10-06, about a real person in a real workspace: Settings →
// "Apps" and Settings → "Members" "don't respond when clicked: no navigation,
// no message." They responded exactly as written. Both pages are admin-only
// and refused by redirecting to /settings — the page she was standing on. The
// browser went from /settings to /settings, so nothing moved and nothing was
// said, and from where she sat the link was simply dead.
//
// Two separate faults produced that, and this file is the second one's home.
//
//   The hub offered doors she could not open. `platformSettings` had no
//   notion of role, so every hub in the family listed Apps, Members and Teams
//   to everybody — including from Thread and Meet, where the link hops across
//   apexes and lands a non-admin on The Fibre's settings page, which is worse
//   than nothing happening.
//
//   The hub and the page could not have agreed anyway, because only the page
//   had an opinion. Now there is one function, and both ask it. A hub that
//   decides what to show by different reasoning than the page that refuses is
//   the bug waiting to come back the next time either is edited.
//
// WHICH DEFINITION, settled. There are two notions of "admin" here:
//
//   workspace_member.workspace_role in ('admin','super_admin')  — what the
//     API means (isWorkspaceAdmin in routes/connections-tags.ts), and what
//     somebody sets when they make a person an admin of a workspace.
//
//   app_membership.role = 'admin' for the fibre-platform app — what these
//     settings pages checked until 2026-10-06, because /auth/me offered
//     nothing else.
//
// They are different fields and they disagreed, so a person made a workspace
// admin in the ordinary way was refused by the settings pages. Asked which
// should own them, Sjoerd: "Workspace admin." So this reads workspace_role,
// matching the API, and /auth/me now returns it.
//
// THE BEHAVIOUR CHANGE THIS CARRIES: somebody who is admin of the
// fibre-platform APP but only an organiser in the workspace loses these
// pages. That is the point rather than a side effect — their app role never
// meant they ran the workspace — but it is a real loss for anyone in that
// state and is called out in the changelog rather than left to be discovered.

/** The slice of GET /auth/me this decision reads. Structural on purpose: the
 *  apps type their own `Me`, and all that matters is these two fields. */
export type AdminFacts = {
  user: { is_super_admin?: boolean | null };
  /** The person's role in the ACTIVE workspace, from GET /auth/me. Absent on
   *  an older API, or null when they hold no seat row — both mean "not an
   *  admin", never "unknown, allow". */
  workspace_role?: string | null;
};

/**
 * May this person manage the workspace — its members, its teams, which apps
 * it runs?
 *
 * `undefined` in, `false` out: a page that could not load who you are must
 * not show you the management doors. Failing closed here costs an admin one
 * reload; failing open shows everyone a door that bounces them.
 */
export function canManageWorkspace(me: AdminFacts | null | undefined): boolean {
  if (!me) return false;
  // A platform super admin keeps their own path: they are not a member of
  // every workspace and must still be able to help inside one.
  if (me.user?.is_super_admin) return true;
  return me.workspace_role === 'admin' || me.workspace_role === 'super_admin';
}
