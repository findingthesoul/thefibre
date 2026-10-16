// Formatting shared by every tab. One place, so a date does not read one way
// on Next and another on Purchases.
//
// In the reader's language since 2026-10-16 (my.thread in six languages).
// The locale is OPTIONAL and defaults to English, whose Intl tag is en-GB —
// exactly what every function here hardcoded before, so an English page reads
// the same to the character (pinned in format.test.ts). A caller not yet moved
// to a locale keeps its English output.

import { INTL_LOCALES, toLocale, type Locale } from '@thefibre/shared/i18n';

/** The Intl tag for a surface locale; anything unknown is English (en-GB). */
export function intlTag(locale?: Locale | string | null): string {
  return INTL_LOCALES[toLocale(locale ?? null)];
}

export function money(cents: number, currency: string, locale?: Locale | string | null): string {
  return new Intl.NumberFormat(intlTag(locale), { style: 'currency', currency }).format(cents / 100);
}

export function fmtDate(iso: string | null, locale?: Locale | string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat(intlTag(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function fmtDateTime(iso: string, locale?: Locale | string | null): string {
  return new Intl.DateTimeFormat(intlTag(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** "14:30" — the clock on a card. 24-hour in every locale we speak. */
export function fmtTime(iso: string, locale?: Locale | string | null): string {
  return new Intl.DateTimeFormat(intlTag(locale), { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** The two halves of a date chip: "14" over "Oct". */
export function dayMonth(iso: string, locale?: Locale | string | null): { day: string; month: string } {
  const d = new Date(iso);
  const tag = intlTag(locale);
  return {
    day: new Intl.DateTimeFormat(tag, { day: 'numeric' }).format(d),
    month: new Intl.DateTimeFormat(tag, { month: 'short' }).format(d),
  };
}

/** "14 October 2026" — a certificate's issue date. */
export function fmtLongDate(iso: string, locale?: Locale | string | null): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return new Intl.DateTimeFormat(intlTag(locale), { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

/** "Anna and Ben", "Anna, Ben en Carla". English keeps the plain 'en' tag
 *  this list was always formatted with (its serial comma, "A, B, and C"),
 *  rather than en-GB's — an English page must not change by a comma. */
export function listOf(names: string[], locale?: Locale | string | null): string {
  const l = toLocale(locale ?? null);
  return new Intl.ListFormat(l === 'en' ? 'en' : intlTag(l), { type: 'conjunction' }).format(names);
}
