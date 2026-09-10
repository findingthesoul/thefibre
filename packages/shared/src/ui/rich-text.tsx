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
      className={`[&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:pl-5 [&_a]:underline ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
