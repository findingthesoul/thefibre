// Organiser-authored rich text, rendered the same way everywhere it appears.
//
// A thread's engagement descriptions come out of the editor as HTML. The
// public thread page has always rendered them as HTML; the visitor portal
// rendered the same field as plain text, so a member reading their own
// agenda saw `<div>` and `</div>` around the paragraph (found by Sjoerd on
// his own thread, 2026-09-10). Two surfaces showing one field two ways is
// the fork this package exists to prevent, so the decision lives here now:
// ONE place decides how organiser rich text looks.
//
// The class list is lifted verbatim from the public page, which is the
// design-leading copy — lists keep their markers, links stay underlined.
//
// TRUST: this is `dangerouslySetInnerHTML`, and deliberately. The HTML is
// written by a workspace member in our own editor. It is NOT visitor input
// and must never be pointed at any.
//
// It IS sanitised, as of v0.68.67 — `apps/api/src/lib/rich-text.ts` cleans
// organiser rich text at the API boundary before it is stored, with the
// DOMPurify that already lived in lib/uploads.ts. That is the right place and
// this is not: the sanitiser belongs where the value ENTERS, because it
// leaves through four surfaces and only one of them has to forget. This
// package keeps no dependencies and no DOM, so do not add one here.
//
// Written before that landed, this comment said sanitising was a thing to do
// "if that ever changes". It has changed; the note is updated so nobody
// reads the old one and concludes nothing guards it.

/**
 * The inner typography, in one string a test can read.
 *
 * Written `[&_ul,&_ol]:pl-5` until 2026-10-02, which generated NOTHING: that
 * comma form is not a selector Tailwind emits here, so for as long as this
 * component has existed every bullet list in organiser rich text rendered
 * with `padding-left: 0` and its markers hanging outside the text column —
 * the public thread page, the portal, and now the bio. Measured rather than
 * guessed: `getComputedStyle(ul).paddingLeft` was `0px` while the class sat
 * in the DOM. A class that is present and inert looks exactly like one that
 * works, which is why the test reads this string instead of trusting it.
 *
 * The vertical rhythm for lists lives here too. Spacing is otherwise the
 * caller's — a sheet and a public page differ in scale — but a list jammed
 * against the paragraph above it is not a scale decision anybody made, and
 * every caller setting paragraph margins and forgetting lists is the fork
 * this file exists to prevent.
 */
export const RICH_TEXT_TYPOGRAPHY =
  '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_ul]:my-2 [&_ol]:my-2 [&_a]:underline';

export function RichText({
  html,
  className = '',
}: {
  html: string;
  /** Spacing and size belong to the caller; only the INNER typography is
   *  fixed here, so a sheet and a public page can differ in scale without
   *  differing in what a bullet list looks like. */
  className?: string;
}) {
  return (
    <div
      className={`${RICH_TEXT_TYPOGRAPHY} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
