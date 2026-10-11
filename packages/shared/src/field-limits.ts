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

  // ── Billing details ──────────────────────────────────────────────────────
  // Typed on Settings → Payments, which is one shared form rendered by Meet,
  // Membership, Pulse, Thread and the platform. These were the last limits
  // the API knew and the person typing did not, which is the whole complaint
  // this module exists for: the field accepted the text, the save returned
  // 400, and the only remedy within reach was to shorten what they had
  // written.

  /** The seller name printed on an invoice — a company name with its legal
   *  form, occasionally a long one ("… coöperatie U.A."). */
  legal_name: 200,
  /** The seller address block. Multi-line, so it is the longest of these: a
   *  street, a postcode and a city, sometimes a country and a PO box. */
  address: 500,
  /** A VAT or company registration number. The longest real formats run to
   *  about 20 characters; 60 leaves room for a label somebody types in front
   *  of it ("VAT: NL0012345B01"). */
  tax_no: 60,
  /** The seller website, printed under the address on the invoice. */
  website: 200,
  /** A Stripe account id — `acct_` and 16–24 characters, pasted rather than
   *  typed. The regex on it is the real check; this is the length guard. */
  stripe_account_id: 64,
  /**
   * A locale code: `en`, `nl`, `pt-BR`. Here so the schema stops writing its
   * own number, NOT because anybody can type past it — it is chosen from a
   * select, and the real validation is membership of LOCALES.
   *
   * So this one gets no form-side check. A length refusal on a dropdown is
   * theatre: it can never fire, and a reader would have to work that out
   * before trusting anything else here. The home is worth having; the
   * ceremony is not.
   */
  locale: 8,
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
