// The five axes as DATA — names, labels, the note under each band, and the
// sentence that says what would fill an axis nobody has fed yet.
//
// Separated from bands.tsx for the reason today/shape.ts exists: a module
// read by BOTH a server component and a 'use client' component must not
// itself be either one. Next replaces a client module's exports with proxies
// and erases the types, so a constant exported from a 'use client' file and
// imported by a server component typechecks and then crashes on first
// render. There is no JSX in this file and there should never be.

import { type UiKey } from '@/lib/i18n-ui';

// The five ways to read the same population (docs/connections-mobile.md §2,
// D32). Each list runs LOW TO HIGH, matching the API's own ladder for that
// axis — "up" in the movement list is a position in this array and nothing
// else, so the two must not drift. The API is the source: apps/api/src/
// routes/connections.ts BANDS.
export const AXES = ['maturity', 'closeness', 'cadence', 'opportunity', 'contribution'] as const;
export type Axis = (typeof AXES)[number];

export function isAxis(v: string | undefined | null): v is Axis {
  return !!v && (AXES as readonly string[]).includes(v);
}

export type Band = {
  rung: string;
  count: number;
  was: number;
  /** Net people who MOVED into this rung, excluding anyone who simply
   *  arrived in the window. count-minus-was would conflate the two and read
   *  as insight while being an artefact of a young workspace. */
  net_moved: number;
};
export type Moved = {
  person_id: string;
  from: string;
  to: string;
  up: boolean;
  person: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
};

export const AXIS_KEYS: Record<Axis, UiKey> = {
  maturity: 'axis_maturity',
  closeness: 'axis_closeness',
  cadence: 'axis_cadence',
  opportunity: 'axis_opportunity',
  contribution: 'axis_contribution',
};

export const AXIS_QUESTION_KEYS: Record<Axis, UiKey> = {
  maturity: 'axis_q_maturity',
  closeness: 'axis_q_closeness',
  cadence: 'axis_q_cadence',
  opportunity: 'axis_q_opportunity',
  contribution: 'axis_q_contribution',
};

// Explicit maps, not computed keys: the catalog is typed so a missing
// translation is a compile error, and a template key throws that away. One
// map per axis — five axes' worth of band names is the ONLY thing about this
// component that differs between them.
export const BAND_KEYS: Record<Axis, Record<string, UiKey>> = {
  maturity: {
    facilitator: 'rung_facilitator',
    contributor: 'rung_contributor',
    returned: 'rung_returned',
    attended: 'rung_attended',
    touched: 'rung_touched',
    never: 'rung_never',
  },
  closeness: {
    advocate: 'band_advocate',
    strong: 'band_strong',
    warm: 'band_warm',
    weak: 'band_weak',
    unrated: 'band_unrated',
  },
  cadence: {
    in_rhythm: 'band_in_rhythm',
    slowing: 'band_slowing',
    quiet: 'band_quiet',
    never_spoken: 'band_never_spoken',
  },
  opportunity: {
    committed: 'band_committed',
    proposal: 'band_proposal',
    open: 'band_open',
    none: 'band_none',
  },
  contribution: {
    brings_regularly: 'band_brings_regularly',
    brought_someone: 'band_brought_someone',
    brought_nobody: 'band_brought_nobody',
  },
};

// What actually puts a person in a band, in a facilitator's words — the
// restatement of the SQL predicate that the number came from.
//
// PARTIAL on purpose. A band whose label already says what it means does not
// get a line: "Strong" needs no gloss, and six explanations under six
// self-evident labels is noise that makes the page harder to read, not
// easier. `unrated` gets one because "Unrated" says the state without saying
// that this axis is the one a human types in.
//
// These sentences are a second copy of a definition that lives in SQL, which
// is a real cost and the reason each one is deliberately short: a long gloss
// invents detail the query does not have. If a predicate in
// connections_landscape or connections_landscape_axis changes, change its
// sentence in the same commit — a note that has drifted from the query is
// worse than no note at all.
export const BAND_NOTE_KEYS: Record<Axis, Partial<Record<string, UiKey>>> = {
  maturity: {
    facilitator: 'note_rung_facilitator',
    contributor: 'note_rung_contributor',
    returned: 'note_rung_returned',
    attended: 'note_rung_attended',
    touched: 'note_rung_touched',
    never: 'note_rung_never',
  },
  closeness: { unrated: 'note_band_unrated' },
  cadence: {
    in_rhythm: 'note_band_in_rhythm',
    slowing: 'note_band_slowing',
    quiet: 'note_band_quiet',
    never_spoken: 'note_band_never_spoken',
  },
  opportunity: {
    committed: 'note_band_committed',
    proposal: 'note_band_proposal',
    open: 'note_band_open',
    none: 'note_band_none',
  },
  contribution: {
    brings_regularly: 'note_band_brings_regularly',
    brought_someone: 'note_band_brought_someone',
    brought_nobody: 'note_band_brought_nobody',
  },
};

/** What would make this axis say something, when today it says nothing. */
/**
 * The band a person lands in when the axis's SOURCE has never been written
 * to: no note, no rating, no commitment, no introduction, no activity at all.
 *
 * This is what separates a source nobody has filled from a real, stable
 * answer, and the distinction is not cosmetic — it was a bug. "Everybody is
 * in one band" also describes a workspace where every person genuinely sits
 * at `committed`, and telling that workspace to "put something in the
 * pipeline in Pulse" is false as well as annoying. It also describes a
 * community where everyone truly has been spoken to and nobody was ever
 * introduced: true, stable, and nagged at forever by a sentence that can
 * never come down.
 *
 * So the fill sentence appears only when the one occupied band is THIS one.
 * For every axis here that is exactly equivalent to "the source is empty" —
 * all `never_spoken` iff no note exists, all `unrated` iff nothing was rated
 * — which is why it needs no second query. If an axis is ever added whose
 * bottom band is reachable with a non-empty source, that axis needs a real
 * source count, not an entry in this map.
 */
export const AXIS_UNWRITTEN_BAND: Record<Axis, string> = {
  maturity: 'never',
  closeness: 'unrated',
  cadence: 'never_spoken',
  opportunity: 'none',
  contribution: 'brought_nobody',
};

export const AXIS_FILL_KEYS: Record<Axis, UiKey> = {
  maturity: 'fill_maturity',
  closeness: 'fill_closeness',
  cadence: 'fill_cadence',
  opportunity: 'fill_opportunity',
  contribution: 'fill_contribution',
};
