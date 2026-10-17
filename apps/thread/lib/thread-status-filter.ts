// The Threads list's status chip (All / Active / Drafts / Past). A plain
// module: the server page reads ?status= with it and the client list keeps
// its state in it, so the two cannot disagree on what "no status" means.

export type StatusFilter = 'all' | 'active' | 'draft' | 'past';

/** What the list shows when the address names no status (Sjoerd,
 *  2026-10-17: "Show active as default"). */
export const DEFAULT_STATUS: StatusFilter = 'active';

/** ?status= as a filter; anything else is the default. */
export function toStatusFilter(v: string | null | undefined): StatusFilter {
  return v === 'all' || v === 'active' || v === 'draft' || v === 'past' ? v : DEFAULT_STATUS;
}
