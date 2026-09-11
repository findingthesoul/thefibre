import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n-ui';

export type Rung =
  | 'facilitator'
  | 'contributor'
  | 'returned'
  | 'attended'
  | 'touched'
  | 'never';

export type Band = {
  rung: Rung;
  count: number;
  was: number;
  /** Net people who MOVED into this rung, excluding anyone who simply
   *  arrived in the window. count-minus-was would conflate the two and read
   *  as insight while being an artefact of a young workspace. */
  net_moved: number;
};
export type Moved = {
  person_id: string;
  from: Rung;
  to: Rung;
  up: boolean;
  person: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
};

// Explicit map, not a computed key: the catalog is typed so a missing
// translation is a compile error, and a template key throws that away.
const RUNG_KEYS = {
  facilitator: 'rung_facilitator',
  contributor: 'rung_contributor',
  returned: 'rung_returned',
  attended: 'rung_attended',
  touched: 'rung_touched',
  never: 'rung_never',
} as const;

// Depth of involvement read as depth of ink. Not a status colour — nothing
// here is good or bad, and green/amber/red would say otherwise about people.
const FILL: Record<Rung, string> = {
  facilitator: 'bg-ink',
  contributor: 'bg-ink/75',
  returned: 'bg-ink/55',
  attended: 'bg-ink/35',
  touched: 'bg-ink/20',
  never: 'bg-ink/10',
};

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
  locale,
}: {
  bands: Band[];
  total: number;
  arrived: number;
  moved: Moved[];
  movedTotal: number;
  sinceDays: number;
  locale: Locale;
}) {
  return (
    <div className="mt-8">
      <div className="text-sm text-ink-muted">
        {total} {t(locale, 'landscape_people')}
      </div>

      {/* Bands stacked as layers. Each row is a full-width thumb target with
          its proportion drawn and its count written — never a number that
          only exists in a tooltip. */}
      <ul className="mt-3 space-y-1.5">
        {bands.map((b) => {
          const pct = total > 0 ? (b.count / total) * 100 : 0;
          const delta = b.net_moved;
          return (
            <li key={b.rung} className="rounded-md border border-line bg-surface-raised px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{t(locale, RUNG_KEYS[b.rung])}</span>
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
                  className={`h-full rounded-full ${FILL[b.rung]}`}
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

        {movedTotal === 0 && arrived === 0 && (
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
                  {t(locale, RUNG_KEYS[m.from])} → {t(locale, RUNG_KEYS[m.to])}
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
