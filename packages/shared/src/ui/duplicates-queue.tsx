'use client';

// The duplicates queue: find a pair, decide, merge, undo.
//
// Two screens ran this — /contacts/duplicates and /organisations/duplicates —
// and 66% of the second file was line-for-line the first. That was measured,
// not estimated, and it is why this exists: the same fix had already had to
// be made twice (v1.151.1 and v1.151.2, the stale question under the open
// step), which is exactly how two copies start drifting.
//
// ── What lives here and what does not ──────────────────────────────────────
//
// HERE: the machinery. Which pair is being answered, whether the per-field
// step is open, which pairs this session has dealt with, the ask-first-then-
// merge flow, the undo list, the error and notice banners, and the card SHELL.
//
// NOT HERE: anything that knows what a person or an organisation is. The
// vocabulary arrives as `strings`, the column names as `labelFor`, the match
// reasons as `reasonLabel`, and the middle of each card as `renderDetails`.
// This file names no app, fetches nothing and imports no server action — the
// callers inject those, the way ui/invoices.tsx does.
//
// ── The gains line, and why its absence is a THIRD state ───────────────────
//
// A person pair carries `gains` — the columns that record would gain if kept.
// An organisation pair does not: organisation_duplicate_candidates returns no
// such columns, so the organisation screen passes NOTHING.
//
// `undefined` and `[]` must therefore mean different things, and `mergeGains`
// is what keeps them apart: absent renders as SILENCE, an empty answer keeps
// its sentence ("gains nothing"), because an empty answer is a real finding —
// it means the other record is the fuller one. Collapsing the two is not
// hypothetical: on staging, before the API carrying the preview was deployed,
// both records claimed to gain nothing while one plainly had a phone and a
// city the other lacked (v1.149.x). Never default this to [].

import { useState, useTransition, type ReactNode } from 'react';
import { Undo2, ArrowRight } from 'lucide-react';
import { mergeGains } from '../merge-gains.js';
import {
  MergeConflictChoices,
  type MergeChoices,
  type MergeConflict,
} from './merge-conflicts.js';

/** The least a record must carry to be shown and merged. */
export type DuplicateRecord = { id: string };

export type DuplicatePair<T extends DuplicateRecord> = {
  /** Why the two were proposed, already in words. */
  reason: string;
  a: T;
  b: T;
  /** Columns `a` would gain if kept. ABSENT means nobody answered — see the
   *  note at the top of this file. Never pass [] to mean "unknown". */
  aGains?: string[] | undefined;
  bGains?: string[] | undefined;
};

/** A past merge, in the queue's own vocabulary rather than either table's —
 *  `person_merge` and `organisation_merge` name their columns differently and
 *  the caller maps once rather than this file branching on which it got. */
export type QueueMergeRow = {
  id: string;
  keptId: string;
  mergedId: string;
  mergedAt: string;
  undoneAt: string | null;
  droppedRows: number;
};

export type QueueResult = { ok?: boolean; error?: string | undefined };

/** next/link, structurally. This package keeps no Next.js dependency — the
 *  app passes its own, exactly as createListRow in ui/list.tsx does. Loose on
 *  purpose: tying it to Next's prop types would reintroduce the dependency
 *  this shape exists to avoid. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LinkLike = (props: { href: string; className?: string; children?: any }) => any;

export type DuplicatesStrings = {
  none: string;
  question: string;
  sameAnswer: string;
  differentAnswer: string;
  pickKeep: string;
  keepThis: string;
  back: string;
  conflictIntro: string;
  conflictKeeping: (name: string) => string;
  conflictOther: (name: string) => string;
  conflictMerge: string;
  /** Said when the comparison could not be fetched and the merge went ahead
   *  the plain way anyway. Not an error — but a SILENT merge there is
   *  indistinguishable from "we compared them and there was nothing to
   *  decide", which is a different and false claim (v1.149.1). */
  conflictUnavailable: (name: string) => string;
  recentMerges: string;
  undo: string;
  droppedRows: string;
  gains: (fields: string) => string;
  gainsNone: string;
};

export type DuplicatesActions = {
  fetchConflicts: (
    keepId: string,
    mergeId: string,
  ) => Promise<{ conflicts?: MergeConflict[]; error?: string | undefined }>;
  merge: (keepId: string, mergeId: string, choices?: MergeChoices) => Promise<QueueResult>;
  undo: (mergeId: string) => Promise<QueueResult>;
  markDistinct: (aId: string, bId: string) => Promise<QueueResult>;
  /** Called after any successful write, so the caller can refresh its route. */
  afterChange: () => void;
};

/**
 * One record's card.
 *
 * The shell is here because both screens draw the same box, the same name
 * link, the same date line, the same gains sentence and the same button —
 * and because putting the gains line here is what makes its three states
 * impossible to get wrong in a second copy.
 */
function RecordCard({
  Link,
  href,
  title,
  details,
  meta,
  gains,
  onKeep,
  busy,
  strings,
  labelFor,
}: {
  Link: LinkLike;
  href: string;
  title: string;
  /** The middle of the card: whatever this kind of record is compared on. */
  details: ReactNode;
  meta: ReactNode;
  gains?: string[] | undefined;
  onKeep: (() => void) | null;
  busy: boolean;
  strings: DuplicatesStrings;
  labelFor: (column: string) => string;
}) {
  const gainsState = mergeGains(gains);
  return (
    <div className="flex-1 rounded-md border border-line bg-surface-raised p-3">
      <Link href={href} className="text-sm font-medium hover:underline break-words">
        {title}
      </Link>
      <div className="mt-2 space-y-1 text-xs text-ink-subtle">{details}</div>
      <div className="mt-2 text-xs text-ink-muted">{meta}</div>
      {/* Three states, not two. `unknown` renders NOTHING — see the note at
          the top of this file. Shown only once the pair has been called the
          same record, i.e. beside the button it describes. */}
      {onKeep && gainsState.kind !== 'unknown' && (
        <div className="mt-3 text-xs text-ink-subtle">
          {gainsState.kind === 'list'
            ? strings.gains(fieldList(gainsState.fields, labelFor))
            : strings.gainsNone}
        </div>
      )}
      {onKeep && (
        <button
          type="button"
          onClick={onKeep}
          disabled={busy}
          className="mt-2 w-full rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:border-line-strong disabled:opacity-50"
        >
          {strings.keepThis}
        </button>
      )}
    </div>
  );
}

/** Column names as words, de-duplicated: two columns can share one label
 *  (address_line1 and address_line2 are both "address") and naming it twice
 *  reads as a mistake. */
function fieldList(cols: string[], labelFor: (c: string) => string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of cols) {
    const label = labelFor(c);
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out.join(', ');
}

export function DuplicatesQueue<T extends DuplicateRecord>({
  pairs,
  merges,
  strings,
  actions,
  labelFor,
  reasonLabel,
  nameOf,
  hrefFor,
  renderDetails,
  renderMeta,
  intlLocale,
  Link,
}: {
  pairs: DuplicatePair<T>[];
  merges: QueueMergeRow[];
  strings: DuplicatesStrings;
  actions: DuplicatesActions;
  /** Column name → the word a person reads. The caller owns the vocabulary. */
  labelFor: (column: string) => string;
  /** Why a pair was proposed, already translated. */
  reasonLabel: (reason: string) => string;
  /** How this record is called — used in the card and in the step headings. */
  nameOf: (record: T) => string;
  hrefFor: (id: string) => string;
  renderDetails: (record: T) => ReactNode;
  renderMeta: (record: T) => ReactNode;
  intlLocale: string;
  /** The app's next/link — see LinkLike. */
  Link: LinkLike;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Pairs dealt with in this session. The API recomputes from the database on
  // reload; this only stops a merged pair flashing back before that lands.
  const [done, setDone] = useState<Set<string>>(new Set());
  // The pair whose answer was "same record" — now choosing which to keep.
  const [choosing, setChoosing] = useState<string | null>(null);
  /**
   * The per-field step, open for one pair at a time. It appears ONLY when the
   * two records actually disagree: if they agree, the merge happens on the
   * click that chose the keeper, so the common case stays one press.
   */
  const [conflictStep, setConflictStep] = useState<{
    pairKey: string;
    keep: T;
    drop: T;
    conflicts: MergeConflict[];
    choices: MergeChoices;
  } | null>(null);

  const key = (p: DuplicatePair<T>) => `${p.a.id}|${p.b.id}|${p.reason}`;

  function doDistinct(pair: DuplicatePair<T>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await actions.markDistinct(pair.a.id, pair.b.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      setDone((s) => new Set(s).add(key(pair)));
      actions.afterChange();
    });
  }

  async function runMerge(pair: DuplicatePair<T>, keep: T, drop: T, choices?: MergeChoices) {
    const res = await actions.merge(keep.id, drop.id, choices);
    if (res.error) {
      setError(res.error);
      return;
    }
    setConflictStep(null);
    setChoosing(null);
    setDone((s) => new Set(s).add(key(pair)));
    actions.afterChange();
  }

  /**
   * Chose which record to keep. Ask what the two disagree about BEFORE
   * merging: if they agree about everything there is nothing to ask, and the
   * merge happens on this click.
   */
  function chooseKeeper(pair: DuplicatePair<T>, keep: T, drop: T) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await actions.fetchConflicts(keep.id, drop.id);
      if (res.error) {
        // Merge anyway — refusing because a comparison failed would be the
        // worse answer, and the merge is undoable. But SAY SO.
        setNotice(strings.conflictUnavailable(nameOf(keep)));
        await runMerge(pair, keep, drop);
        return;
      }
      const conflicts = res.conflicts ?? [];
      if (!conflicts.length) {
        await runMerge(pair, keep, drop);
        return;
      }
      setConflictStep({ pairKey: key(pair), keep, drop, conflicts, choices: {} });
    });
  }

  function doMerge(pair: DuplicatePair<T>, keep: T, drop: T, choices?: MergeChoices) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      await runMerge(pair, keep, drop, choices);
    });
  }

  function doUndo(id: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await actions.undo(id);
      if (res.error) {
        setError(res.error);
        return;
      }
      setDone(new Set());
      actions.afterChange();
    });
  }

  const visible = pairs.filter((p) => !done.has(key(p)));
  const undoable = merges.filter((m) => !m.undoneAt);
  const date = (iso: string) =>
    new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' }).format(new Date(iso));

  return (
    <div className="mt-6 space-y-8">
      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Deliberately NOT the danger styling: nothing went wrong for the
          person, and dressing an explanation as a failure invites them to undo
          a merge that is perfectly good. */}
      {notice && (
        <div className="rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm text-ink-subtle">
          {notice}
        </div>
      )}

      {visible.length === 0 && <p className="text-sm text-ink-muted">{strings.none}</p>}

      {visible.map((pair) => {
        const k = key(pair);
        const stepOpen = conflictStep?.pairKey === k;
        const card = (record: T, other: T, gains: string[] | undefined) => (
          <RecordCard
            Link={Link}
            href={hrefFor(record.id)}
            title={nameOf(record)}
            details={renderDetails(record)}
            meta={renderMeta(record)}
            gains={gains}
            busy={pending}
            strings={strings}
            labelFor={labelFor}
            onKeep={choosing === k ? () => chooseKeeper(pair, record, other) : null}
          />
        );
        return (
          <div key={k} className="rounded-lg border border-line p-3">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted">
                {reasonLabel(pair.reason)}
              </span>
            </div>

            {/* Stacks on a phone, side by side from sm up. */}
            <div className="flex flex-col gap-3 sm:flex-row">
              {card(pair.a, pair.b, pair.aGains)}
              {card(pair.b, pair.a, pair.bGains)}
            </div>

            {/* Both answered, differently — so ask, rather than silently
                keeping one. The keeper is pre-selected, so pressing Merge
                without touching anything does what a plain merge would. */}
            {stepOpen && conflictStep && (
              <>
                <MergeConflictChoices
                  conflicts={conflictStep.conflicts}
                  choices={conflictStep.choices}
                  onChange={(choices) => setConflictStep((st) => (st ? { ...st, choices } : st))}
                  labelFor={labelFor}
                  keepHeading={strings.conflictKeeping(nameOf(conflictStep.keep))}
                  mergeHeading={strings.conflictOther(nameOf(conflictStep.drop))}
                  intro={strings.conflictIntro}
                  disabled={pending}
                />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      doMerge(pair, conflictStep.keep, conflictStep.drop, conflictStep.choices)
                    }
                    disabled={pending}
                    className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium hover:bg-surface-sunken disabled:opacity-50"
                  >
                    {strings.conflictMerge}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConflictStep(null)}
                    disabled={pending}
                    className="text-xs text-ink-subtle underline"
                  >
                    {strings.back}
                  </button>
                </div>
              </>
            )}

            {/* Once the step is open the keeper HAS been chosen, so neither the
                explainer nor the original question belongs on screen: leaving
                them put two Back links a few millimetres apart, one closing
                the step and one leaving the choice, and on a phone the stale
                paragraph sat directly under "Merge with these answers".
                Fixed twice in two copies (v1.151.1, v1.151.2) before this
                component existed — which is the argument for it existing. */}
            {stepOpen ? null : choosing === k ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="text-xs text-ink-muted flex-1">{strings.pickKeep}</p>
                <button
                  type="button"
                  onClick={() => setChoosing(null)}
                  disabled={pending}
                  className="text-xs text-ink-subtle underline"
                >
                  {strings.back}
                </button>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm font-medium">{strings.question}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setChoosing(k)}
                    disabled={pending}
                    className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium hover:bg-surface-sunken disabled:opacity-50"
                  >
                    {strings.sameAnswer}
                  </button>
                  <button
                    type="button"
                    onClick={() => doDistinct(pair)}
                    disabled={pending}
                    className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:border-line-strong disabled:opacity-50"
                  >
                    {strings.differentAnswer}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {undoable.length > 0 && (
        <div>
          <h2 className="text-sm font-medium">{strings.recentMerges}</h2>
          <ul className="mt-2 space-y-2">
            {undoable.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-line px-3 py-2 text-xs"
              >
                <Link href={hrefFor(m.mergedId)} className="hover:underline">
                  {m.mergedId.slice(0, 8)}
                </Link>
                <ArrowRight size={12} className="text-ink-muted" />
                <Link href={hrefFor(m.keptId)} className="hover:underline">
                  {m.keptId.slice(0, 8)}
                </Link>
                <span className="text-ink-muted">{date(m.mergedAt)}</span>
                {/* Rows a unique constraint would not let the merge carry —
                    surfaced so nobody has to guess what it cost. */}
                {m.droppedRows > 0 && (
                  <span className="text-ink-muted">
                    · {strings.droppedRows} {m.droppedRows}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => doUndo(m.id)}
                  disabled={pending}
                  className="ml-auto inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 font-medium hover:border-line-strong disabled:opacity-50"
                >
                  <Undo2 size={12} />
                  {strings.undo}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Exported for the card's own test — the shell with no queue around it. */
export { RecordCard as DuplicateRecordCard };
