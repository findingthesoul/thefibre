import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';

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
const BAND_KEYS: Record<Axis, Record<string, UiKey>> = {
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

// Two axes read a column the database keeps only the current value of, so
// there is no earlier state to compare against and "nothing moved" would be a
// claim we cannot make. Said out loud instead — see the header of
// supabase/migrations/20260912160000_connections_axes.sql.
const NO_HISTORY: Partial<Record<Axis, true>> = { closeness: true, opportunity: true };

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
  locale,
}: {
  bands: Band[];
  total: number;
  arrived: number;
  moved: Moved[];
  movedTotal: number;
  sinceDays: number;
  axis: Axis;
  locale: Locale;
}) {
  const keys = BAND_KEYS[axis];
  const ramp = RAMP[bands.length] ?? RAMP[6]!;
  const label = (band: string) => {
    const k = keys[band];
    return k ? t(locale, k) : band;
  };

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
          return (
            <li key={b.rung} className="rounded-md border border-line bg-surface-raised px-3 py-2.5">
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
            </li>
          );
        })}
      </ul>

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
