// Rich text, flattened for somewhere that cannot render HTML.
//
// A thread's description and a message body are stored as HTML (sanitised on
// the way in). Most surfaces render it. Some CANNOT, and those are the ones
// that go wrong quietly:
//
//   * a plain-text email part
//   * a calendar entry's DESCRIPTION — iCalendar has no markup at all
//
// On 2026-09-25 a participant's calendar showed, inside a real invitation:
//
//     <div>We will share learning from Leading Through Transitions Cycle 1
//     with members…</div>
//
// Nothing errored. The .ics was valid, the event was in the right place at
// the right time, and the tags were simply part of the sentence — which is
// how this kind of fault reaches a person rather than a log.
//
// ONE definition, because there were already three: `stripHtml` in
// routes/thread.ts (emails), `richTextPreview` in apps/thread (listing
// cards), and the calendar paths were about to add a fourth.
//
// The preview one stays separate ON PURPOSE and is not a duplicate: it
// collapses everything to a SINGLE LINE for a two-line clamp, where this one
// keeps the paragraphs. Same input, deliberately different answers.

/**
 * Block boundaries become newlines, list items get a bullet, entities come
 * back as characters. Not a sanitiser — the value was sanitised on the way
 * in; this only removes what is left so it reads as prose.
 */
export function richTextToPlain(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
