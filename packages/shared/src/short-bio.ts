// The short bio a compact spot shows — in ONE place.
//
// Sjoerd, 2026-10-07: "short bio yes". Every person has a full bio (rich
// text, thousands of characters, for their own page) and now a short one
// (plain text, FIELD_LIMITS.short_bio, for anywhere space is small: the left
// column of a Meet booking page, a meta description, a social card).
//
// Most people will not have written the short one yet, and an empty spot
// where a few lines about the host belong is worse than a sensible excerpt.
// So when it is empty, the spot shows the OPENING of the full bio, cut at a
// word boundary with an ellipsis. That rule is here and nowhere else: the API
// resolves it for every public payload it serves, so a page, an OG image and
// a website outside this repo all show the same words.

import { bioToPlain } from './bio-html.js';
import { richTextToPlain } from './rich-text-plain.js';

/** How much of the full bio stands in for an unwritten short bio. Shorter
 *  than FIELD_LIMITS.short_bio on purpose: an excerpt reads as an excerpt,
 *  and the ellipsis says there is more on the person's own page. */
export const SHORT_BIO_FALLBACK_CHARS = 200;

/**
 * `text` flattened to one line and cut to at most `max` characters at a word
 * boundary, with an ellipsis when anything was cut.
 *
 * Flattened because a compact spot is a few lines of prose: the paragraphs
 * and bullets of a full bio would spend the space on line breaks. The cut
 * never splits a word; only a single word longer than the whole budget is
 * cut mid-word, because otherwise there would be nothing to show.
 */
export function excerptAtWord(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  // Room for the ellipsis inside the budget, so the result is never longer
  // than `max` — the caller sized the spot by that number.
  const budget = Math.max(1, max - 1);
  const head = flat.slice(0, budget + 1);
  const lastSpace = head.lastIndexOf(' ');
  const cut = lastSpace > 0 ? head.slice(0, lastSpace) : flat.slice(0, budget);
  // "rooted in listening, …" reads as a stumble; "rooted in listening…" not.
  return `${cut.replace(/[\s,;:–—-]+$/u, '')}…`;
}

/**
 * The short bio to show, or null when the person has written neither.
 *
 * Their own short bio wins, as written (trimmed, never cut — the form and
 * the API already hold it to the limit). Otherwise the opening of the full
 * bio, plain text whatever the stored form (bioToPlain decides whether it is
 * HTML), excerpted at a word boundary.
 */
export function resolveShortBio(person: {
  short_bio?: string | null | undefined;
  bio?: string | null | undefined;
}): string | null {
  const own = person.short_bio?.trim();
  if (own) return own;
  const plain = bioToPlain(person.bio, richTextToPlain);
  if (!plain) return null;
  return excerptAtWord(plain, SHORT_BIO_FALLBACK_CHARS) || null;
}

/**
 * Whether the full bio says more than the short bio a page already shows —
 * i.e. whether a "more about" disclosure has anything to disclose.
 *
 * False when the short bio IS the whole bio (a bio short enough to need no
 * excerpt), so a page never repeats the same sentence twice in a row.
 */
export function fullBioAddsMore(
  shownShortBio: string | null | undefined,
  bio: string | null | undefined,
): boolean {
  const plain = bioToPlain(bio, richTextToPlain);
  if (!plain) return false;
  const flat = plain.replace(/\s+/g, ' ').trim();
  return flat !== (shownShortBio ?? '').replace(/\s+/g, ' ').trim();
}
