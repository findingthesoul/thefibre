// The one decision set-workspace-role.mjs --all-members makes per person:
// the target role is a FLOOR, never an assignment.
//
// Sjoerd, 2026-10-14: "all the others in soul.com are internal as well. And
// organisers." He is super_admin there himself, so a sweep that set everyone
// to `organiser` would take his own access away — the exact shape of the bug
// the script exists to repair. Pure, so the rule is pinned by a test rather
// than by reading a loop.

/** How the three roles rank. An UNKNOWN role ranks lowest on purpose: a row
 *  written before the 2026-07-04 role migration could carry something else,
 *  and treating an unrecognised value as "probably senior, leave it" would
 *  skip exactly the people this is meant to fix. Raising is the direction
 *  that cannot take anything away. */
export const RANK = { organiser: 1, admin: 2, super_admin: 3 };
export const rankOf = (r) => RANK[r] ?? 0;

/** What one member becomes. The relationship IS set for everybody named in
 *  the run (it takes nothing away); the role only ever rises. */
export function planMember(current, target) {
  const keepsRole = rankOf(current.workspace_role) >= rankOf(target.role);
  const nextRole = keepsRole ? current.workspace_role : target.role;
  const nextRel = target.relationship ?? current.relationship_type;
  return {
    nextRole,
    nextRel,
    roleChanges: nextRole !== current.workspace_role,
    relChanges: nextRel !== current.relationship_type,
    senior: rankOf(current.workspace_role) > rankOf(target.role),
  };
}

/** Split a workspace's members into the ones a sweep may touch and the
 *  SEAT HOLDERS it leaves alone.
 *
 *  A seat holder is a PAYING MEMBER whose tier carries a fibre_seat grant:
 *  lib/fibre-seat.ts made their workspace_member row, external and with its
 *  own role, and the seat sync owns it (it revokes by the same journal). The
 *  sweep was for Sjoerd's TEAM — "everybody in soul.com internal and
 *  organiser" was said before launch, when only staff were members — and
 *  turning paying members internal would say something untrue about their
 *  place in the organisation and show them internal-only surfaces. So they
 *  are left as they are unless asked for by name (--include-seat-holders). */
export function splitSeatHolders(rows, seatHolderUserIds, includeSeatHolders = false) {
  if (includeSeatHolders) return { sweep: rows, seatHolders: [] };
  const sweep = [];
  const seatHolders = [];
  for (const r of rows) (seatHolderUserIds.has(r.user_id) ? seatHolders : sweep).push(r);
  return { sweep, seatHolders };
}
