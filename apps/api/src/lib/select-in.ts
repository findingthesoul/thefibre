// Reads that stay whole when the list gets long.
//
// Two ceilings, neither of which says anything when it is hit:
//
//   PostgREST returns at most 1,000 rows per request (Supabase's max-rows).
//   Past that, the answer is simply shorter. No error, no header anybody
//   reads — a community of 1,200 members shows 1,000 of them, in whatever
//   order the database felt like.
//
//   An `.in('id', [...])` filter travels in the URL. A thousand uuids is
//   ~40KB of query string, past what the proxies in front of PostgREST
//   accept, and that one DOES fail — as a 414 or a dropped connection,
//   on the day a community crosses some size nobody wrote down.
//
// So a list read goes through here: the values are split into chunks that
// fit a URL, the chunks are read side by side, and each chunk is paged with
// `.range` until a page comes back short. Errors throw via `rows()`, so an
// empty result still only ever means there are none (testing-approach §1.9).
//
// The builder must ORDER by a unique key: paging an unordered result can
// skip or repeat rows between pages.

import { rows } from './rows.js';

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>;
type Rangeable<T> = { range(from: number, to: number): Page<T> };

/** Rows per request. PostgREST's cap; asking for more returns this many. */
export const PAGE_SIZE = 1000;
/** Values per `.in()` list. 100 uuids is ~4KB of URL — far from any limit,
 *  and short enough for an email list too. */
export const CHUNK_SIZE = 100;

/** Every row of one query, paged. */
export async function selectAll<T>(what: string, build: () => Rangeable<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = rows(what, await build().range(from, from + PAGE_SIZE - 1));
    out.push(...page);
    if (page.length < PAGE_SIZE) return out;
  }
}

/** Every row matching a long `.in()` list: chunked, chunks read in
 *  parallel, each paged. Duplicate values are read once. */
export async function selectIn<T>(
  what: string,
  values: readonly string[],
  build: (chunk: string[]) => Rangeable<T>,
): Promise<T[]> {
  const unique = [...new Set(values)];
  if (!unique.length) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += CHUNK_SIZE) chunks.push(unique.slice(i, i + CHUNK_SIZE));
  const parts = await Promise.all(chunks.map((chunk) => selectAll(what, () => build(chunk))));
  return parts.flat();
}
