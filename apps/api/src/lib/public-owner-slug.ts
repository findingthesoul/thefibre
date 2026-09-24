// Which slug owns a thread's PUBLIC address.
//
// THREE kinds, not two. A workspace-scoped thread has `team_id` NULL by
// design (brief D1), so the obvious `team ?? organiser` silently falls
// through to the organiser and emits an address that is reachable but not
// canonical — the page's own canonical tag then points somewhere else.
// `team_id IS NULL` is not "personal"; ask `public_scope`.
//
// This rule was written out by hand in six places across the API and the web
// apps, and on 2026-09-09 three of those copies disagreed on the same day.
// This file is the canonical one. New callers import it. Existing copies get
// converted as their files are touched — routes/portal.ts was the first
// (2026-09-24, with the calendar feed, which would otherwise have become a
// seventh). Still outstanding when this was written: the two-way shape at
// routes/thread.ts `ownerSlugOf`, on the participant-facing
// GET /public/my-enrolments.
//
// Returns '' when nothing owns it — a thread with no organiser, no team and
// no workspace slug has no public address, and callers skip it rather than
// building `/undefined/...`.

export function publicOwnerSlug(args: {
  publicScope: string | null | undefined;
  workspaceSlug: string | null | undefined;
  teamSlug: string | null | undefined;
  organiserSlug: string | null | undefined;
}): string {
  return (
    (args.publicScope === 'workspace' ? args.workspaceSlug : null) ??
    args.teamSlug ??
    args.organiserSlug ??
    ''
  );
}
