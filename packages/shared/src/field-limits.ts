// How long a field may be — in ONE place, read by the form and by the schema.
//
// Sjoerd, 2026-10-03, after a save failed with `API 400` and the only thing he
// could do about it was shorten his own bio: *"Can we prevent work arounds?"*
// and *"creates a bad legacy"*. He is right, and the lesson is not about that
// bug. The limit lived in a zod schema, which runs on the server. A browser
// cannot read it. So the form let him type 2,400 characters it had no way to
// know were too many, discovered it only on save, and offered him nothing but
// a status code — and the only remedy within his reach was to change his own
// writing to suit a number nobody had shown him.
//
// That is a workaround standing in for a missing constraint, and the bad
// legacy is that the shortened bio becomes the record: the data is now shaped
// by a limit, not by what the person meant to say.
//
// A limit a person cannot see until they violate it is not a limit, it is a
// trap. So it lives here, where both halves read the same number:
//
//   - the form counts against it, says so before the save, and refuses
//     politely with a sentence instead of a number;
//   - the API still enforces it, because a browser is not a boundary;
//   - a test fails if the two ever drift apart.
//
// Adding a field here is cheap. Writing `max(2000)` into a route and nothing
// else is what costs, and the cost lands on whoever is typing.

export const FIELD_LIMITS = {
  /** A written bio. 8000 because a bio is becoming rich text and markup
   *  spends characters — the same words wrapped in paragraphs, a list and a
   *  bold phrase run 10–20% longer, so a limit sized for plain text would
   *  start refusing saves that worked the day before. A bio of the kind
   *  people paste in is 1,000–3,000 characters before any of that. */
  bio: 8000,
  /** The SHORT bio — a few lines for compact spots (a Meet booking page's
   *  left column, a meta description, a social card). Plain text, so no
   *  markup headroom is needed: 280 is two or three sentences, the length a
   *  person can read at a glance beside a calendar. When it is empty, readers
   *  show the opening of the full bio instead (short-bio.ts). */
  short_bio: 280,
  /** A person's display name. */
  display_name: 200,
  /** A stored asset URL. */
  photo_url: 1000,
  /** An IANA time zone name; the longest real one is ~32 characters. */
  timezone: 100,
} as const;

export type FieldLimit = keyof typeof FIELD_LIMITS;

/**
 * The sentence shown when a field is too long — the same words wherever the
 * refusal comes from, so the form and the API cannot describe one limit two
 * ways.
 *
 * Deliberately says the number. "Too long" leaves the person guessing how
 * much to cut, which is the workaround again in a politer font.
 */
export function tooLongMessage(label: string, limit: number): string {
  return `${label} can be at most ${limit.toLocaleString('en-GB')} characters.`;
}
