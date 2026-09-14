// A URL slug from a human name. ONE implementation (2026-09-14): Meet's
// name-slug field, Thread's, and Thread's template duplicator each had their
// own, two identical and one subtly different (NFD instead of NFKD, so a
// ligature or a full-width digit survived in one place and not the others).
//
// Lower-case ASCII letters and digits, runs of anything else collapsed to a
// single hyphen, no leading or trailing hyphen, at most 60 characters. The
// same shape the API's root-slug rules accept.

// Letters NFKD cannot take apart: they have no base letter to decompose to,
// so without this Søren becomes "s-ren" (which is what every copy did).
const FOLD: Record<string, string> = {
  ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', ł: 'l', đ: 'd', ð: 'd', þ: 'th',
};

export function slugify(s: string, max = 60): string {
  return s
    .toLowerCase()
    .replace(/[øæœßłđðþ]/g, (c) => FOLD[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

/** A few base-36 characters to make a colliding slug unique. */
export function randomSlugSuffix(len = 4): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + len);
}
