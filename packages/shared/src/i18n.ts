// The platform's i18n mechanism — ONE definition of the locale list
// (docs/i18n-proposal.md, D1–D5 decided 2026-09-05). Catalogs stay
// per-surface, next to their consumers (apps/thread/lib/i18n.ts,
// apps/membership/lib/i18n.ts, apps/api/src/lib/email/*); only the
// mechanism lives here. Adding a locale here breaks every incomplete
// catalog at `pnpm -r typecheck` — that is the point.
//
// THE RULE (unchanged from the Thread): every string a participant,
// member or visitor can see lives in a catalog, in ALL locales.
// Internal/admin UI stays English until a paying non-EN workspace asks.

export const LOCALES = ['en', 'nl', 'es', 'pt', 'de', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  nl: 'Nederlands',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
  fr: 'Français',
};

/** BCP-47 tags for Intl.DateTimeFormat / NumberFormat per surface locale. */
export const INTL_LOCALES: Record<Locale, string> = {
  en: 'en-GB',
  nl: 'nl-NL',
  es: 'es-ES',
  // pt-BR: the catalogs' Portuguese is Brazilian-leaning (você, gerunds —
  // the Thread precedent), so dates/amounts format to match. If the native
  // review moves the prose to European Portuguese, flip this WITH it.
  pt: 'pt-BR',
  de: 'de-DE',
  fr: 'fr-FR',
};

/** One catalog entry: a string in every locale. Missing one = type error. */
export type I18nEntry = Record<Locale, string>;

export function isLocale(v: string | null | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

/** Coerce anything (query param, db column, null) to a valid locale. */
export function toLocale(v: string | null | undefined): Locale {
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

/**
 * Bind a catalog to a typed `t()`. Usage:
 *
 *   const CATALOG = { enrol: { en: 'Enrol', … } } satisfies Record<string, I18nEntry>;
 *   export const t = makeT(CATALOG);
 *   t('nl', 'enrol'); t(locale, 'spots_left', { n: 3 });
 *
 * {placeholders} are substituted from vars. Unknown/absent locale → en.
 */
export function makeT<C extends Record<string, I18nEntry>>(catalog: C) {
  return function t(
    locale: Locale | string | null | undefined,
    key: keyof C,
    vars?: Record<string, string | number>,
  ): string {
    const entry = catalog[key] as I18nEntry;
    let s = entry[toLocale(typeof locale === 'string' ? locale : null)];
    if (vars) {
      for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    }
    return s;
  };
}
