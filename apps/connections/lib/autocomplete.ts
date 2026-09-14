// `#` and `@` suggestions while you type.
//
// Sjoerd, 2026-09-14: *"if I start with the hashtag, and I start typing, for
// example, hashtag f, that it shows in a drop down some of the options... And
// with the @, the company or the people, you start typing, and then you see
// the company."*
//
// Detection (detect-tags.ts) decides what a FINISHED word is. This decides
// what to offer for the word being typed right now, under the caret — so the
// two never overlap: a token under the caret is by definition unfinished,
// which is exactly what detection ignores.
//
// ── What each marker offers ────────────────────────────────────────────────
//
//   #  the workspace's own tags that are NOT organisations
//   @  people, and organisations
//
// That split follows his own words — "hashtag for hashtags", "@ for
// businesses and people" — and the rule already in detect-tags.ts: a person
// is only ever attached by intent, and `@` plus a pick from this list IS
// intent.
//
// ── What gets inserted ─────────────────────────────────────────────────────
//
// A tag or name with spaces cannot live inside `#word` or `@word`, so spaces
// become hyphens: "deep democracy" is inserted as `#deep-democracy`. That is
// not a new convention invented here — detection FOLDS punctuation to spaces
// before comparing, so the hyphenated form resolves back to the exact tag or
// person it was picked from. The test file proves that round trip.
//
// Pure: no React, no DOM. The composer owns the caret and the keyboard.

export type Trigger = '#' | '@';

export type ActiveToken = {
  trigger: Trigger;
  /** What has been typed after the marker, possibly empty. */
  query: string;
  /** Index of the marker itself. */
  start: number;
  /** Index just past the last typed character — the caret. */
  end: number;
};

export type Suggestion = {
  kind: 'tag' | 'organisation' | 'person';
  id?: string;
  name: string;
  /** A tag nobody has used yet, made from exactly what was typed. */
  isNew?: boolean;
};

const TOKEN_CHAR = /[\p{L}\p{N}_.\-]/u;

/**
 * The `#word` or `@word` the caret sits at the end of, if any.
 *
 * Three rules keep this from firing where it should not:
 *
 *  - The marker must start a word — the beginning of the text, or after
 *    whitespace or an opening bracket. Otherwise every email address typed
 *    into a note (`jan@ebbf.org`) would open a list of people.
 *  - The caret must be at the END of the token. A caret in the middle of an
 *    existing `#tag` is somebody editing, not somebody looking something up.
 *  - A marker with nothing typed yet still counts. `@` alone offers people,
 *    which is the fastest route to somebody whose name you cannot spell.
 */
export function activeToken(text: string, caret: number): ActiveToken | null {
  if (caret < 0 || caret > text.length) return null;
  // Editing the middle of a word is not a lookup.
  if (caret < text.length && TOKEN_CHAR.test(text[caret]!)) return null;

  let i = caret - 1;
  while (i >= 0 && TOKEN_CHAR.test(text[i]!)) i--;
  if (i < 0) return null;

  const marker = text[i];
  if (marker !== '#' && marker !== '@') return null;

  const before = i === 0 ? '' : text[i - 1]!;
  if (before && !/[\s([{"'“‘]/u.test(before)) return null;

  const query = text.slice(i + 1, caret);
  // A token must start with a letter or digit, like the detection patterns.
  if (query && !/^[\p{L}\p{N}]/u.test(query)) return null;

  return { trigger: marker, query, start: i, end: caret };
}

const fold = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * What to offer for a token, best first, at most `limit`.
 *
 * Ranked: the whole name starting with what was typed, then any word in it,
 * then alphabetical. "f" puts `#facilitation` above `#self-funded`, because
 * the first is almost certainly what somebody typing `#f` is reaching for.
 */
export function suggest(
  token: ActiveToken,
  words: readonly { id?: string; name: string; organisationId?: string }[],
  people: readonly { id: string; name: string }[],
  limit = 6,
): Suggestion[] {
  const q = fold(token.query);

  const pool: Suggestion[] =
    token.trigger === '#'
      ? words
          .filter((w) => !w.organisationId)
          .map((w) => ({ kind: 'tag' as const, ...(w.id ? { id: w.id } : {}), name: w.name }))
      : [
          ...people.map((p) => ({ kind: 'person' as const, id: p.id, name: p.name })),
          ...words
            .filter((w) => w.organisationId)
            .map((w) => ({ kind: 'organisation' as const, id: w.organisationId!, name: w.name })),
        ];

  const rank = (s: Suggestion): number => {
    if (!q) return 2;
    const n = fold(s.name);
    const joined = q.replace(/ /g, '');
    if (n.startsWith(q) || n.replace(/ /g, '').startsWith(joined)) return 0;
    if (n.split(' ').some((w) => w.startsWith(q))) return 1;
    return -1;
  };

  return pool
    .map((s) => ({ s, r: rank(s) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.s.name.localeCompare(b.s.name))
    .slice(0, limit)
    .map((x) => x.s);
}

/** How a picked suggestion is written into the sentence. */
export function tokenText(trigger: Trigger, name: string): string {
  return trigger + name.trim().replace(/\s+/g, '-');
}

/**
 * Replace the token with the pick, followed by a space.
 *
 * The space matters twice: the caret lands ready for the next word, and the
 * token is now FINISHED — detection only recognises a word with something
 * after it, so without the space the pick would not highlight until the next
 * keystroke.
 */
export function applySuggestion(
  text: string,
  token: ActiveToken,
  pick: Suggestion,
): { text: string; caret: number } {
  const insert = `${tokenText(token.trigger, pick.name)} `;
  const after = text.slice(token.end).replace(/^ /, '');
  const next = text.slice(0, token.start) + insert + after;
  return { text: next, caret: token.start + insert.length };
}

// ── Over a space, and making a tag that does not exist yet ──────────────────
//
// Sjoerd, 2026-09-14: *"type a word... there could be a space... when done
// with the # or @, then enter and it turns it into a tag, person or
// organisation."*
//
// So a lookup may run over up to THREE words, and `#` always offers to make
// what was typed into a new tag. Enter (or Tab) is what commits it — a space
// never does, since a space is also how a sentence carries on.
//
// Three rules stop a spaced lookup swallowing ordinary writing:
//
//  - If the first word is ALREADY a whole tag, person or organisation, the
//    words after it are the sentence carrying on, not more of the name:
//    `#facilitation went well` opens nothing.
//  - Punctuation ends it. A full stop or comma is where a phrase stops.
//  - Three words at most. After that the list closes on its own, and Escape
//    closes it for the rest of that phrase.
//
// `@` never offers "new": naming somebody who is not a person in the
// workspace yet makes a person record, and that is its own decision
// (backlog §1.3), not a side effect of pressing Enter in a note.

const SPACED = /(^|[\s([{"'“‘])([#@])([\p{L}\p{N}][\p{L}\p{N}_\-]*(?: [\p{L}\p{N}_\-]+){0,3} ?)$/u;
const MAX_SPACED_WORDS = 3;

/**
 * The word or short phrase being looked up, and what to offer for it.
 * `activeToken` alone still answers "is a single word being typed".
 */
export function lookup(
  text: string,
  caret: number,
  words: readonly { id?: string; name: string; organisationId?: string }[],
  people: readonly { id: string; name: string }[],
  limit = 6,
): { token: ActiveToken; suggestions: Suggestion[] } | null {
  if (caret < 0 || caret > text.length) return null;
  if (caret < text.length && TOKEN_CHAR.test(text[caret]!)) return null;

  let token = activeToken(text, caret);
  if (!token) {
    const m = SPACED.exec(text.slice(0, caret));
    if (!m || !m[3]!.includes(' ')) return null;
    const query = m[3]!.replace(/ $/, '');
    if (query.split(' ').length > MAX_SPACED_WORDS) return null;
    token = { trigger: m[2] as Trigger, query, start: caret - m[3]!.length - 1, end: caret };

    // A finished name followed by more of the sentence is not a lookup.
    const first = fold(query.split(' ')[0]!);
    const names =
      token.trigger === '#'
        ? words.filter((w) => !w.organisationId).map((w) => w.name)
        : [...people.map((p) => p.name), ...words.filter((w) => w.organisationId).map((w) => w.name)];
    if (names.some((n) => fold(n) === first)) return null;
  }

  const found = suggest(token, words, people, limit);
  if (token.trigger === '#' && token.query) {
    const typed = fold(token.query);
    if (typed && !found.some((f) => fold(f.name) === typed)) {
      found.push({ kind: 'tag', name: token.query.trim(), isNew: true });
    }
  }
  return found.length ? { token, suggestions: found } : null;
}
