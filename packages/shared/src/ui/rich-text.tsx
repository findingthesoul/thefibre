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
// written by a workspace member in our own editor, which is the same trust
// level as every other thing an organiser publishes on their thread page.
// It is NOT visitor input and must never be pointed at any. If that ever
// changes, sanitise at the API boundary where `isomorphic-dompurify`
// already lives (lib/uploads.ts), not here — this package has no
// dependencies and no DOM.

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
