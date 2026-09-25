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
  if (res.error) throw new Error(`${what}: ${res.error.code ?? ''} ${res.error.message}`.trim());
  return res.data ?? [];
}

export function row<T>(what: string, res: Result<T>): T | null {
  if (res.error) throw new Error(`${what}: ${res.error.code ?? ''} ${res.error.message}`.trim());
  return res.data;
}
