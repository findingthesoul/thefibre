'use server';

// How you know somebody.
//
// ── Why this file exists at all ────────────────────────────────────────────
//
// The landscape reads the community five ways, and one of them — `closeness` —
// is by design the axis a human types in. The SQL says so: *"the one axis a
// human types in by hand, and the only place in this surface where that is
// right: how close somebody feels is not derivable from events."* It reads
// `person_relationship_context.relationship_strength`.
//
// The endpoint has existed since the first migration, and it is tagged
// `fibre-sales` — meaning THIS app is what justifies the field existing at all
// (brief §5, "the app justifies the field"). And until now Connections never
// read or wrote it. So that axis showed everybody as `unrated` for ever, and
// `unrated` is deliberately a visible band rather than a silent default, which
// meant the landscape was honestly reporting that a fifth of itself was
// unusable.
//
// Found in the 2026-09-13 backlog sweep (docs/connections-backlog.md §0), and
// asked for the same day: *"And then see the CONNECTION card wirh absic info
// (maybe edit their relation fields)."*
//
// ── One row, PATCHed in parts ──────────────────────────────────────────────
//
// `person_relationship_context` is one row per person, and the API upserts it,
// so sending a single field leaves the rest alone. That is what lets the card
// save each control as it is touched rather than making somebody fill in a
// form to record one thing.

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';
// The VALUES live next door, in a module with no directive. A constant
// exported from a 'use server' module reaches the browser as a proxy, not as
// an array — see relationship-vocab.ts. Only types cross from here.
import type { Relationship } from './relationship-vocab';

export type { Relationship, Source, Strength } from './relationship-vocab';

export type LoadRelationshipResult =
  | { ok: true; relationship: Relationship | null }
  | { ok: false; error: string };

/**
 * What is recorded about knowing this person, or null if nothing is.
 *
 * Null is the normal state and not an error: the row is created on first
 * write, so somebody nobody has rated has no row at all.
 */
export async function loadRelationship(personId: string): Promise<LoadRelationshipResult> {
  try {
    const r = await apiFetch<Relationship | null>(`/api/v1/persons/${personId}/relationship`);
    return { ok: true, relationship: r };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: `API ${e.status}` };
    return { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
  }
}

export type SaveRelationshipResult = { ok: true } | { ok: false; error: string };

/**
 * Record one part of it.
 *
 * Deliberately a partial: the card saves a chip the moment it is pressed, so
 * this is called with `{ relationship_strength: 'warm' }` and nothing else.
 * The API upserts, so the other columns are untouched.
 *
 * `null` is a real value and means "unsay it" — clearing a strength puts the
 * person back in `unrated`, which is a band somebody can legitimately want
 * them in. It is not the same as leaving the field out.
 *
 * The landscape is revalidated because `closeness` reads exactly this column,
 * and a rating that did not move the band it feeds would look like it had not
 * saved.
 */
export async function saveRelationship(
  personId: string,
  patch: Partial<Relationship>,
): Promise<SaveRelationshipResult> {
  try {
    await apiFetch(`/api/v1/persons/${personId}/relationship`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    revalidatePath('/landscape');
    revalidatePath(`/people/${personId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 403) return { ok: false, error: 'forbidden' };
      const body = e.body as { error?: unknown } | undefined;
      return { ok: false, error: typeof body?.error === 'string' ? body.error : `API ${e.status}` };
    }
    return { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
  }
}
