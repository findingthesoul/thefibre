// The address you send somebody for a tier that is not on the join page.
//
// A hidden tier's whole existence is its link (2026-10-14), so getting this
// wrong is not a cosmetic bug: a half-built URL is one an admin copies and
// sends, and the person who receives it sees a page that cannot sell them the
// thing they were offered.
//
// It is a function rather than a line inside the dialog so that it can be
// TESTED. This repo has no component renderer — its UI tests exercise the
// component's own function, never a copy of it — so the way to make a piece
// of interface behaviour checkable is to lift the decision out of the markup.

export type TierLinkParts = {
  /** The browser's own origin. The dialog is served by the members app, from
   *  the same origin as the join page, so this is right on every stack
   *  without an environment variable to forget. */
  origin: string | null | undefined;
  /** The community's public slug. */
  workspaceSlug: string | null | undefined;
  /** The tier's id. Absent for a tier that has never been saved. */
  tierId: string | null | undefined;
};

/** The link, or null when it cannot be built honestly.
 *
 *  Null is a real answer and the caller must show it as one: a tier that has
 *  not been saved has no id, and an address with `undefined` in it is worse
 *  than telling somebody to save first, because they would send it. */
export function tierJoinLink({ origin, workspaceSlug, tierId }: TierLinkParts): string | null {
  const base = (origin ?? '').trim().replace(/\/+$/, '');
  const slug = (workspaceSlug ?? '').trim();
  const id = (tierId ?? '').trim();
  if (!base || !slug || !id) return null;
  // The slug is encoded: it is user-chosen, and a community whose slug has
  // ever contained a space or an accent would otherwise produce a link that
  // breaks in some clients and not others.
  return `${base}/${encodeURIComponent(slug)}?tier=${encodeURIComponent(id)}`;
}
