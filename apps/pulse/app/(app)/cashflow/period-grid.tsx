'use client';

// The "By period" spreadsheet — modelled on the owner's real cashflow
// workbook. Rows = money categories (FINANCIAL POSITION → INCOME → COSTS →
// RESERVES → END POSITION), columns = periods on the workspace rhythm.
// Unsettled expected payments render as draggable chips (drop on another
// period column → PATCH expected_date, optimistic); budget lines expand into
// non-draggable recurring amounts (they're rules, not payments).
//
// Degrades: projection / budget lines are admin-only — when they're absent
// only INCOME + COSTS (the caller's own commitments) render.

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { money } from '@/lib/money';
import { moveLine } from './actions';
import type {
  BudgetLine,
  Commitment,
  Line,
  PeriodSettings,
  Projection,
  StageOption,
} from './types';

const MS_PER_DAY = 86400000;
const PERIOD_COUNT = 10;
// ~3 columns per chevron click (min column width is 112px + padding).
const SCROLL_STEP_PX = 3 * 120;

function todayUTC(): Date {
  return new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}
function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

// Next `count` period start dates. Week/fortnight walk the anchor grid to
// the boundary at-or-before today (same as the API's projection); months are
// calendar months starting with the current one.
function computePeriodStarts(s: PeriodSettings, count: number): string[] {
  const today = todayUTC();
  const starts: string[] = [];
  if (s.granularity === 'month' || s.granularity === 'quarter') {
    const step = s.granularity === 'quarter' ? 3 : 1;
    const startMonth =
      s.granularity === 'quarter'
        ? Math.floor(today.getUTCMonth() / 3) * 3
        : today.getUTCMonth();
    for (let i = 0; i < count; i++) {
      starts.push(isoDate(new Date(Date.UTC(today.getUTCFullYear(), startMonth + i * step, 1))));
    }
    return starts;
  }
  const step = s.granularity === 'week' ? 7 : 14;
  const anchor = s.anchor_date ? new Date(s.anchor_date + 'T00:00:00Z') : today;
  const daysFromAnchor = Math.floor((today.getTime() - anchor.getTime()) / MS_PER_DAY);
  const offset = ((daysFromAnchor % step) + step) % step;
  let cur = new Date(today.getTime() - offset * MS_PER_DAY);
  for (let i = 0; i < count; i++) {
    starts.push(isoDate(cur));
    cur = new Date(cur.getTime() + step * MS_PER_DAY);
  }
  return starts;
}

function fmtStart(iso: string, granularity: PeriodSettings['granularity']): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: granularity === 'month' || granularity === 'quarter' ? undefined : 'numeric',
    month: 'short',
    year: granularity === 'month' || granularity === 'quarter' ? 'numeric' : undefined,
    timeZone: 'UTC',
  });
}

// Expand a budget line into occurrence dates inside the grid's window —
// mirrors the API's projection expansion (advance from starts_on/today on
// the cadence grid; stop at ends_on/horizon).
function budgetOccurrences(bl: BudgetLine, horizonIso: string): string[] {
  const today = todayUTC();
  const horizon = new Date(horizonIso + 'T00:00:00Z');
  const until = bl.ends_on ? new Date(bl.ends_on + 'T00:00:00Z') : horizon;
  const advance = (d: Date): Date =>
    bl.cadence === 'weekly'
      ? addDays(d, 7)
      : bl.cadence === 'fortnightly'
        ? addDays(d, 14)
        : bl.cadence === 'monthly'
          ? addMonths(d, 1)
          : bl.cadence === 'quarterly'
            ? addMonths(d, 3)
            : addMonths(d, 12);
  let cur = bl.starts_on ? new Date(bl.starts_on + 'T00:00:00Z') : today;
  // Advance into the visible window without drifting the cadence grid.
  while (cur < today) cur = advance(cur);
  const out: string[] = [];
  let guard = 0;
  while (cur <= until && cur < horizon && guard++ < 400) {
    out.push(isoDate(cur));
    cur = advance(cur);
  }
  return out;
}

function counterpartyName(cm: Commitment): string {
  if (cm.organisation?.name) return cm.organisation.name;
  if (cm.person) {
    const full = `${cm.person.first_name ?? ''} ${cm.person.last_name ?? ''}`.trim();
    if (full) return full;
    if (cm.person.email) return cm.person.email;
  }
  return 'No counterparty yet';
}

// Stage chips colour by KIND (same palette as the counterparty list).
const KIND_STYLE: Record<string, string> = {
  open: 'bg-amber-50 text-amber-600',
  committed: 'bg-emerald-50 text-emerald-600',
  won: 'bg-slate-100 text-slate-500',
  lost: 'bg-slate-50 text-slate-400',
};
const UNKNOWN_STAGE_STYLE = 'bg-slate-50 text-slate-500';

type Col = { key: string; idx: number; label: string; droppable: boolean };
type Card = { line: Line; cm: Commitment; date: string };
type OppRow = { cm: Commitment; cells: Card[][] };
type ClientGroup = { key: string; name: string; opps: OppRow[]; subtotals: number[] };
type BudgetRow = { bl: BudgetLine; amounts: number[] };

const STICKY = 'sticky left-0 z-10 min-w-[220px] max-w-[300px] border-r border-line/60';
const NUM_CELL = 'px-3 py-1.5 text-right align-top tabular-nums whitespace-nowrap border-b border-line/40';

function Faint() {
  return <span className="text-ink-muted/40 select-none">—</span>;
}

export function PeriodGrid({
  items,
  settings,
  stages,
  projection,
  budgetLines,
  onEdit,
  onAdd,
}: {
  items: Commitment[];
  settings: PeriodSettings;
  stages: StageOption[];
  projection: Projection | null;
  budgetLines: BudgetLine[];
  onEdit: (cm: Commitment) => void;
  onAdd: (direction: 'in' | 'out') => void;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Optimistic overrides: lineId → expected_date, applied on drop and kept
  // until router.refresh() brings the server truth (reverted on error).
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [hoverCol, setHoverCol] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [costsOpen, setCostsOpen] = useState(false);

  const stageByKey = new Map(stages.map((s) => [s.key, s]));

  // ---- columns -------------------------------------------------------------
  // One extra start acts as the horizon — anything at-or-after it is "Later".
  const allStarts = computePeriodStarts(settings, PERIOD_COUNT + 1);
  const starts = allStarts.slice(0, PERIOD_COUNT);
  const horizon = allStarts[PERIOD_COUNT];

  const cols: Col[] = [
    { key: 'overdue', idx: 0, label: 'Overdue', droppable: false },
    ...starts.map((s, i) => ({
      key: s,
      idx: i + 1,
      label: fmtStart(s, settings.granularity),
      droppable: true,
    })),
    { key: 'later', idx: starts.length + 1, label: 'Later', droppable: false },
  ];
  const nCols = cols.length;
  const laterIdx = nCols - 1;

  const colIdxFor = (date: string): number => {
    if (date < starts[0]) return 0;
    if (date >= horizon) return laterIdx;
    for (let i = starts.length - 1; i >= 0; i--) {
      if (starts[i] <= date) return i + 1;
    }
    return 1;
  };

  // ---- bucket commitments ----------------------------------------------------
  const zeros = () => new Array<number>(nCols).fill(0);
  const incomeTotals = zeros(); // weighted (probability), full when invoiced
  const costTotals = zeros();
  const incomeGroups = new Map<string, ClientGroup>();
  const costGroups = new Map<string, ClientGroup>();
  const oppRowByCm = new Map<string, OppRow>();
  const lineCol = new Map<string, string>(); // lineId → current column key
  let laterHasContent = false;

  for (const cm of items) {
    const groups = cm.direction === 'out' ? costGroups : incomeGroups;
    const totals = cm.direction === 'out' ? costTotals : incomeTotals;
    const gKey = cm.organisation?.id ?? cm.person?.id ?? '—';
    let group = groups.get(gKey);
    if (!group) {
      group = { key: gKey, name: counterpartyName(cm), opps: [], subtotals: zeros() };
      groups.set(gKey, group);
    }
    let row = oppRowByCm.get(cm.id);
    if (!row) {
      row = { cm, cells: Array.from({ length: nCols }, () => [] as Card[]) };
      oppRowByCm.set(cm.id, row);
      group.opps.push(row);
    }
    for (const line of cm.lines) {
      if (line.settled_at) continue;
      const date = overrides[line.id] ?? line.expected_date;
      const idx = colIdxFor(date);
      if (idx === laterIdx) laterHasContent = true;
      row.cells[idx].push({ line, cm, date });
      lineCol.set(line.id, cols[idx].key);
      group.subtotals[idx] += line.amount_cents;
      // Weighted: invoiced counts in full; otherwise probability-weighted
      // (committed/won stages already carry probability 100).
      totals[idx] += line.invoiced_at
        ? line.amount_cents
        : Math.round((line.amount_cents * cm.probability) / 100);
    }
  }
  for (const groups of [incomeGroups, costGroups]) {
    for (const g of groups.values()) {
      g.opps.sort((a, b) => a.cm.label.localeCompare(b.cm.label));
      for (const o of g.opps) {
        for (const cell of o.cells) {
          cell.sort((a, b) => a.date.localeCompare(b.date) || a.line.id.localeCompare(b.line.id));
        }
      }
    }
  }
  const sortGroups = (m: Map<string, ClientGroup>) =>
    [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  const incomeClientGroups = sortGroups(incomeGroups);
  const costClientGroups = sortGroups(costGroups);

  // ---- budget lines → recurring rows (rules, not payments) ------------------
  const incomeBudgetRows: BudgetRow[] = [];
  const costBudgetRows: BudgetRow[] = [];
  for (const bl of budgetLines) {
    if (!bl.included) continue;
    const amounts = zeros();
    for (const date of budgetOccurrences(bl, horizon)) {
      amounts[colIdxFor(date)] += bl.amount_cents;
    }
    const row = { bl, amounts };
    if (bl.direction === 'in') {
      incomeBudgetRows.push(row);
      for (let i = 0; i < nCols; i++) incomeTotals[i] += amounts[i];
    } else {
      costBudgetRows.push(row);
      for (let i = 0; i < nCols; i++) costTotals[i] += amounts[i];
    }
  }

  const visibleCols = laterHasContent ? cols : cols.slice(0, -1);

  // ---- projection rows (admin-only; null → sections hidden) -----------------
  const projByStart = new Map((projection?.periods ?? []).map((p) => [p.start, p]));
  // Balance BEFORE the column's flows: the bank anchor for the first period,
  // else the previous period's end balance.
  const positionFor = (col: Col): number | null => {
    if (!projection || !col.droppable) return null;
    const i = col.idx - 1; // index into starts
    if (i === 0) return projection.anchor.bank_cents;
    return projByStart.get(starts[i - 1])?.balance_expected ?? null;
  };
  const reservedFor = (col: Col): number | null =>
    projection && col.droppable ? (projByStart.get(col.key)?.reserved_expected ?? null) : null;
  const endFor = (col: Col): number | null =>
    projection && col.droppable ? (projByStart.get(col.key)?.balance_expected ?? null) : null;

  // ---- filtering (rows only — totals always cover ALL data) -----------------
  const q = filter.trim().toLowerCase();
  const match = (s: string | null | undefined) => (s ?? '').toLowerCase().includes(q);
  const filterGroups = (groups: ClientGroup[]): ClientGroup[] => {
    if (!q) return groups;
    return groups
      .map((g) => (match(g.name) ? g : { ...g, opps: g.opps.filter((o) => match(o.cm.label)) }))
      .filter((g) => match(g.name) || g.opps.length > 0);
  };
  const filterBudget = (rows: BudgetRow[]): BudgetRow[] =>
    q ? rows.filter((r) => match(r.bl.label) || match(r.bl.category)) : rows;

  const shownIncomeGroups = filterGroups(incomeClientGroups);
  const shownCostGroups = filterGroups(costClientGroups);
  const shownIncomeBudget = filterBudget(incomeBudgetRows);
  const shownCostBudget = filterBudget(costBudgetRows);

  // An active filter would show nothing inside a collapsed section — expand.
  const incomeExpanded = incomeOpen || q !== '';
  const costsExpanded = costsOpen || q !== '';

  const incomeRowCount =
    incomeClientGroups.reduce((a, g) => a + g.opps.length, 0) + incomeBudgetRows.length;
  const costRowCount =
    costClientGroups.reduce((a, g) => a + g.opps.length, 0) + costBudgetRows.length;

  // ---- drag & drop -----------------------------------------------------------
  async function drop(colKey: string, e: React.DragEvent) {
    e.preventDefault();
    setHoverCol(null);
    const lineId = e.dataTransfer.getData('text/plain');
    if (!lineId || lineCol.get(lineId) === colKey) return;
    setError(null);
    setOverrides((o) => ({ ...o, [lineId]: colKey }));
    const res = await moveLine(lineId, colKey);
    if (res.error) {
      setError(res.error);
      setOverrides((o) => {
        const next = { ...o };
        delete next[lineId];
        return next;
      });
      return;
    }
    router.refresh();
  }

  const dropProps = (col: Col) =>
    col.droppable
      ? {
          onDragOver: (e: React.DragEvent) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setHoverCol(col.key);
          },
          onDragLeave: () => setHoverCol((h) => (h === col.key ? null : h)),
          onDrop: (e: React.DragEvent) => drop(col.key, e),
        }
      : {};
  const hoverBg = (col: Col) => (hoverCol === col.key ? 'bg-slate-100' : '');

  function scrollByCols(dir: -1 | 1) {
    scrollRef.current?.scrollBy({ left: dir * SCROLL_STEP_PX, behavior: 'smooth' });
  }

  // ---- row renderers ---------------------------------------------------------
  const renderMoney = (v: number | null | undefined, cls = '') =>
    v == null || v === 0 ? <Faint /> : <span className={cls}>{money(Math.round(v))}</span>;

  function sectionHeaderRow(opts: {
    label: string;
    totals?: number[];
    tone?: string;
    count?: number;
    open?: boolean;
    onToggle?: () => void;
    valueFor?: (col: Col) => number | null;
    valueCls?: (v: number | null) => string;
  }) {
    return (
      <tr key={`section-${opts.label}`}>
        <td className={`${STICKY} bg-yellow-50 px-4 py-2.5 border-b border-line`}>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink">
              {opts.label}
            </span>
            {opts.count !== undefined && (
              <span className="rounded-full bg-slate-200/70 px-1.5 py-px text-[11px] font-medium text-ink-subtle tabular-nums">
                {opts.count}
              </span>
            )}
            {opts.onToggle && (
              <button
                type="button"
                onClick={opts.onToggle}
                className="text-[11px] font-medium text-ink-subtle hover:text-ink underline-offset-2 hover:underline"
              >
                {opts.open ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        </td>
        {visibleCols.map((col) => {
          const v = opts.valueFor ? opts.valueFor(col) : (opts.totals?.[col.idx] ?? null);
          const cls = opts.valueCls?.(v) ?? opts.tone ?? 'text-ink';
          // Balance rows (valueFor) show a true zero; totals rows hide it.
          const body = opts.valueFor ? (
            v == null ? <Faint /> : <span className={cls}>{money(Math.round(v))}</span>
          ) : (
            renderMoney(v, cls)
          );
          return (
            <td
              key={col.key}
              {...dropProps(col)}
              className={`px-3 py-2.5 text-right align-middle tabular-nums whitespace-nowrap border-b border-line bg-yellow-50 text-xs font-semibold ${hoverBg(col)}`}
            >
              {body}
            </td>
          );
        })}
      </tr>
    );
  }

  function clientRows(groups: ClientGroup[]): React.ReactNode {
    return groups.map((g) => (
      <FragmentRows key={g.key}>
        <tr>
          <td className={`${STICKY} bg-white px-4 py-1.5 border-b border-line/40`}>
            <span className="block truncate text-sm font-semibold text-ink">{g.name}</span>
          </td>
          {visibleCols.map((col) => (
            <td
              key={col.key}
              {...dropProps(col)}
              className={`${NUM_CELL} ${hoverBg(col)}`}
            >
              {renderMoney(g.subtotals[col.idx], 'text-xs font-medium text-ink-subtle')}
            </td>
          ))}
        </tr>
        {g.opps.map((o) => {
          const stage = stageByKey.get(o.cm.stage);
          return (
            <tr key={o.cm.id}>
              <td className={`${STICKY} bg-white px-4 py-1.5 border-b border-line/40`}>
                <button
                  type="button"
                  onClick={() => onEdit(o.cm)}
                  className="flex w-full items-center gap-2 pl-4 text-left"
                >
                  <span className="truncate text-sm text-ink hover:underline underline-offset-2">
                    {o.cm.label}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium ${
                      KIND_STYLE[stage?.kind ?? ''] ?? UNKNOWN_STAGE_STYLE
                    }`}
                  >
                    {stage?.label ?? o.cm.stage}
                  </span>
                </button>
              </td>
              {visibleCols.map((col) => {
                const cards = o.cells[col.idx];
                return (
                  <td
                    key={col.key}
                    {...dropProps(col)}
                    className={`px-2 py-1.5 text-right align-top border-b border-line/40 whitespace-nowrap ${hoverBg(col)}`}
                  >
                    {cards.length === 0 ? (
                      <Faint />
                    ) : (
                      <div className="flex flex-wrap justify-end gap-1">
                        {cards.map((card) => (
                          <span
                            key={card.line.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', card.line.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onClick={() => onEdit(card.cm)}
                            title={`${card.cm.label} — expected ${card.date}`}
                            className="inline-flex items-center gap-1 cursor-grab active:cursor-grabbing rounded-md bg-surface-raised ring-1 ring-black/5 shadow-sm px-1.5 py-0.5 text-xs font-medium tabular-nums text-ink hover:ring-neutral-300"
                          >
                            {money(card.line.amount_cents)}
                            {card.line.invoiced_at && (
                              <FileText size={10} strokeWidth={2} className="text-sky-600" />
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </FragmentRows>
    ));
  }

  function budgetRows(rows: BudgetRow[]): React.ReactNode {
    if (rows.length === 0) return null;
    return (
      <FragmentRows key="budget">
        <tr>
          <td className={`${STICKY} bg-white px-4 py-1.5 border-b border-line/40`}>
            <span className="block truncate text-sm font-semibold text-ink">Recurring (budget)</span>
          </td>
          {visibleCols.map((col) => (
            <td key={col.key} className={NUM_CELL}>
              {renderMoney(
                rows.reduce((a, r) => a + r.amounts[col.idx], 0),
                'text-xs font-medium text-ink-subtle',
              )}
            </td>
          ))}
        </tr>
        {rows.map((r) => (
          <tr key={r.bl.id}>
            <td className={`${STICKY} bg-white px-4 py-1.5 border-b border-line/40`}>
              <div className="flex items-center gap-2 pl-4">
                <span className="truncate text-sm text-ink">{r.bl.label}</span>
                {r.bl.category && (
                  <span className="shrink-0 truncate text-[11px] text-ink-muted">{r.bl.category}</span>
                )}
              </div>
            </td>
            {visibleCols.map((col) => (
              <td key={col.key} className={NUM_CELL} title="recurring — edit in Budget">
                {renderMoney(r.amounts[col.idx], 'text-xs tabular-nums text-ink-subtle')}
              </td>
            ))}
          </tr>
        ))}
      </FragmentRows>
    );
  }

  return (
    <div className="mt-6">
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* View header: filter + scroll chevrons (works for every input device). */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter rows…"
            className="w-52 rounded-md border border-line bg-surface-raised px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
          />
          {q && (
            <span className="truncate text-xs text-ink-muted">
              (filtered view — totals cover all rows)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Show per week / fortnight / month / quarter — server refetch via
              ?show= keeps the position rows aligned with the columns. */}
          <ShowSwitcher current={settings.granularity} />
          <button
            type="button"
            aria-label="Scroll to earlier periods"
            onClick={() => scrollByCols(-1)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-white ring-1 ring-line text-ink-subtle hover:text-ink"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Scroll to later periods"
            onClick={() => scrollByCols(1)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-white ring-1 ring-line text-ink-subtle hover:text-ink"
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
        <div ref={scrollRef} className="overflow-x-auto rounded-2xl">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className={`${STICKY} z-20 bg-white px-4 py-3 border-b border-line`} />
                {visibleCols.map((col) => (
                  <th
                    key={col.key}
                    className={`min-w-[112px] px-3 py-3 text-right text-xs font-semibold tracking-tight whitespace-nowrap border-b border-line ${
                      col.key === 'overdue' ? 'text-rose-600' : 'text-ink'
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* 1 · FINANCIAL POSITION — running balance at each period start. */}
              {projection &&
                sectionHeaderRow({
                  label: 'Financial position',
                  valueFor: positionFor,
                  valueCls: (v) => (v != null && v < 0 ? 'text-red-600' : 'text-ink'),
                })}

              {/* No balances yet → the position is meaningless; say where to fix it. */}
              {projection &&
                projection.anchor.bank_cents === 0 &&
                projection.anchor.reserve_cents === 0 && (
                  <tr>
                    <td className={`${STICKY} bg-white px-4 py-2 border-b border-line/40`}>
                      <a
                        href="/accounts"
                        className="text-xs text-ink-subtle underline underline-offset-2 hover:text-ink"
                      >
                        Fill in your bank balances →
                      </a>
                    </td>
                    <td
                      colSpan={visibleCols.length}
                      className="border-b border-line/40 px-3 py-2 text-xs text-ink-muted"
                    >
                      Add your accounts and update balances — the position rows anchor on them.
                    </td>
                  </tr>
                )}

              {/* 2 · INCOME */}
              {sectionHeaderRow({
                label: 'Income',
                totals: incomeTotals,
                tone: 'text-emerald-700',
                count: incomeRowCount,
                open: incomeExpanded,
                onToggle: () => setIncomeOpen((v) => !v),
              })}
              {incomeExpanded && clientRows(shownIncomeGroups)}
              {incomeExpanded && budgetRows(shownIncomeBudget)}
              {incomeExpanded && (
                <AddRow sticky={STICKY} span={visibleCols.length}>
                  <span className="flex items-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => onAdd('in')}
                      className="font-medium text-ink-subtle hover:text-ink underline-offset-2 hover:underline"
                    >
                      + Opportunity
                    </button>
                    <Link
                      href="/budget"
                      className="text-ink-muted hover:text-ink underline-offset-2 hover:underline"
                    >
                      + Recurring income
                    </Link>
                  </span>
                </AddRow>
              )}

              {/* 3 · COSTS */}
              {sectionHeaderRow({
                label: 'Costs',
                totals: costTotals,
                tone: 'text-rose-700',
                count: costRowCount,
                open: costsExpanded,
                onToggle: () => setCostsOpen((v) => !v),
              })}
              {costsExpanded && clientRows(shownCostGroups)}
              {costsExpanded && budgetRows(shownCostBudget)}
              {costsExpanded && (
                <AddRow sticky={STICKY} span={visibleCols.length}>
                  <span className="flex items-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => onAdd('out')}
                      className="font-medium text-ink-subtle hover:text-ink underline-offset-2 hover:underline"
                    >
                      + Cost
                    </button>
                    <Link
                      href="/budget"
                      className="text-ink-muted hover:text-ink underline-offset-2 hover:underline"
                    >
                      + Recurring cost
                    </Link>
                  </span>
                </AddRow>
              )}

              {/* 4 · RESERVES */}
              {projection && (
                <tr>
                  <td className={`${STICKY} bg-white px-4 py-2 border-b border-line/40`}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                      Reserves
                    </span>
                  </td>
                  {visibleCols.map((col) => (
                    <td key={col.key} className={NUM_CELL}>
                      {renderMoney(reservedFor(col), 'text-xs text-ink-muted')}
                    </td>
                  ))}
                </tr>
              )}

              {/* 5 · END POSITION — the sheet's red row. */}
              {projection && (
                <tr>
                  <td className={`${STICKY} bg-yellow-100/70 px-4 py-2.5`}>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink">
                      End position
                    </span>
                  </td>
                  {visibleCols.map((col) => {
                    const v = endFor(col);
                    const negative = v != null && v < 0;
                    return (
                      <td
                        key={col.key}
                        className={`px-3 py-2.5 text-right align-middle tabular-nums whitespace-nowrap text-xs font-bold ${
                          negative ? 'bg-red-50 text-red-600' : 'bg-yellow-100/70 text-ink'
                        }`}
                      >
                        {v == null ? <Faint /> : money(Math.round(v))}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// "+" row at the bottom of an expanded section (Sjoerd 2026-07-08): one-off
// via the dialog, recurring via the Budget page.
function AddRow({
  sticky,
  span,
  children,
}: {
  sticky: string;
  span: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td className={`${sticky} bg-white px-4 py-2 border-b border-line/40`}>{children}</td>
      <td colSpan={span} className="border-b border-line/40" />
    </tr>
  );
}

// React fragments can't take a key inline with the shorthand syntax in a
// .map — tiny named wrapper keeps the row groups keyed.
function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}


// Show per week / fortnight / month / quarter. A quarter is display-only —
// the settings rhythm stays what it is; ?show= re-fetches the projection on
// the requested grid so every row stays aligned.
function ShowSwitcher({ current }: { current: string }) {
  const router = useRouter();
  return (
    <select
      value={current}
      onChange={(e) => router.push(`/cashflow?show=${e.target.value}`)}
      aria-label="Show periods per"
      className="rounded-md border border-line bg-surface-raised px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
    >
      <option value="week">Per week</option>
      <option value="fortnight">Per fortnight</option>
      <option value="month">Per month</option>
      <option value="quarter">Per quarter</option>
    </select>
  );
}
