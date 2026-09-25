// "An empty result must only ever mean there are none."
//
// testing-approach §1.9: every silent failure of 2026-09-23 had the same
// middle — `const { data } = await q; (data ?? [])` — which turns a PostgREST
// error into a plausible answer. A visitor with three tickets sees "no
// tickets"; a host's booked slots are offered as free. This is the one
// helper that refuses to do that: it reads the error the query returned and
// throws it, so the route answers 500 (Hono's default) and the log names the
// query, instead of answering nothing and calling it a list.
//
// Use it on every read whose EMPTY case has a meaning to the person looking
// at it. Decoration (a label, an avatar) may still degrade; a list may not.

type Result<T> = { data: T | null; error: { message: string; code?: string } | null };

export function rows<T>(what: string, res: Result<T[]>): T[] {
  if (res.error) throw new Error(describe(what, res.error));
  return res.data ?? [];
}

export function row<T>(what: string, res: Result<T>): T | null {
  if (res.error) throw new Error(describe(what, res.error));
  return res.data;
}

/** "what: CODE message", with no gap where a missing code would leave one.
 *  The original built this inline and `.trim()`ed the ends, which left a
 *  double space in the middle of every error that had no code — most of
 *  them. Found by asserting on the text rather than on the throw. */
function describe(what: string, error: { message: string; code?: string }): string {
  return [`${what}:`, error.code, error.message].filter(Boolean).join(' ');
}

/**
 * The same rule for a counted read.
 *
 * `{ count: 'exact', head: true }` returns a number and no rows, so `rows()`
 * does not fit — and the default of `?? 0` is the same lie in a different
 * shape. A zero that means "the query failed" reads as "there are none",
 * which is exactly how lib/portal-erasure.ts would have told somebody their
 * account can be removed while fifteen people's places depended on it.
 */
export function count(what: string, res: { count: number | null; error: { message: string; code?: string } | null }): number {
  if (res.error) throw new Error(describe(what, res.error));
  return res.count ?? 0;
}
