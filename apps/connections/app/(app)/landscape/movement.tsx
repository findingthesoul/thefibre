'use client';

// The landscape as a board of steps side by side, showing who moved.
//
// Sjoerd, 2026-09-14: *"I want to see the movement — like columns next to each
// other... and maybe there could be sub categories (extra column) like tag,
// location, company, etc."*
//
// Where the Finder columns (columns.tsx) are for FINDING somebody, this is for
// SEEING change: every step of a reading at once, lowest on the left, each
// person on the step they are on now, with an arrow and the step they came
// from when they moved during the period. An update meeting can walk it left
// to right.
//
// The arithmetic is in movement-model.ts and tested there — including the
// direction, which if reversed would draw every promotion as a demotion.
//
// ── Grouping ───────────────────────────────────────────────────────────────
//
// Group by tag, location or company, then pick a value, and the board shows
// only the people in it. Grouping happens in the browser over one facets read,
// and it is a VIEW: two people under one tag are shown together, nothing is
// computed from it (handbook §12).
//
// ── Width ──────────────────────────────────────────────────────────────────
//
// Six steps do not fit a phone, and this page must never scroll sideways, so
// the board scrolls inside its own container instead — the one place in this
// app wide content is allowed to.

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Sparkles } from 'lucide-react';
import { FIELD_CLASS_INLINE } from '@thefibre/shared/ui/fields';
import { t, type Locale } from '@/lib/i18n-ui';
import { safely } from '@/lib/safely';
import { usePersonPopup } from '@/components/person-popup';
import { fetchVocabulary } from '@/app/(app)/people/[id]/actions';
import { axisTitle, bandName, type Axis, type AxisConfig, type BandLabels } from './axes';
import { loadFacets, loadReading, type ReadingResult } from './actions';
import { board, groupOptions, valuesFor, type Facet, type GroupBy } from './movement-model';

const PERIODS = [7, 14, 30, 90] as const;
const GROUPS: GroupBy[] = ['none', 'tag', 'location', 'company'];
const GROUP_KEYS = {
  none: 'move_group_none',
  tag: 'move_group_tag',
  location: 'move_group_location',
  company: 'move_group_company',
} as const;

export function MovementBoard({
  locale,
  axes,
  config,
  labels,
  initialAxis,
  initialReading,
}: {
  locale: Locale;
  axes: readonly Axis[];
  config?: AxisConfig;
  labels?: BandLabels;
  initialAxis: Axis;
  /** The first reading over thirty days, fetched on the server. */
  initialReading: ReadingResult;
}) {
  const { openPerson } = usePersonPopup();
  const [axis, setAxis] = useState<Axis>(initialAxis);
  const [days, setDays] = useState<number>(30);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [value, setValue] = useState<string | null>(null);
  const [onlyMoved, setOnlyMoved] = useState(false);
  const [readings, setReadings] = useState<Record<string, ReadingResult>>({
    [`${initialAxis}:30`]: initialReading,
  });
  const [facets, setFacets] = useState<Map<string, Facet> | null>(null);
  const [facetError, setFacetError] = useState<string | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());

  const key = `${axis}:${days}`;
  const reading = readings[key];

  // A reading over a period is fetched once and kept.
  useEffect(() => {
    if (readings[key]) return;
    let alive = true;
    void safely(
      () => loadReading(axis, days),
      (error) => ({ ok: false as const, error }),
    ).then((r) => {
      if (alive) setReadings((prev) => ({ ...prev, [key]: r }));
    });
    return () => {
      alive = false;
    };
  }, [axis, days, key, readings]);

  // Facets only when somebody groups — most looks at the board never do.
  useEffect(() => {
    if (groupBy === 'none' || facets) return;
    let alive = true;
    void safely(loadFacets, (error) => ({ ok: false as const, error })).then((r) => {
      if (!alive) return;
      if (r.ok) setFacets(new Map(r.people.map((f) => [f.person_id, f])));
      else setFacetError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [groupBy, facets]);

  useEffect(() => {
    let alive = true;
    void fetchVocabulary().then((v) => {
      if (alive) setNames(new Map(v.people.map((p) => [p.id, p.name])));
    });
    return () => {
      alive = false;
    };
  }, []);

  const options = useMemo(
    () => (reading?.ok && facets ? groupOptions(reading.people, facets, groupBy) : []),
    [reading, facets, groupBy],
  );

  const columns = useMemo(() => {
    if (!reading?.ok) return [];
    const keep =
      groupBy !== 'none' && value && facets
        ? (id: string) => valuesFor(facets.get(id), groupBy).includes(value)
        : undefined;
    return board(
      reading.bands.map((b) => b.rung),
      reading.people,
      { ...(keep ? { keep } : {}), onlyMoved },
    );
  }, [reading, groupBy, value, facets, onlyMoved]);

  const label = (rung: string) => bandName(locale, labels, axis, rung);
  const select = FIELD_CLASS_INLINE;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2">
          <span className="text-xs text-ink-muted">{t(locale, 'landscape_col_readings')}</span>
          <select value={axis} onChange={(e) => setAxis(e.target.value as Axis)} className={select}>
            {axes.map((a) => (
              <option key={a} value={a}>
                {axisTitle(locale, config, a)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-xs text-ink-muted">{t(locale, 'move_period')}</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={select}>
            {PERIODS.map((d) => (
              <option key={d} value={d}>
                {t(locale, 'move_days', { n: d })}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-xs text-ink-muted">{t(locale, 'move_group_by')}</span>
          <select
            value={groupBy}
            onChange={(e) => {
              setGroupBy(e.target.value as GroupBy);
              setValue(null);
            }}
            className={select}
          >
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {t(locale, GROUP_KEYS[g])}
              </option>
            ))}
          </select>
        </label>

        {groupBy !== 'none' && (
          <label className="flex items-center gap-2">
            <select
              value={value ?? ''}
              onChange={(e) => setValue(e.target.value || null)}
              className={select}
              aria-label={t(locale, GROUP_KEYS[groupBy])}
            >
              <option value="">{t(locale, 'move_group_all')}</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {groupBy === 'tag' ? `#${o.value}` : o.value} · {o.count}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <input type="checkbox" checked={onlyMoved} onChange={(e) => setOnlyMoved(e.target.checked)} />
          {t(locale, 'move_only_moved')}
        </label>
      </div>

      {facetError && <p className="mt-2 text-xs text-ink">{facetError}</p>}
      {!reading && <p className="mt-6 text-xs text-ink-muted">{t(locale, 'loading')}</p>}
      {reading && !reading.ok && <p className="mt-6 text-xs text-ink">{reading.error}</p>}

      {reading?.ok && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface-raised">
          <div className="flex min-h-[26rem] divide-x divide-line">
            {columns.map((col) => (
              <section key={col.rung} className="flex min-w-[11rem] flex-1 flex-col">
                <header className="border-b border-line px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="truncate text-xs font-medium uppercase tracking-wide text-ink-subtle">
                      {label(col.rung)}
                    </h3>
                    <span className="text-sm tabular-nums text-ink">{col.cards.length}</span>
                  </div>
                  {(col.arrivedIn > 0 || col.leftFrom > 0) && (
                    <p className="mt-0.5 text-[11px] tabular-nums text-ink-muted">
                      {t(locale, 'move_turnover', { in: col.arrivedIn, out: col.leftFrom })}
                    </p>
                  )}
                </header>
                <ul className="flex-1 space-y-1 overflow-y-auto p-2">
                  {col.cards.map((c) => (
                    <li key={c.person_id}>
                      <button
                        type="button"
                        onClick={() => openPerson(c.person_id)}
                        className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-left hover:bg-surface-sunken"
                      >
                        <span className="block truncate text-sm">{names.get(c.person_id) ?? '…'}</span>
                        {c.movement !== 'still' && (
                          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted">
                            {c.movement === 'up' && <ArrowUp size={11} />}
                            {c.movement === 'down' && <ArrowDown size={11} />}
                            {c.movement === 'new' && <Sparkles size={11} />}
                            {c.movement === 'new'
                              ? t(locale, 'move_new')
                              : t(locale, 'move_from', { step: label(c.from!) })}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
