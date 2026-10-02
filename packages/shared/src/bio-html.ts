// A profile bio, on its way from plain text to rich text.
//
// TRANSITIONAL, with a named end: delete this once every bio on every stack
// has been converted and the editor writes HTML (the cleanup release after
// the editor flip). Until then it is the only thing standing between a
// public page and either raw tags or lost line breaks.
//
// ── Why it has to exist at all ──────────────────────────────────────────────
//
// Every bio today is plain text with newlines, rendered as text. The field is
// becoming HTML, written by the shared editor. Those two facts cannot change
// in the same instant across eight readers, two stacks and a data migration,
// so there is a window where a bio may be either — and both must render
// correctly throughout:
//
//   plain text through an HTML renderer  →  line breaks vanish, a typed `<`
//                                            becomes markup
//   HTML through a text renderer         →  the reader sees <p> and </p>
//
// Both are visible damage on a public page. So readers go through here, and
// here decides which kind of value it was handed.
//
// ── Why detecting is acceptable HERE and not forever ────────────────────────
//
// A detector is a guess, and a guess in permanent code is a liability: the
// one bio that reads as HTML but is not will render wrong for ever and
// nobody will know why. What makes it tolerable now is that it is scaffolding
// with a demolition date — after the conversion there IS no plain text left,
// and this file goes. If you are reading this and the conversion has long
// since run on both stacks, the honest move is to delete it rather than to
// keep feeding it.
//
// The guess is also deliberately conservative: a value only counts as HTML if
// it opens with a tag we would have written. Anything else is treated as
// text and escaped, so the failure mode is "somebody's angle brackets show up
// as angle brackets", not "somebody's angle brackets execute".

/** Tags the editor and the sanitiser's allow-list can produce at the start of
 *  a stored bio. A value beginning with one of these came from the editor. */
const HTML_OPENERS = /^\s*<(p|div|ul|ol|h[1-4]|blockquote|pre|br\s*\/?)(\s|>|\/)/i;

export function looksLikeStoredHtml(value: string): boolean {
  return HTML_OPENERS.test(value);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The bio as HTML that is safe to put through `dangerouslySetInnerHTML`.
 *
 * Already-HTML passes through untouched — it was sanitised at the API
 * boundary on the way in, which is where this repo sanitises (see
 * `apps/api/src/lib/rich-text.ts`). Plain text is escaped and its line breaks
 * become paragraphs, so it renders exactly as `whitespace-pre-wrap` did.
 *
 * Returns null for nothing, so a caller renders no element at all rather than
 * an empty paragraph.
 */
export function bioToHtml(bio: string | null | undefined): string | null {
  if (bio == null) return null;
  const trimmed = bio.trim();
  if (!trimmed) return null;
  if (looksLikeStoredHtml(trimmed)) return trimmed;
  // Blank lines separate paragraphs; single newlines are line breaks within
  // one. That is what whitespace-pre-wrap looked like, and it is what people
  // typed into the old box.
  return trimmed
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/**
 * The bio as PLAIN text — for a meta description, an OG image, an email, and
 * for the published `organiser.bio` field, which is documented as a string
 * and must not start containing markup (CLAUDE.md rule 8: a published shape
 * must not change meaning, and markup appearing inside it would).
 *
 * `toPlain` is injected rather than imported so this module keeps no
 * dependencies; callers pass `richTextToPlain`.
 *
 * Plain text is returned UNTOUCHED. Running an HTML-stripper over "a < b"
 * is not a no-op, and during the transition most bios are still plain.
 */
export function bioToPlain(
  bio: string | null | undefined,
  toPlain: (html: string) => string,
): string | null {
  if (bio == null) return null;
  const trimmed = bio.trim();
  if (!trimmed) return null;
  return looksLikeStoredHtml(trimmed) ? toPlain(trimmed) : trimmed;
}
