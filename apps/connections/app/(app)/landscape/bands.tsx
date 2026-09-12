import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n-ui';
import {
  AXIS_FILL_KEYS,
  AXIS_UNWRITTEN_BAND,
  BAND_NOTE_KEYS,
  bandName,
  type Axis,
  type Band,
  type BandLabels,
  type Moved,
} from './axes';

// Re-exported so the page and the picker keep importing from one place. The
// DEFINITIONS moved to ./axes (see its header for why); this file is the
// rendering and nothing else.
export { AXES, AXIS_KEYS, AXIS_QUESTION_KEYS, isAxis } from './axes';
export type { Axis, Band, BandLabels, Moved } from './axes';


// Depth of involvement read as depth of ink. Not a status colour — nothing
// here is good or bad, and green/amber/red would say otherwise about people.
//
// Keyed by how many bands the axis has rather than by band name, because the
// ramp IS the grammar: darkest at the top, whichever axis is showing. The
// six-step ramp is byte-for-byte the one the maturity ladder shipped with.
const RAMP: Record<number, string[]> = {
  6: ['bg-ink', 'bg-ink/75', 'bg-ink/55', 'bg-ink/35', 'bg-ink/20', 'bg-ink/10'],
  5: ['bg-ink', 'bg-ink/70', 'bg-ink/50', 'bg-ink/30', 'bg-ink/12'],
  4: ['bg-ink', 'bg-ink/65', 'bg-ink/40', 'bg-ink/18'],
  3: ['bg-ink', 'bg-ink/55', 'bg-ink/22'],
};

// `closeness` reads a column the database keeps only the current value of, so
// there is no earlier state to compare against and "nothing moved" would be a
// claim we cannot make. Said out loud instead.
//
// `opportunity` WAS in this list and is not any more: 20260913010000 started
// logging stage moves and 20260913030000 taught the axis to read that log, so
// its movement is now real. An axis that shrugs when it has the answer is a
// worse lie than the shrug was. Building the same log for
// relationship_strength is the same decision made again, not a thing to
// paper over here.
const NO_HISTORY: Partial<Record<Axis, true>> = { closeness: true };

function name(m: Moved) {
  const p = m.person;
  if (!p) return m.person_id.slice(0, 8);
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || m.person_id.slice(0, 8);
}

export function Bands({
  bands,
  total,
  arrived,
  moved,
  movedTotal,
  sinceDays,
  axis,
  labels,
  locale,
}: {
  bands: Band[];
  total: number;
  arrived: number;
  moved: Moved[];
  movedTotal: number;
  sinceDays: number;
  axis: Axis;
  /** What this workspace calls its bands. Sparse; absent falls back. */
  labels?: BandLabels;
  locale: Locale;
}) {
  const notes = BAND_NOTE_KEYS[axis];
  const ramp = RAMP[bands.length] ?? RAMP[6]!;
  const label = (band: string) => bandName(locale, labels, axis, band);

  // The case that reads as a broken page: one bar, full width, holding
  // everybody, because the axis's source has never been written to. In a
  // young workspace three of the five look like this.
  //
  // TWO conditions, not one. "Everybody in one band" alone is not enough:
  // it also describes a workspace where every person genuinely sits at
  // `committed`, or a community where everyone truly has been spoken to and
  // nobody was ever introduced. Those are real answers, and a sentence
  // telling them to go fill the source would be false in the first case and
  // permanent in the second — onboarding furniture on every quiet Tuesday.
  // So the band must ALSO be the axis's unwritten one (see AXIS_UNWRITTEN_BAND).
  //
  // Read from the data rather than from a flag, so it retires itself the
  // moment the first note, rating, commitment or introduction lands.
  const occupied = bands.filter((b) => b.count > 0);
  const onlyBand = total > 0 && occupied.length === 1 ? occupied[0]! : null;
  const sourceUnwritten = onlyBand?.rung === AXIS_UNWRITTEN_BAND[axis];

  return (
    <div className="mt-8">
      <div className="text-sm text-ink-muted">
        {total} {t(locale, 'landscape_people')}
      </div>

      {/* Bands stacked as layers. Each row is a full-width thumb target with
          its proportion drawn and its count written — never a number that
          only exists in a tooltip. Identical across all five axes: the
          picker changes what a band MEANS, never how it is read. */}
      <ul className="mt-3 space-y-1.5">
        {bands.map((b, i) => {
          const pct = total > 0 ? (b.count / total) * 100 : 0;
          const delta = b.net_moved;
          const note = notes[b.rung];
          // A band with people in it is a question — WHO are those nine? —
          // and until now it was a number you could not follow. The whole
          // row is the target rather than the label: it is the thumb-sized
          // thing already on screen, and making somebody hit a word instead
          // would break this project's own mobile rules.
          //
          // The <li> stays an <li> and the link goes INSIDE it. Swapping the
          // element for an <a> would put an anchor directly in a <ul>, which
          // is invalid and which React will not warn about. An empty band
          // renders a plain div: there is nothing behind a zero, and a link
          // to an empty list is a promise the page cannot keep.
          const Inner = b.count > 0 ? Link : 'div';
          const innerProps =
            b.count > 0
              ? { href: `/people?axis=${axis}&band=${b.rung}` as const }
              : {};
          return (
            <li key={b.rung}>
              <Inner
                {...(innerProps as { href: string })}
                className={`block rounded-md border border-line bg-surface-raised px-3 py-2.5 ${
                  b.count > 0 ? 'transition-colors hover:border-ink/30' : ''
                }`}
              >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{label(b.rung)}</span>
                <span className="text-sm tabular-nums">
                  {b.count}
                  {delta !== 0 && (
                    <span className="ml-1.5 text-xs text-ink-muted tabular-nums">
                      {delta > 0 ? '+' : ''}
                      {delta}
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className={`h-full rounded-full ${ramp[i] ?? ramp[ramp.length - 1]}`}
                  style={{ width: `${Math.max(pct, b.count > 0 ? 1.5 : 0)}%` }}
                />
              </div>

              {/* Only where somebody actually stands. An empty band needs no
                  explanation of who is in it, and glossing all six would
                  bury the four that have people in them. */}
              {b.count > 0 && note && (
                <p className="mt-2 text-xs text-ink-subtle">{t(locale, note)}</p>
              )}
              </Inner>
            </li>
          );
        })}
      </ul>

      {onlyBand && sourceUnwritten && (
        <p className="mt-3 text-sm text-ink-muted">
          {t(locale, 'landscape_all_one_band', { n: total })}{' '}
          {t(locale, AXIS_FILL_KEYS[axis])}
        </p>
      )}

      {/* Proportions alone are a poster. Movement is the reason to open it
          twice — docs/connections-mobile.md §2. */}
      <div className="mt-8">
        <h2 className="text-sm font-medium">
          {t(locale, 'landscape_movement')} · {sinceDays}{t(locale, 'landscape_days_short')}
        </h2>

        {NO_HISTORY[axis] && (
          <p className="mt-2 text-sm text-ink-subtle">{t(locale, 'landscape_no_history')}</p>
        )}

        {!NO_HISTORY[axis] && movedTotal === 0 && arrived === 0 && (
          <p className="mt-2 text-sm text-ink-muted">{t(locale, 'landscape_no_movement')}</p>
        )}

        {arrived > 0 && (
          <p className="mt-2 text-sm text-ink-muted">
            {arrived} {t(locale, 'landscape_arrived')}
          </p>
        )}

        {moved.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {moved.map((m) => (
              <li
                key={m.person_id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-line px-3 py-2 text-sm"
              >
                {m.up ? (
                  <ArrowUpRight size={14} className="text-ink" />
                ) : (
                  <ArrowDownRight size={14} className="text-ink-muted" />
                )}
                <span className="font-medium">{name(m)}</span>
                <span className="text-xs text-ink-muted">
                  {label(m.from)} → {label(m.to)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {movedTotal > moved.length && (
          <p className="mt-2 text-xs text-ink-muted">
            {t(locale, 'landscape_and_more')} {movedTotal - moved.length}
          </p>
        )}
      </div>
    </div>
  );
}
