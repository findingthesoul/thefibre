'use client';

// The two fields a team-calendar grant needs: WHICH calendar, and HOW MUCH
// off. Born in shared because it has two callers from the day it exists —
// Membership's product dialog and its legacy tier Access dialog — and the
// alternative is the same picker written twice with two different ideas about
// what a blank percentage means.
//
// The rule is NOT in here. It is in ../team-calendar-grant.ts, pure, so the
// API validates with the same function the form offers with
// (`teamCalendarGrantConfig`). Every word is injected: a shared component
// that holds English is a component one app cannot use.

import { useId } from 'react';
import { SearchSelect } from './search-select.js';
import { FIELD_INPUT_CLASS_INLINE } from './fields.js';
import { teamCalendarPctCase, teamCalendarPctRefusal } from '../team-calendar-grant.js';

export type TeamCalendarTeam = {
  id: string;
  name: string;
  /** Whether the team's calendar is published. An unpublished team's threads
   *  are not reachable publicly at all, so a grant on one promises something
   *  nobody can use YET — a hint, not a refusal, because publishing later is
   *  the normal order of work. */
  published?: boolean | undefined;
};

export type TeamCalendarLabels = {
  /** "Team calendar" */
  team: string;
  /** Placeholder in the picker, e.g. "Pick a team…" */
  teamPlaceholder: string;
  /** "Member discount" */
  pct: string;
  /** What 100 means, in words: "100% — free for members". */
  freeHint: string;
  /** What 1–99 means: takes the number, e.g. "20% off for members". */
  partialHint: (pct: number) => string;
  /** Why 0 is refused: "a 0% discount promises nothing — leave the calendar
   *  off this product instead". */
  zeroHint: string;
  /** Why anything else is refused: "a whole number between 1 and 100". */
  rangeHint: string;
  /** Shown under an unpublished team: "this team is not published, so its
   *  threads are not public yet". */
  unpublishedHint: string;
  /** Suffix in the picker for an unpublished team, e.g. "not published". */
  unpublishedTag: string;
};

export function TeamCalendarGrantFields({
  teams,
  teamId,
  onTeamId,
  pct,
  onPct,
  labels,
  disabled = false,
}: {
  teams: TeamCalendarTeam[];
  teamId: string;
  onTeamId: (v: string) => void;
  /** Held as a STRING, because it comes from a text input and an empty field
   *  has to stay empty — a number state would make it 0, which is the one
   *  value this grant refuses. */
  pct: string;
  onPct: (v: string) => void;
  labels: TeamCalendarLabels;
  disabled?: boolean | undefined;
}) {
  const pctId = useId();
  const chosen = teams.find((t) => t.id === teamId) ?? null;
  const kase = teamCalendarPctCase(pct);
  const refusal = teamCalendarPctRefusal(pct);
  const n = Number(pct);

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium">{labels.team}</label>
        <SearchSelect
          value={teamId}
          onChange={onTeamId}
          options={teams.map((t) => ({
            value: t.id,
            label: t.name,
            ...(t.published === false ? { hint: labels.unpublishedTag } : {}),
          }))}
          placeholder={labels.teamPlaceholder}
          disabled={disabled}
          className="w-full"
        />
        {chosen?.published === false && (
          <p className="mt-1 text-xs text-amber-700">{labels.unpublishedHint}</p>
        )}
      </div>
      <div>
        <label htmlFor={pctId} className="mb-1 block text-sm font-medium">
          {labels.pct}
        </label>
        <div className="flex items-center gap-2">
          <input
            id={pctId}
            type="number"
            min={1}
            max={100}
            step={1}
            inputMode="numeric"
            value={pct}
            onChange={(e) => onPct(e.target.value)}
            disabled={disabled}
            aria-describedby={`${pctId}-hint`}
            // The SHARED field box, not a hand-rolled one: a 14px input zooms
            // iOS on focus, and fields.test.ts fails the release for exactly
            // this line (it did, before this was written properly).
            className={`${FIELD_INPUT_CLASS_INLINE} w-24 disabled:opacity-50`}
          />
          {/* The sentence, beside the number rather than under it: the whole
              point is that somebody typing 100 reads "free for members" in
              the same glance. */}
          <p
            id={`${pctId}-hint`}
            className={`text-sm ${kase === 'invalid' ? 'text-red-700' : 'text-ink-muted'}`}
          >
            {kase === 'free'
              ? labels.freeHint
              : kase === 'partial'
                ? labels.partialHint(n)
                : refusal === 'zero'
                  ? labels.zeroHint
                  : labels.rangeHint}
          </p>
        </div>
      </div>
    </div>
  );
}
