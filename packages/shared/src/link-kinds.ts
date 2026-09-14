// What a Membership product link can point at. ONE list (2026-09-14): the
// API validated `z.enum([...])` in routes/membership.ts and the Membership
// app declared the same four in products/types.ts — a classic cross-boundary
// duplicate, where adding a kind on one side silently 400s on the other.
//
// Display labels are per-locale (link_kind_* keys in the app's catalog), so
// no English map lives here.

export const LINK_KINDS = ['thread', 'meet', 'circle_space', 'url'] as const;
export type LinkKind = (typeof LINK_KINDS)[number];
