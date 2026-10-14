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
