// The vocabulary of knowing somebody: the values the database will accept.
//
// ── Why this is not in relationship.ts ─────────────────────────────────────
//
// That file is `'use server'`, and **everything a 'use server' module exports
// must be an async function**. A constant exported from one does not arrive in
// the browser as a constant: Next replaces the module's exports with proxies
// that call the server, so `STRENGTHS.map(...)` typechecks, builds, and then
// throws `STRENGTHS.map is not a function` on first render.
//
// Which is exactly what it did, on 2026-09-13, caught in the browser and not
// by the compiler. The same trap is written up in landscape/axes.ts for the
// mirror-image case (a constant in a 'use client' module read by a server
// component). Both say the same thing: a module holding VALUES that both sides
// read must carry no directive at all.
//
// Types are fine either way — they are erased before any of this matters.

export const STRENGTHS = ['weak', 'warm', 'strong', 'advocate'] as const;
export type Strength = (typeof STRENGTHS)[number];

/**
 * How the relationship started. The database CHECKs these exact strings, so
 * this list and the column's constraint have to agree — adding one is a
 * migration, not an edit here.
 */
export const SOURCES = [
  'event_attendee',
  'referral',
  'cold_outreach',
  'client_contact',
  'inbound',
] as const;
export type Source = (typeof SOURCES)[number];

export type Relationship = {
  relationship_strength: Strength | null;
  source: Source | null;
  /** Free text, and only meaningful for `event_attendee`: which thing. */
  source_detail: string | null;
  /** A person, and only meaningful for `referral`. */
  introduced_by: string | null;
  /** A company, and only meaningful for `client_contact`. */
  via_organisation_id: string | null;
  is_key_contact: boolean;
  is_ambassador: boolean;
};

/**
 * What each way of meeting needs to be answered, if anything.
 *
 * Sjoerd, 2026-09-13: *"SHould this not be contextuel: At something: what
 * (text) / Introduced: (search: person) / I reached out (nothing) / Through
 * work: (search: company) / They reach out: nothing"*.
 *
 * Before this, one person picker sat under the list whatever you chose, so
 * "Introduced by" was on screen next to "At something" — which reads as a
 * second, unrelated question rather than as the rest of the first one.
 *
 * The three shapes are deliberately not one nullable field. Each writes to a
 * different column, and two of them write an IDENTIFIER: a person you picked
 * and a company you picked are entities, not words (handbook §12).
 */
export type SourceDetail = 'text' | 'person' | 'organisation' | null;

export const SOURCE_NEEDS: Record<Source, SourceDetail> = {
  event_attendee: 'text',
  referral: 'person',
  cold_outreach: null,
  client_contact: 'organisation',
  inbound: null,
};

/** Has anybody answered any of this? Decides which tab a popup opens on. */
export function relationshipAnswered(r: Relationship | null): boolean {
  if (!r) return false;
  return Boolean(
    r.relationship_strength || r.source || r.introduced_by || r.via_organisation_id,
  );
}
