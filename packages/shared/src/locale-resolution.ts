// WHICH LANGUAGE IS THIS SURFACE IN — the one answer, for the whole family.
//
// Sjoerd, 2026-09-30: "Ik dacht dat de hele app meertalig was. Kun je daar een
// SPoT voor maken?" He was right to expect it and right that it was not true.
// Meet's signed-in shell followed the profile language in six locales while
// its PUBLIC booking page and all four booking emails were hardcoded English,
// and nothing anywhere said which rule applied where. Three resolvers existed
// (each app's `uiLocale`, `platformEmailLocale`, Thread's public pages) and
// none of them knew about the others.
//
// So: the RULES live here, once. The catalogs stay next to their consumers —
// a translation is content and belongs beside the screen it serves; a
// resolution chain is a decision and belongs in one place. That split is the
// same one `shared decides WHAT, the caller decides HOW` already makes.
//
// These functions take values that are ALREADY FETCHED. No database, no
// cookies, no headers — so every chain is testable without a running system,
// and the same function serves a Next server component and a Hono route.

import { DEFAULT_LOCALE, isLocale, toLocale, type Locale } from './i18n.js';

/** A value that may or may not be a locale — a column, a cookie, a header. */
type Maybe = string | null | undefined;

/** The first of these that is a locale we speak, else English. */
function firstLocale(...candidates: Maybe[]): Locale {
  for (const c of candidates) {
    if (isLocale(c)) return c;
  }
  return DEFAULT_LOCALE;
}

/**
 * THE SIGNED-IN INTERFACE — what the person using the app sees.
 *
 * Their choice, and nobody else's: a workspace does not get to decide what
 * language you read your own tools in. The cookie is per-browser and wins
 * when present; the profile carries the setting between devices (Sjoerd's
 * phone stayed English while his desktop went Dutch, 2026-09-07).
 */
export function resolveUiLocale(a: { cookie?: Maybe; profile?: Maybe }): Locale {
  return firstLocale(a.cookie, a.profile);
}

/**
 * A PUBLIC PAGE — what a visitor sees before we know anything about them.
 *
 * The override comes first because it is the most specific statement anyone
 * has made: this particular booking page, this particular thread, is in
 * English even though I work in Dutch. Then the owner's own language, which
 * is the sensible default for everything they publish.
 *
 * `visitorPreference` is last and OPTIONAL on purpose. A browser's
 * Accept-Language is a guess about the reader, while the override and the
 * owner's setting are decisions by the person who made the page. Pass it only
 * where guessing is better than defaulting to English — and never let it
 * overrule a page whose language was chosen deliberately.
 */
export function resolvePublicLocale(a: {
  /** Set on the thing itself — a meeting type, a thread. Wins. */
  surfaceOverride?: Maybe;
  /** The host's or organiser's own language. */
  ownerProfile?: Maybe;
  /** Accept-Language, already narrowed to one tag. A guess, so it goes last. */
  visitorPreference?: Maybe;
}): Locale {
  return firstLocale(a.surfaceOverride, a.ownerProfile, a.visitorPreference);
}

/**
 * AN EMAIL — what the person opening it reads.
 *
 * Their own language first, whenever we know it: a confirmation is for the
 * reader, not for the sender. Only then the language of the surface it came
 * from, which is the best available guess for somebody we have never met —
 * a booking made on an English page probably wants an English confirmation.
 *
 * Note what is NOT in this chain: the SENDER's interface language. The host
 * reading Meet in Dutch is not a reason to write to a German invitee in Dutch.
 */
export function resolveEmailLocale(a: {
  /** identity_profile.locale for the recipient, if they have a profile. */
  recipientProfile?: Maybe;
  /** The language of the page this email follows from. */
  surface?: Maybe;
}): Locale {
  return firstLocale(a.recipientProfile, a.surface);
}

/**
 * Narrow a raw `Accept-Language` header to one tag we speak.
 *
 * Quality values are honoured, because a browser that says
 * `fr;q=0.2, nl;q=0.9` means Dutch, and reading it left to right gets that
 * exactly backwards. Region subtags are dropped: `nl-BE` is Dutch to us, and
 * pretending otherwise would send a Flemish reader English.
 */
export function localeFromAcceptLanguage(header: Maybe): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      const weight = q ? Number(q.trim().slice(2)) : 1;
      return { tag: tag.trim().toLowerCase().split('-')[0] ?? '', weight: Number.isFinite(weight) ? weight : 0 };
    })
    .filter((x) => x.tag && x.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  for (const { tag } of ranked) {
    if (isLocale(tag)) return tag;
  }
  return null;
}

/** `toLocale` re-exported so a caller needs one import, not two. */
export { toLocale, isLocale, DEFAULT_LOCALE };
export type { Locale };
