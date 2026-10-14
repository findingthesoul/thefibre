// Where a `/my/...` path goes in the portal.
//
// IN ITS OWN FILE because a Next page may export only the page and the
// handful of names Next knows (`metadata`, `dynamic`, …). An extra named
// export beside the default fails the build's page-type check — which a
// worktree release does not run, so it would have surfaced on Vercel rather
// than here. (The repo has been bitten by exactly that before.)

/** `/my/invoices` and `/my/invoices/<id>` → the purchases list.
 *
 *  Deliberately NOT `/purchases/<id>`: the ids are not the same ids, and
 *  sending somebody to a purchase that is not theirs would be worse than
 *  sending them to the list they can find their own in. Everything else is a
 *  membership question. */
export function portalPathFor(rest: string[]): string {
  if (rest[0] === 'invoices') return '/purchases';
  return '/memberships';
}
