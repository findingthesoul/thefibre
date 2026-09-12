// Finding the tags already present in a sentence somebody wrote.
//
// Sjoerd, 2026-09-12: *"if you type something after a visit or conversation,
// that it would integrate tags in the text... which connects things (without
// you having to do it)."*
//
// ── What this is NOT ────────────────────────────────────────────────────────
//
// Not a model, and nothing here leaves the browser. Note bodies are the most
// sensitive text in the system — what a person said in a conversation — and
// sending them to a language model is a processing operation that needs a
// sub-processor entry, an EU endpoint and a DPA before it can happen at all
// (connections-data-integrity.md §9.5). None of that is required to do the
// useful 80%, because the workspace's own vocabulary is already known.
//
// So: two rules, both deterministic, both explainable to the person typing.
//
//   1. `#something` is an explicit tag. Unambiguous, and the escape hatch for
//      a word the workspace has never used before.
//   2. A word this workspace ALREADY uses, appearing in the text, is that
//      tag. The vocabulary has two sources: tags somebody made, and the names
//      of organisations this workspace holds — Sjoerd, same conversation:
//      *"e.g. company names are tags (if they exist; if not you can create
//      it)"*. This is the half that does the work. It grows as the workspace
//      does and it can never invent a term nobody chose.
//
// ── Why not match bare names or arbitrary nouns ─────────────────────────────
//
// Because the cost of a wrong tag is paid by somebody who did not ask for it.
// A false positive attaches a claim to a real person's record, and the whole
// data-integrity argument is that Fibre declines to hold what it cannot stand
// behind. Matching only the workspace's own words keeps precision high enough
// that the chips can default to ON, which is what makes it feel automatic
// rather than like another form to fill in.
//
// ── The matching rules, and why each one is there ───────────────────────────

/**
 * A word this workspace already uses.
 *
 * `organisationId` is set when the word is an organisation's name rather than
 * an existing tag. The tag may not exist yet in that case — it is created on
 * commit, carrying the pointer — which is what "if they exist; if not you can
 * create it" means in practice: the ORGANISATION has to exist, the tag does
 * not.
 */
export type KnownTag = { id?: string; name: string; organisationId?: string };

export type DetectedTag = {
  /** Present when the tag already exists; absent for one about to be made. */
  id?: string;
  name: string;
  /** Set when this word names an organisation the workspace holds. */
  organisationId?: string;
  /**
   * How it was found. Shown to the person, because a tag that appeared on its
   * own has to be able to say why: an organisation they named, a word their
   * workspace already uses, or a hash they typed themselves.
   */
  via: 'hash' | 'known' | 'organisation';
};

/**
 * Hashes are lifted verbatim minus the `#`. Unicode letters are allowed
 * because this product runs in six languages and `#opbouwwerk` is as valid a
 * tag as `#outreach`; digits and hyphens because `#sdg13` and `#co-creation`
 * are the shapes people actually type.
 */
const HASH = /#([\p{L}\p{N}][\p{L}\p{N}_-]{1,39})/gu;

/**
 * Punctuation and case are noise when comparing a tag to prose. Accents are
 * NOT stripped: "café" and "cafe" are different words to the person who typed
 * one of them, and folding them would make the chip look like a typo.
 */
function fold(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * Whole-word containment, so the tag "art" does not fire on "participate".
 * Both sides are folded to single-spaced lowercase first, which makes a
 * multi-word tag ("deep democracy") match across any punctuation between its
 * words.
 */
function containsPhrase(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return ` ${haystack} `.includes(` ${needle} `);
}

/**
 * Tags worth matching against prose. A very short tag is excluded because it
 * collides with ordinary words in some language: "de", "is", "op" are all
 * real Dutch words and all plausible tag fragments, and one false positive on
 * a person's record costs more than the missed match.
 */
const MIN_KNOWN_TAG_LENGTH = 3;

/**
 * A word only becomes a tag once it is FINISHED — Sjoerd, 2026-09-12: *"when
 * typing... and a word is finished... it can turn it into a tag"*.
 *
 * Without this, typing `#sdg13` flickers through `#s`, `#sd`, `#sdg` and
 * `#sdg1`, each of which would appear as a tag for a few hundred
 * milliseconds and two of which would be offered for creation. A hash at the
 * very end of the text with nothing after it is still being typed; anywhere
 * else, a following space or punctuation mark has already ended it.
 */
function isFinished(text: string, matchEnd: number): boolean {
  return matchEnd < text.length;
}

export function detectTags(text: string, known: readonly KnownTag[]): DetectedTag[] {
  const out: DetectedTag[] = [];
  const seen = new Set<string>();
  const byFolded = new Map(known.map((t) => [fold(t.name), t]));

  // Hashes first, so an explicit `#sdg13` keeps its `hash` provenance even
  // when sdg13 also happens to be a known tag. The person typed the hash;
  // saying it was inferred would be a small lie about their own input.
  for (const m of text.matchAll(HASH)) {
    const raw = m[1]!;
    if (!isFinished(text, m.index + m[0].length)) continue;
    const key = fold(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const existing = byFolded.get(key);
    out.push(
      existing
        ? {
            ...(existing.id ? { id: existing.id } : {}),
            ...(existing.organisationId ? { organisationId: existing.organisationId } : {}),
            name: existing.name,
            via: 'hash',
          }
        : { name: raw, via: 'hash' },
    );
  }

  // Then the workspace's own vocabulary, against the text with hashes removed
  // so `#outreach` is not also reported as a plain mention of "outreach".
  const prose = fold(text.replace(HASH, ' '));
  for (const tag of known) {
    const key = fold(tag.name);
    if (key.length < MIN_KNOWN_TAG_LENGTH || seen.has(key)) continue;
    if (containsPhrase(prose, key)) {
      seen.add(key);
      out.push({
        ...(tag.id ? { id: tag.id } : {}),
        ...(tag.organisationId ? { organisationId: tag.organisationId } : {}),
        name: tag.name,
        via: tag.organisationId ? 'organisation' : 'known',
      });
    }
  }

  return out;
}

// ── @ — people and organisations, by intent ─────────────────────────────────
//
// Sjoerd, 2026-09-12: *"# for tags is great and @ for people or
// organisations."*
//
// THIS IS A DIFFERENT MECHANISM FROM EVERYTHING ABOVE, and the separation is
// deliberate rather than tidy. `detectTags` never sees people and must not:
// matching a person's name inside prose is a guess that attaches a claim to a
// real person's record, and this codebase refuses it (system-handbook §12,
// "attach a person by an EXACT identifier, never by a name in prose").
//
// `@` is not inference. Somebody typed a marker and picked from a list, which
// makes it intent — the same thing that makes a calendar attendee safe where
// a first name in a sentence is not. So people appear here and nowhere else.

export type KnownPerson = { id: string; name: string };

export type DetectedMention = {
  kind: 'person' | 'organisation';
  id: string;
  name: string;
  /** What was typed after the @, so the interface can show the fragment when
   *  nothing has matched it yet. */
  typed: string;
};

/** Same shape as HASH, same finished-word rule. Dots and hyphens are allowed
 *  because people type `@jan.de.vries`. */
const AT = /@([\p{L}\p{N}][\p{L}\p{N}_.\-]{1,59})/gu;

/** Does `key` begin any word of `name`, or the whole name with spaces gone? */
function matchesFragment(name: string, key: string): boolean {
  const folded = fold(name);
  if (folded.replace(/ /g, '').startsWith(key.replace(/ /g, ''))) return true;
  return folded.split(' ').some((word) => word.startsWith(key));
}

/**
 * Resolve `@fragment` against people and organisations.
 *
 * A fragment matches when it begins any word of the name, folded — so
 * `@wilma`, `@doornbos` and `@wilmadoornbos` all find Wilma Doornbos.
 *
 * Only an UNAMBIGUOUS match counts. Two Wilmas produce nothing rather than a
 * coin toss, because the cost of picking the wrong one is a claim on the
 * wrong person's record — the same cost that keeps automatic name matching
 * out of this file entirely. Offering a choice is the composer's job; this
 * function does not guess.
 */
export function detectMentions(
  text: string,
  people: readonly KnownPerson[],
  organisations: readonly KnownTag[],
): DetectedMention[] {
  const out: DetectedMention[] = [];
  const seen = new Set<string>();

  for (const m of text.matchAll(AT)) {
    const typed = m[1]!;
    if (!isFinished(text, m.index + m[0].length)) continue;
    const key = fold(typed);
    if (!key || seen.has(key)) continue;

    const hits: DetectedMention[] = [];
    for (const p of people) {
      if (matchesFragment(p.name, key)) {
        hits.push({ kind: 'person', id: p.id, name: p.name, typed });
      }
    }
    for (const o of organisations) {
      if (o.organisationId && matchesFragment(o.name, key)) {
        hits.push({ kind: 'organisation', id: o.organisationId, name: o.name, typed });
      }
    }

    if (hits.length === 1) {
      seen.add(key);
      out.push(hits[0]!);
    }
  }

  return out;
}
