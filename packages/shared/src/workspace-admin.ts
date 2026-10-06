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
// A WARNING ABOUT THE DEFINITION BELOW, which is deliberately today's and not
// necessarily the right one. There are two notions of "admin" in this system:
//
//   workspace_member.workspace_role in ('admin','super_admin')  — what the
//     API means by admin (see isWorkspaceAdmin in routes/connections-tags.ts),
//     and what somebody sets when they make a person an admin of a workspace.
//
//   app_membership.role = 'admin' for the fibre-platform app — what these
//     settings pages have always checked.
//
// They are different fields and they can disagree, so a person made a
// workspace admin in the ordinary way can still be refused here. That is
// probably why the real person was refused. Changing it is a product decision
// (which role should own Settings → Members?) and is with Sjoerd; it is NOT
// bundled into this fix, because hiding the entries and changing who may see
// them are different changes and only one of them is obviously safe.
//
// When he answers, this function's BODY changes and nothing else does. That
// is the whole reason it exists.

/** The slice of GET /auth/me this decision reads. Structural on purpose: the
 *  apps type their own `Me`, and all that matters is these two fields. */
export type AdminFacts = {
  user: { is_super_admin?: boolean | null };
  memberships?: {
    app: { slug: string } | { slug: string }[] | null;
    role?: string | null;
  }[];
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
  if (me.user?.is_super_admin) return true;
  return (
    me.memberships?.some((m) => {
      const app = Array.isArray(m.app) ? m.app[0] : m.app;
      return app?.slug === 'fibre-platform' && m.role === 'admin';
    }) ?? false
  );
}
