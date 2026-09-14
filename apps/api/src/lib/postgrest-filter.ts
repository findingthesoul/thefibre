// Free text into a PostgREST `.or()` filter, safely.
//
// PostgREST filter strings are a grammar: `col.ilike.%x%,col2.ilike.%x%`.
// A search term written straight into that string can carry the grammar's
// own characters — a comma starts the next condition, a parenthesis opens
// or closes a group, a dot separates operator from value. The two contact
// searches (persons, organisations) did exactly that from May 2026 until
// 2026-09-14. RLS bounded what such a term could reach, and nothing was
// exploited, but a filter a visitor can rewrite is not a filter.
//
// The rule (handbook, "PostgREST .or() strings are injectable"): never
// interpolate a value into filter syntax. Where a typed query cannot express
// the OR — supabase-js has no or-of-ilikes — the value is quoted per the
// PostgREST grammar: wrapped in double quotes, with any double quote or
// backslash inside escaped. A quoted value may contain commas, parens and
// dots and they mean nothing. The LIKE wildcards `%` and `_` are also
// escaped, so a term is matched as text, not as a pattern.
//
// Two layers unquote in turn, so the escapes are doubled: PostgREST strips
// one backslash from `\\"` and `\\\\` while reading the quoted value, then
// Postgres reads `\\%` as a literal percent. Seen on staging 2026-09-14: a
// single `\\%` reached Postgres as a bare `%` and matched everything.

/** One `col.ilike."%term%"` clause per column, joined for `.or()`. */
export function orIlike(columns: readonly string[], term: string): string {
  const escaped = term
    .replace(/\\/g, '\\\\\\\\') // a literal backslash: \\\\ for PostgREST → \\ for LIKE
    .replace(/[%_]/g, (ch) => `\\\\${ch}`) // a literal wildcard: \\% for PostgREST → \% for LIKE
    .replace(/"/g, '\\"');
  return columns.map((col) => `${col}.ilike."%${escaped}%"`).join(',');
}
