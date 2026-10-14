// A role a system hands out is a FLOOR, never an assignment.
//
// The same rule as scripts/lib/role-floor.mjs (the --all-members sweep);
// role-floor.test.ts checks the two rank tables agree. An UNKNOWN role ranks
// lowest, so an unrecognised value is raised rather than left alone.

export const ROLE_RANK: Readonly<Record<string, number>> = { organiser: 1, admin: 2, super_admin: 3 };
export const rankOf = (role: string | null | undefined): number => (role ? ROLE_RANK[role] ?? 0 : 0);

/** The role to write over `current` when a system grants `floor`, or null
 *  when `current` already meets it — the row is then left as it is. */
export function raisedRole(current: string | null | undefined, floor: string): string | null {
  return rankOf(current) >= rankOf(floor) ? null : floor;
}

/** What a lapsed seat may take away. Pure, so the rule is pinned by a test.
 *
 *  A seat removes the workspace row ONLY when that row is what the seat made:
 *  external, at or below the seat's role. Sjoerd, 2026-10-14: all five of
 *  soul.com's team also hold a membership with a seat, so a lapse revoked the
 *  founder's own workspace — and the soft-deleted `user` row then made the
 *  re-grant refuse ("removed before"), with no way back short of an invite.
 *  An INTERNAL row, or a role above the seat's (raised or set by hand), is the
 *  organisation's statement about that person, not the membership's; the
 *  journal says revoked and the row is left exactly as it is. */
export function seatRevokeKeeps(
  row: { workspace_role: string | null; relationship_type: string | null },
  seatRole: string,
): string | null {
  if (row.relationship_type === 'internal') return 'internal member';
  if (rankOf(row.workspace_role) > rankOf(seatRole)) return `role ${row.workspace_role} is above the seat's ${seatRole}`;
  return null;
}
