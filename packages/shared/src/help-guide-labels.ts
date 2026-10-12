// Do the help guides quote controls that still exist?
//
// A guide that tells somebody to press a button nobody can find is worse than
// no guide: they go looking, fail, and conclude the product is broken rather
// than the manual. It is also invisible — the guide text and the button text
// are two strings in the same catalogue and nothing compares them.
//
// It had already happened. On 2026-10-12 the contacts duplicates guide was
// telling people to press "Keep this one" while the button had long said
// "Merge into this one", in all six languages, alongside four other drifted
// labels. A hand-written check of TWO guides found EIGHTEEN mismatches. This
// is that check, generalised, so every app can run it over every guide.
//
// ── How a guide names a control ───────────────────────────────────────────
//
// By quoting it. That is the convention the guides already follow, so the
// check needs no hand-maintained list of which guide mentions which button —
// the list is the thing that goes stale, which is the failure this exists to
// prevent.
//
// LANGUAGES QUOTE DIFFERENTLY, and the first version of this check did not
// know that. It looked only for English curly quotes, so the German guides
// (which use low-9 opening quotes) and the French ones (guillemets) yielded
// ZERO phrases and passed in silence — a vacuous pass inside a check written
// to prevent vacuous passes. Hence `QUOTE_PATTERNS` below, and hence the
// per-locale counts in the report: a locale that quotes nothing while English
// quotes several is reported, because that is either a convention this file
// does not know or a translation that dropped the control names.
//
// Everything quoted that way must be a string this app actually renders, in
// EVERY locale. English passing while Dutch has drifted is the normal case:
// the Dutch guide and the Dutch button are translated at different times by
// different hands.
//
// ── What it cannot see ────────────────────────────────────────────────────
//
// A guide that names a control WITHOUT quoting it. Measured on 2026-10-12:
// Meet, Flow and Connections quote nothing in any of their 26 guides between
// them, so this check is vacuous for them and `quoted` comes back 0. That is
// reported rather than hidden — a check with nothing to check should say so,
// not pass quietly. Converting those guides to the quoting convention is a
// prose job, not a code one.

export type GuideException = {
  /** The quoted phrase, exactly as it appears in the guide. */
  phrase: string;
  /** Why it is quoted but is not a control — an example value, a heading on
   *  somebody else's page, a literal. Required: an exemption nobody has to
   *  justify is one nobody reviews. */
  why: string;
};

/**
 * How each language marks a quoted control.
 *
 *   English, Dutch, Spanish, Portuguese   “…”
 *   German                                „…“   (opens low-9, closes with
 *                                                the character English OPENS
 *                                                with — hence a separate
 *                                                pattern rather than one
 *                                                character class)
 *   French                                « … » (with spaces inside)
 *
 * Add a pattern when a language is added. A language whose convention is
 * missing here reads as "quotes nothing", which the report surfaces rather
 * than swallowing.
 */
const QUOTE_PATTERNS = [
  /\u201C([^\u201D]+)\u201D/g, // “…”
  /\u201E([^\u201C]+)\u201C/g, // „…“
  /\u00AB\s*([^\u00BB]+?)\s*\u00BB/g, // « … »
];

/** Every control a guide names, whatever the language's quote marks. */
function quotedControls(text: string): string[] {
  const found: string[] = [];
  for (const re of QUOTE_PATTERNS) {
    for (const m of text.matchAll(re)) found.push(m[1]!);
  }
  return found;
}

export type GuideLabelReport = {
  /** How many quoted phrases were examined. ZERO means this app quotes no
   *  controls at all, so the check proved nothing — see the note above. */
  quoted: number;
  /** Quoted phrases that are not a string this app renders, in some locale. */
  misses: string[];
  /** Exceptions for phrases that no guide quotes any more. An exemption list
   *  that outlives its reason is how a skip-list quietly grows: these fail. */
  stale: string[];
  /** How many controls each locale quotes. A locale sitting at 0 while
   *  English is at 20 is not a pass — it is a locale this check cannot see,
   *  and the caller should assert on it. */
  perLocale: Record<string, number>;
};

/**
 * Check one app's guides.
 *
 * `t` and `keys` come from the app's own catalogue, so what is compared is
 * what the app renders — not a copy of it in a test, which could itself drift.
 */
/** Generic over the app's own key union rather than taking `string`: every
 *  app types `t` to its own `UiKey`, and widening the parameter here would
 *  make the helper reject the very function it exists to call. `K` is
 *  inferred from `keys`, so the caller passes its catalogue unchanged. */
export function checkGuideLabels<K extends string>(opts: {
  locales: readonly string[];
  t: (locale: string, key: K) => string;
  /** Every key in the catalogue. Guides are found within it by key shape. */
  keys: readonly K[];
  exceptions?: readonly GuideException[];
}): GuideLabelReport {
  const { locales, t, keys, exceptions = [] } = opts;
  const guideKeys = keys.filter((k) => /^help_g_.+_steps$/.test(k));
  const allowed = new Set(exceptions.map((e) => e.phrase));
  const used = new Set<string>();

  const misses: string[] = [];
  const perLocale: Record<string, number> = {};
  let quoted = 0;

  for (const locale of locales) {
    // What this app renders in THIS locale — the set a quoted phrase must
    // belong to. Rebuilt per locale because that is the whole point: a label
    // can be right in English and stale in Dutch.
    const rendered = new Set<string>();
    for (const k of keys) {
      const v = t(locale, k);
      if (v) rendered.add(v);
    }

    for (const g of guideKeys) {
      const steps = t(locale, g);
      if (!steps) continue;
      for (const phrase of quotedControls(steps)) {
        quoted++;
        perLocale[locale] = (perLocale[locale] ?? 0) + 1;
        if (allowed.has(phrase)) {
          used.add(phrase);
          continue;
        }
        if (!rendered.has(phrase)) {
          misses.push(`${g} (${locale}): “${phrase}” is not a string this app renders`);
        }
      }
    }
  }

  for (const l of locales) perLocale[l] ??= 0;
  const stale = exceptions.filter((e) => !used.has(e.phrase)).map((e) => `“${e.phrase}” — ${e.why}`);
  return { quoted, misses, stale, perLocale };
}
