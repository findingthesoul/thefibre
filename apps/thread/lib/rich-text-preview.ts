// Rich text flattened to a line of plain text, for previews.
//
// A thread's intention became rich text on 2026-09-10. Anywhere it is shown
// FULL it is rendered as HTML; anywhere it is shown as a CLAMPED PREVIEW —
// listing cards, embeds — rendering HTML inside two clipped lines is wrong
// twice over: block tags fight the clamp, and an unclosed fragment leaks
// styling into the card. So previews get text.
//
// Deliberately not a sanitiser. The value has already been sanitised on the
// way in; this only strips what is left so it reads as a sentence.

export function richTextPreview(html: string | null | undefined): string {
  if (!html) return '';
  return html
    // Block boundaries become spaces, or "one.Two" runs together.
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
