'use client';

// "Both records answered, and differently. Which one is right?"
//
// Sjoerd asked for this with the duplicates screen: until now the record you
// keep always won, and the other one's phone number was simply dropped. This
// is the step that asks.
//
// It renders ONLY genuine conflicts — columns where both records have a value
// and the values differ. A blank on one side is not a question: the merge has
// filled those since 2026-09-25 and the screen says so elsewhere, on the
// gains line. Asking about them would turn a free gain into a decision
// somebody has to make.
//
// THE KEEPER IS PRE-SELECTED, and that is the whole safety of the feature:
// pressing straight through produces exactly the merge that would have
// happened before this existed. Somebody who does not engage with the step
// cannot be surprised by it.
//
// Born in shared because organisations get the same step (slice 4) and a
// second copy is where the two drift. Presentational only — it holds no
// state, fetches nothing, and names no app.

import type { ReactNode } from 'react';

/** One disagreement, as `*_merge_conflicts` returns it. Values are jsonb, so
 *  a text column arrives as a string and a text[] as an array. */
export type MergeConflict = {
  name: string;
  keep_value: unknown;
  merge_value: unknown;
};

/** Which side wins, per column. Exactly what the API accepts — a SIDE, never
 *  a value, so this object can never carry one. */
export type MergeChoices = Record<string, 'keep' | 'merge'>;

/**
 * A value as a person should read it.
 *
 * Arrays join; everything else is shown as text. Not clever about it: these
 * are the fields a merge may carry, which are names, addresses and phone
 * numbers, and a person comparing two of them needs to see both exactly as
 * they are rather than a formatted version that might hide the difference
 * they are deciding about.
 */
function show(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => String(v)).join(', ');
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function MergeConflictChoices({
  conflicts,
  choices,
  onChange,
  labelFor,
  keepHeading,
  mergeHeading,
  intro,
  disabled = false,
}: {
  conflicts: MergeConflict[];
  choices: MergeChoices;
  onChange: (next: MergeChoices) => void;
  /** Column name → the word a person reads. The caller owns the vocabulary. */
  labelFor: (column: string) => string;
  /** Who the two columns are — "Keep this record" / "the other one", in the
   *  caller's words and already translated. */
  keepHeading: ReactNode;
  mergeHeading: ReactNode;
  intro?: ReactNode;
  disabled?: boolean;
}) {
  if (conflicts.length === 0) return null;

  function pick(column: string, side: 'keep' | 'merge') {
    onChange({ ...choices, [column]: side });
  }

  return (
    <div className="mt-3 rounded-md border border-line bg-surface-sunken p-3">
      {intro && <p className="text-xs text-ink-muted">{intro}</p>}
      <div className="mt-2 space-y-2">
        <div className="hidden sm:grid grid-cols-[8rem_1fr_1fr] gap-2 text-[11px] uppercase tracking-wide text-ink-subtle">
          <span />
          <span>{keepHeading}</span>
          <span>{mergeHeading}</span>
        </div>
        {conflicts.map((c) => {
          // Unset reads as 'keep', so the default is today's outcome even
          // before anybody touches anything.
          const side = choices[c.name] ?? 'keep';
          return (
            <div key={c.name} className="grid grid-cols-1 sm:grid-cols-[8rem_1fr_1fr] gap-2 items-stretch">
              <span className="text-xs text-ink-subtle self-center">{labelFor(c.name)}</span>
              {(['keep', 'merge'] as const).map((which) => {
                const chosen = side === which;
                const value = which === 'keep' ? c.keep_value : c.merge_value;
                return (
                  <button
                    key={which}
                    type="button"
                    onClick={() => pick(c.name, which)}
                    disabled={disabled}
                    aria-pressed={chosen}
                    className={`rounded-md border px-2.5 py-1.5 text-left text-sm break-words disabled:opacity-50 ${
                      chosen
                        ? 'border-line-strong bg-surface-raised font-medium'
                        : 'border-line text-ink-subtle hover:border-line-strong'
                    }`}
                  >
                    {/* The column each value came from is in the header on a
                        wide screen and gone on a phone, so the button says it
                        for a reader who cannot see the column. */}
                    <span className="sm:hidden text-[11px] uppercase tracking-wide text-ink-subtle block">
                      {which === 'keep' ? keepHeading : mergeHeading}
                    </span>
                    {show(value)}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
