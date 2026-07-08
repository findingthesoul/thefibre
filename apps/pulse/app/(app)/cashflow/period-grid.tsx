'use client';

// The "By period" spreadsheet — modelled on the owner's real cashflow
// workbook. Rows = money categories (BANK → INCOME → COSTS → RESERVATIONS →
// END POSITION), columns = periods on the workspace rhythm plus a final
// Total column (the workbook's rightmost sums). Unsettled expected payments
// render as draggable pills (drop on another period column → PATCH
// expected_date, optimistic); a client group's per-period subtotal drags the
// whole group's one-off lines at once. Budget lines AND repeating
// commitments expand into non-draggable recurring amounts (rules, not
// payments).
//
// Spreadsheet feel (Sjoerd 2026-07-08: "every line should just work on its
// own"): on a one-off item row a CLICK on a pill edits that amount in place,
// and a click on a cell's empty space adds a new payment dated on that
// period's start — dragging keeps retiming. The dialog stays for the rest
// (row-label click). While a cell is being edited the grid enters FOCUS
// MODE (Sjoerd 2026-07-09): the other sections fold as if closed (manual
// fold state untouched), the active row pushes forward, siblings step back.
//
// Column rules (Sjoerd 2026-07-08): the Overdue column only renders when it
// actually holds overdue unsettled amounts — otherwise the grid starts at the
// current period. "Later" likewise only renders with content.
//
// Client groups default CLOSED; the set of open groups persists in
// localStorage per view ("store pref of the latest visit").
//
// Degrades: projection / budget lines / accounts are admin-only — when
// they're absent only INCOME + COSTS (the caller's own commitments) render.

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronLeft, ChevronRight, FileText, Maximize2, Minimize2 } from 'lucide-react';
import { money } from '@/lib/money';
import { savePref } from '@/lib/prefs-actions';
import { COOKIE_CASHFLOW_FIT } from '@/lib/prefs-shared';
import { addLine, duplicateLines, moveLine, moveLines, updateLineAmount } from './actions';
import { recordSnapshots } from '../accounts/actions';
import { loadOpenGroups, saveOpenGroups } from './types';
import type {
  BudgetLine,
  Commitment,
  Line,
  PeriodSettings,
  Projection,
  PulseAccount,
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
function todayLocalIso(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local tz
}

// Euro string → integer cents. Accepts comma decimals ("1234,56" or "1234.56").
function parseEuro(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = parseFloat(t);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

// Fit-to-screen formatter: full euros (no k-notation), just no space after €.
function moneyCompact(cents: number): string {
  return '€' + new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 }).format(cents / 100);
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

// Expand a recurring rule into occurrence dates inside the grid's window —
// mirrors the API's projection expansion (advance from starts_on/today on
// the cadence grid; stop at ends_on/horizon). Shared by budget lines AND
// repeating commitments (recurring is a characteristic, not a separate thing).
function cadenceOccurrences(
  cadence: BudgetLine['cadence'],
  startsOn: string | null,
  endsOn: string | null,
  horizonIso: string,
): string[] {
  const today = todayUTC();
  const horizon = new Date(horizonIso + 'T00:00:00Z');
  const until = endsOn ? new Date(endsOn + 'T00:00:00Z') : horizon;
  const advance = (d: Date): Date =>
    cadence === 'weekly'
      ? addDays(d, 7)
      : cadence === 'fortnightly'
        ? addDays(d, 14)
        : cadence === 'monthly'
          ? addMonths(d, 1)
          : cadence === 'quarterly'
            ? addMonths(d, 3)
            : addMonths(d, 12);
  let cur = startsOn ? new Date(startsOn + 'T00:00:00Z') : today;
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

// Section colour identities (Sjoerd 2026-07-08: "make the costs way more
// attractive in design"). Income = emerald, costs = rose (with − amounts).
type Direction = 'in' | 'out';
const AMT_TONE: Record<Direction, string> = {
  in: 'text-emerald-700',
  out: 'text-rose-700',
};
const PILL_TONE: Record<Direction, string> = {
  in: 'bg-emerald-50 ring-emerald-200 text-emerald-800',
  out: 'bg-rose-50 ring-rose-200 text-rose-800',
};
const TITLE_TONE: Record<Direction, string> = {
  in: 'text-emerald-800',
  out: 'text-rose-800',
};
const ACCENT_BAR: Record<Direction, string> = {
  in: 'bg-emerald-500',
  out: 'bg-rose-500',
};
const sign = (dir: Direction) => (dir === 'out' ? '−' : '');

// Zebra stripes for expanded section rows. The sticky first cell needs an
// OPAQUE background (it covers horizontally-scrolled content), so it gets a
// solid slate-50 on odd rows while the rest of the row uses the 40% tint.
const ZEBRA =
  '[&:nth-child(odd)]:bg-slate-50/40 [&:nth-child(odd)>td:first-child]:bg-slate-50';

// Focus-mode row states (Sjoerd 2026-07-09: "the content of those rows
// become 110%... like pushed forward").
const ROW_ACTIVE =
  'relative z-10 scale-[1.05] origin-left bg-white shadow-md ring-1 ring-neutral-300 transition-transform duration-150';
const ROW_DIMMED = 'opacity-60 transition-opacity duration-150';

// Payload prefix for org-level (whole-group) drags on the subtotal chips.
const GROUP_DRAG_PREFIX = 'group:';

type Col = { key: string; idx: number; label: string; droppable: boolean };
type DropHandlers = {
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
};
type Card = { line: Line; cm: Commitment; date: string };
// A repeating commitment renders as per-column occurrence amounts instead of
// draggable payment cards — its lines are skipped (the projection's too).
type OppRow = {
  cm: Commitment;
  cells: Card[][];
  recurring?: { cadence: string; amounts: number[] };
};
type ClientGroup = {
  key: string;
  name: string;
  opps: OppRow[];
  subtotals: number[];
  // One-off line ids per column — the org-level drag payload.
  lineIds: string[][];
};
type BudgetRow = { bl: BudgetLine; amounts: number[] };
type Focus = { section: Direction | 'position'; rowId: string };

function Faint() {
  return <span className="text-ink-muted/40 select-none">—</span>;
}

export function PeriodGrid({
  items,
  settings,
  stages,
  projection,
  budgetLines,
  accounts,
  initialFit,
  onEdit,
  onAdd,
  onOpenGroup,
}: {
  items: Commitment[];
  settings: PeriodSettings;
  stages: StageOption[];
  projection: Projection | null;
  budgetLines: BudgetLine[];
  accounts: PulseAccount[];
  initialFit: 'on' | 'off';
  onEdit: (cm: Commitment) => void;
  onAdd: (direction: 'in' | 'out') => void;
  // Clicking the client NAME opens the per-org popup ("I want per org a
  // popup") — the chevron keeps folding; separate hit areas.
  onOpenGroup: (key: string) => void;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Optimistic overrides: lineId → expected_date, applied on drop and kept
  // until router.refresh() brings the server truth (reverted on error, with
  // the error surfaced in the banner — never silently).
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [hoverCol, setHoverCol] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [costsOpen, setCostsOpen] = useState(false);
  const [positionOpen, setPositionOpen] = useState(false);
  // Client groups default CLOSED (Sjoerd 2026-07-09); the open set is the
  // latest visit's, restored from localStorage after mount (the server
  // render must match the first client render to avoid hydration issues).
  // Keys carry the direction: `${dir}:${groupKey}`.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  useEffect(() => {
    setOpenGroups(loadOpenGroups('period'));
  }, []);
  function toggleGroup(foldKey: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(foldKey)) next.delete(foldKey);
      else next.add(foldKey);
      saveOpenGroups('period', next);
      return next;
    });
  }
  // Fit-to-screen: the whole table squeezes into the viewport (no h-scroll).
  const [fit, setFit] = useState(initialFit === 'on');
  // FOCUS MODE — which row is being worked in (inline amount/balance edit).
  // While set, the other sections render folded (their manual open state is
  // untouched and restores when focus ends) and sibling rows de-emphasize.
  const [focus, setFocus] = useState<Focus | null>(null);
  const focusHandler = (section: Focus['section'], rowId: string) => (active: boolean) =>
    setFocus((cur) => (active ? { section, rowId } : cur?.rowId === rowId ? null : cur));

  const stageByKey = new Map(stages.map((s) => [s.key, s]));
  const fmt = fit ? moneyCompact : money;

  // ---- fit-aware layout tokens ----------------------------------------------
  const sticky = fit
    ? 'sticky left-0 z-10 w-[160px] min-w-[160px] max-w-[160px] border-r border-line/60'
    : 'sticky left-0 z-10 min-w-[220px] max-w-[300px] border-r border-line/60';
  const cellText = fit ? 'text-[11px]' : 'text-xs';
  const labelText = fit ? 'text-[11px]' : 'text-sm';
  const numPad = fit ? 'px-1.5' : 'px-3';
  const chipPad = fit ? 'px-1.5' : 'px-2';
  const numCell = `${numPad} py-1.5 text-right align-top tabular-nums whitespace-nowrap border-b border-line/40`;
  // The final Total column — the workbook's rightmost sums, visually set off.
  const totalCell = `${numPad} py-1.5 text-right align-top tabular-nums whitespace-nowrap border-b border-line/40 border-l-2 border-l-line bg-yellow-50/60`;
  const totalHeaderCell = `${numPad} py-2.5 text-right align-middle tabular-nums whitespace-nowrap border-b border-line border-l-2 border-l-line bg-yellow-50 ${cellText} font-semibold`;

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
  // The current period — the first droppable column, whether or not Overdue
  // renders. Account balances edit HERE (it's "now or closest to now").
  const currentColKey = starts[0];
  const [reservesOpen, setReservesOpen] = useState(false);

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
  let overdueHasContent = false;

  for (const cm of items) {
    const groups = cm.direction === 'out' ? costGroups : incomeGroups;
    const totals = cm.direction === 'out' ? costTotals : incomeTotals;
    const gKey = cm.organisation?.id ?? cm.person?.id ?? '—';
    let group = groups.get(gKey);
    if (!group) {
      group = {
        key: gKey,
        name: counterpartyName(cm),
        opps: [],
        subtotals: zeros(),
        lineIds: Array.from({ length: nCols }, () => [] as string[]),
      };
      groups.set(gKey, group);
    }
    let row = oppRowByCm.get(cm.id);
    if (!row) {
      row = { cm, cells: Array.from({ length: nCols }, () => [] as Card[]) };
      oppRowByCm.set(cm.id, row);
      group.opps.push(row);
    }
    if (cm.repeat_cadence) {
      // Repeating: expand quantity × unit price on the cadence grid and skip
      // the lines entirely (the API's projection does the same). Weighting
      // mirrors the lines: probability-weighted when open, full when
      // committed/won (those stages already carry probability 100).
      const per = Math.round(cm.quantity * (cm.unit_amount_cents ?? 0));
      const amounts = zeros();
      for (const date of cadenceOccurrences(
        cm.repeat_cadence,
        cm.repeat_starts_on,
        cm.repeat_until,
        horizon,
      )) {
        const idx = colIdxFor(date);
        if (idx === laterIdx) laterHasContent = true;
        amounts[idx] += per;
        group.subtotals[idx] += per;
        totals[idx] += Math.round((per * cm.probability) / 100);
      }
      row.recurring = { cadence: cm.repeat_cadence, amounts };
      continue;
    }
    for (const line of cm.lines) {
      if (line.settled_at) continue;
      const date = overrides[line.id] ?? line.expected_date;
      const idx = colIdxFor(date);
      if (idx === laterIdx) laterHasContent = true;
      if (idx === 0) overdueHasContent = true;
      row.cells[idx].push({ line, cm, date });
      lineCol.set(line.id, cols[idx].key);
      group.subtotals[idx] += line.amount_cents;
      group.lineIds[idx].push(line.id);
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
    for (const date of cadenceOccurrences(bl.cadence, bl.starts_on, bl.ends_on, horizon)) {
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

  // Overdue and Later both hide when empty — the grid then starts at the
  // current period (Sjoerd 2026-07-08: the Overdue column "can hide").
  const visibleCols = cols.filter(
    (c) =>
      (c.idx !== 0 || overdueHasContent) && (c.idx !== laterIdx || laterHasContent),
  );
  const visIdx = visibleCols.map((c) => c.idx);
  const sumVisible = (amounts: number[]) => visIdx.reduce((a, i) => a + (amounts[i] ?? 0), 0);

  // ---- projection rows (admin-only; null → sections hidden) -----------------
  const projByStart = new Map((projection?.periods ?? []).map((p) => [p.start, p]));
  // The BANK chain (Sjoerd 2026-07-09: "the END position of column 1 is the
  // bank of column 2"): the actual bank anchor in the first money column,
  // then every column n shows the END POSITION of column n−1.
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

  // ---- accounts (admin-only; banks first, then reserves) ---------------------
  const orderedAccounts = [
    ...accounts.filter((a) => a.kind === 'bank'),
    ...accounts.filter((a) => a.kind !== 'bank'),
  ];

  // Reserve accounts grow virtually across future columns (Sjoerd
  // 2026-07-09: "you see the reserves virtually grown with that amount"):
  // current actual + the cumulative per-period amounts of the reservation
  // rules targeting the account (pct% × that period's expected income —
  // the same math as the RESERVATIONS rows). accountId → colKey → cents.
  const reserveProjections = new Map<string, Map<string, number>>();
  if (projection?.reservation_rules) {
    for (const a of orderedAccounts) {
      if (a.kind !== 'reserve') continue;
      const pct = projection.reservation_rules
        .filter((r) => r.target_account_id === a.id)
        .reduce((s, r) => s + Number(r.percentage), 0);
      if (pct <= 0) continue; // no rule feeds it — stays current-only
      let cum = a.latest_snapshot?.balance_cents ?? 0;
      const byCol = new Map<string, number>();
      for (let i = 1; i < starts.length; i++) {
        const prevIncome = projByStart.get(starts[i - 1])?.expected_in ?? 0;
        cum += Math.round((prevIncome * pct) / 100);
        byCol.set(starts[i], cum);
      }
      reserveProjections.set(a.id, byCol);
    }
  }

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
  // Focus mode folds every section except the one being worked in (the
  // manual open state stays put and restores when focus ends).
  const incomeExpanded = focus ? focus.section === 'in' : incomeOpen || q !== '';
  const costsExpanded = focus ? focus.section === 'out' : costsOpen || q !== '';
  const positionExpanded = focus ? focus.section === 'position' : positionOpen;
  const reservationsExpanded = focus ? false : reservesOpen;

  const incomeRowCount =
    incomeClientGroups.reduce((a, g) => a + g.opps.length, 0) + incomeBudgetRows.length;
  const costRowCount =
    costClientGroups.reduce((a, g) => a + g.opps.length, 0) + costBudgetRows.length;

  // ---- drag & drop -----------------------------------------------------------
  // ONE handler for every drop target: opportunity cells (empty or not),
  // group subtotal cells and section-header cells all funnel through here
  // via dropProps(col). Two payloads: a bare lineId (single pill) or the
  // GROUP prefix carrying every one-off line id of a client's period.
  async function drop(colKey: string, e: React.DragEvent) {
    e.preventDefault();
    setHoverCol(null);
    const payload = e.dataTransfer.getData('text/plain');
    if (!payload) return;
    // ⌥ held on drop = duplicate into the target period (the spreadsheet
    // alt-drag copy); without it, move as always.
    const copy = e.altKey;

    if (payload.startsWith(GROUP_DRAG_PREFIX)) {
      let ids: string[] = [];
      try {
        ids = (JSON.parse(payload.slice(GROUP_DRAG_PREFIX.length)) as { ids?: string[] }).ids ?? [];
      } catch {
        return;
      }
      if (copy) {
        setError(null);
        const res = await duplicateLines(ids, colKey);
        if (res.error) setError(`Could not duplicate: ${res.error}`);
        else router.refresh();
        return;
      }
      ids = ids.filter((id) => lineCol.get(id) !== colKey);
      if (ids.length === 0) return;
      setError(null);
      // Optimistic: the whole group total jumps to the target column.
      setOverrides((o) => {
        const next = { ...o };
        for (const id of ids) next[id] = colKey;
        return next;
      });
      const res = await moveLines(ids, colKey);
      if (res.error) {
        setError(`Could not move the group's expected payments: ${res.error}`);
        setOverrides((o) => {
          const next = { ...o };
          for (const id of ids) delete next[id];
          return next;
        });
        return;
      }
      router.refresh();
      return;
    }

    const lineId = payload;
    if (copy) {
      setError(null);
      const res = await duplicateLines([lineId], colKey);
      if (res.error) setError(`Could not duplicate: ${res.error}`);
      else router.refresh();
      return;
    }
    if (lineCol.get(lineId) === colKey) return;
    setError(null);
    // Optimistic: the pill jumps to the target column immediately.
    setOverrides((o) => ({ ...o, [lineId]: colKey }));
    const res = await moveLine(lineId, colKey);
    if (res.error) {
      // Surface loudly, THEN fall back to the server truth.
      setError(`Could not move the expected payment: ${res.error}`);
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
            e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move';
            setHoverCol((h) => (h === col.key ? h : col.key));
          },
          onDragLeave: (e: React.DragEvent) => {
            // Entering a child (a pill) fires dragleave on the cell — ignore.
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setHoverCol((h) => (h === col.key ? null : h));
          },
          onDrop: (e: React.DragEvent) => drop(col.key, e),
        }
      : {};
  const hoverBg = (col: Col) => (hoverCol === col.key ? 'bg-slate-100' : '');

  function scrollByCols(dir: -1 | 1) {
    scrollRef.current?.scrollBy({ left: dir * SCROLL_STEP_PX, behavior: 'smooth' });
  }

  // ---- row renderers ---------------------------------------------------------
  const renderMoney = (v: number | null | undefined, cls = '') =>
    v == null || v === 0 ? <Faint /> : <span className={cls}>{fmt(Math.round(v))}</span>;
  // Directional amounts: emerald for income, rose (with − prefix) for costs.
  const renderAmt = (v: number | null | undefined, dir: Direction, extra = '') =>
    v == null || v === 0 ? (
      <Faint />
    ) : (
      <span className={`${extra} ${AMT_TONE[dir]}`}>
        {sign(dir)}
        {fmt(Math.round(v))}
      </span>
    );

  function sectionHeaderRow(opts: {
    label: string;
    totals?: number[];
    accent?: Direction; // emerald (in) / rose (out) identity
    count?: number;
    open?: boolean;
    onToggle?: () => void;
    valueFor?: (col: Col) => number | null;
    valueCls?: (v: number | null) => string;
    // The final Total-column cell. undefined + totals → sum of the rendered
    // periods; null → running balance, doesn't sum (faint —).
    total?: number | null;
  }) {
    const totalValue =
      opts.total !== undefined ? opts.total : opts.totals ? sumVisible(opts.totals) : null;
    return (
      <tr key={`section-${opts.label}`}>
        <td className={`${sticky} bg-yellow-50 px-4 py-2.5 border-b border-line`}>
          {opts.accent && (
            <span
              aria-hidden
              className={`absolute inset-y-0 left-0 w-[3px] ${ACCENT_BAR[opts.accent]}`}
            />
          )}
          {/* The whole header cell folds the section (Sjoerd: "Show more can
              be an arrow maybe? Fold open and close"). */}
          <button
            type="button"
            onClick={opts.onToggle}
            disabled={!opts.onToggle}
            className={`flex w-full items-center gap-2 text-left ${
              opts.onToggle ? 'cursor-pointer' : 'cursor-default'
            }`}
            aria-expanded={opts.onToggle ? opts.open : undefined}
          >
            {opts.onToggle &&
              (opts.open ? (
                <ChevronDown size={13} strokeWidth={2} className="shrink-0 text-ink-subtle" />
              ) : (
                <ChevronRight size={13} strokeWidth={2} className="shrink-0 text-ink-subtle" />
              ))}
            <span
              className={`truncate text-[11px] font-semibold uppercase tracking-wider ${
                opts.accent ? TITLE_TONE[opts.accent] : 'text-ink'
              }`}
              title={opts.label}
            >
              {opts.label}
            </span>
            {opts.count !== undefined && (
              <span className="shrink-0 rounded-full bg-slate-200/70 px-1.5 py-px text-[11px] font-medium text-ink-subtle tabular-nums">
                {opts.count}
              </span>
            )}
          </button>
        </td>
        {visibleCols.map((col) => {
          const v = opts.valueFor ? opts.valueFor(col) : (opts.totals?.[col.idx] ?? null);
          // Balance rows (valueFor) show a true zero; totals rows hide it.
          const body = opts.valueFor ? (
            v == null ? (
              <Faint />
            ) : (
              <span className={opts.valueCls?.(v) ?? 'text-ink'}>{fmt(Math.round(v))}</span>
            )
          ) : opts.accent ? (
            renderAmt(v, opts.accent)
          ) : (
            renderMoney(v, 'text-ink')
          );
          return (
            <td
              key={col.key}
              {...dropProps(col)}
              className={`${numPad} py-2.5 text-right align-middle tabular-nums whitespace-nowrap border-b border-line bg-yellow-50 ${cellText} font-semibold ${hoverBg(col)}`}
            >
              {body}
            </td>
          );
        })}
        <td className={totalHeaderCell}>
          {totalValue == null ? (
            <Faint />
          ) : opts.accent ? (
            renderAmt(totalValue, opts.accent)
          ) : (
            renderMoney(totalValue, 'text-ink')
          )}
        </td>
      </tr>
    );
  }

  function clientRows(groups: ClientGroup[], dir: Direction): React.ReactNode {
    return groups.map((g) => {
      // Groups default CLOSED; a click on the chevron/row opens them and the
      // choice persists ("store pref of the latest visit"). An active filter
      // force-expands; focus mode shows only the group being worked in.
      const foldKey = `${dir}:${g.key}`;
      const groupHasFocus =
        focus != null && focus.section === dir && g.opps.some((o) => o.cm.id === focus.rowId);
      const groupOpen = focus ? groupHasFocus : openGroups.has(foldKey) || q !== '';
      const groupDimmed = focus != null && focus.section === dir && !groupHasFocus;
      return (
      <FragmentRows key={g.key}>
        {/* Client group row — bolder, with a clearer bottom border. The
            subtotals stay visible when the item rows are folded away, and
            each one drags the WHOLE group's one-off lines to another period
            (Sjoerd 2026-07-09: "the numbers on org level should be drag and
            drop too"). */}
        <tr className={`${ZEBRA} ${groupDimmed ? ROW_DIMMED : ''}`}>
          <td className={`${sticky} bg-white px-4 py-1.5 border-b border-line`}>
            <div className="flex w-full items-center gap-1.5">
              {/* Two hit areas: the chevron folds, the NAME opens the org
                  popup (Sjoerd 2026-07-08: "I want per org a popup"). */}
              <button
                type="button"
                onClick={() => toggleGroup(foldKey)}
                aria-expanded={groupOpen}
                aria-label={`${groupOpen ? 'Fold' : 'Unfold'} ${g.name}`}
                className="shrink-0 -m-1 p-1"
              >
                {groupOpen ? (
                  <ChevronDown size={13} strokeWidth={2} className="text-ink-subtle" />
                ) : (
                  <ChevronRight size={13} strokeWidth={2} className="text-ink-subtle" />
                )}
              </button>
              {g.key === '—' ? (
                <span
                  className={`block truncate whitespace-nowrap ${labelText} font-semibold text-ink`}
                  title={g.name}
                >
                  {g.name}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenGroup(g.key)}
                  title={`${g.name} — opportunities & invoices`}
                  className={`min-w-0 truncate whitespace-nowrap text-left ${labelText} font-semibold text-ink hover:underline underline-offset-2`}
                >
                  {g.name}
                </button>
              )}
            </div>
          </td>
          {visibleCols.map((col) => {
            const v = g.subtotals[col.idx];
            const draggableIds = g.lineIds[col.idx];
            return (
              <td
                key={col.key}
                {...dropProps(col)}
                className={`${numPad} py-1.5 text-right align-top tabular-nums whitespace-nowrap border-b border-line ${hoverBg(col)}`}
              >
                {v !== 0 && draggableIds.length > 0 ? (
                  <span
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        'text/plain',
                        GROUP_DRAG_PREFIX + JSON.stringify({ ids: draggableIds }),
                      );
                      e.dataTransfer.effectAllowed = 'copyMove';
                    }}
                    title={`${g.name} — drag to retime all ${draggableIds.length} expected payment${
                      draggableIds.length === 1 ? '' : 's'
                    } of this period`}
                    className={`inline-flex cursor-grab active:cursor-grabbing items-center rounded-full ring-1 hover:shadow ${PILL_TONE[dir]} ${chipPad} py-0.5 ${cellText} font-semibold tabular-nums`}
                  >
                    {sign(dir)}
                    {fmt(v)}
                  </span>
                ) : (
                  renderAmt(v, dir, `${cellText} font-medium`)
                )}
              </td>
            );
          })}
          <td className={totalCell}>
            {renderAmt(sumVisible(g.subtotals), dir, `${cellText} font-semibold`)}
          </td>
        </tr>
        {groupOpen && g.opps.map((o) => {
          const stage = stageByKey.get(o.cm.stage);
          const isCost = dir === 'out';
          const isActive = focus?.rowId === o.cm.id;
          const isSibling = focus != null && focus.section === dir && !isActive;
          const rowTotal = o.recurring
            ? sumVisible(o.recurring.amounts)
            : visIdx.reduce(
                (a, i) => a + o.cells[i].reduce((s, c) => s + c.line.amount_cents, 0),
                0,
              );
          return (
            <tr
              key={o.cm.id}
              className={`${ZEBRA} ${isActive ? ROW_ACTIVE : isSibling ? ROW_DIMMED : ''}`}
            >
              <td className={`${sticky} bg-white px-4 py-1.5 border-b border-line/40`}>
                {/* Item rows: indented behind a left guide border. */}
                <div className="ml-1 border-l border-line/60 pl-3">
                  <button
                    type="button"
                    onClick={() => onEdit(o.cm)}
                    className="flex w-full items-center gap-2 text-left"
                    title={o.cm.label}
                  >
                    <span
                      className={`truncate whitespace-nowrap ${labelText} text-ink hover:underline underline-offset-2`}
                    >
                      {o.cm.label}
                    </span>
                    {/* Stage + ↻ chips are pipeline info — income only. On
                        costs they always read "committed": noise (Sjoerd
                        2026-07-09). The rose −amounts stay the cost cue. */}
                    {!isCost && (
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium ${
                          KIND_STYLE[stage?.kind ?? ''] ?? UNKNOWN_STAGE_STYLE
                        }`}
                      >
                        {stage?.label ?? o.cm.stage}
                      </span>
                    )}
                    {!isCost && o.recurring && (
                      <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-600">
                        ↻ {o.recurring.cadence}
                      </span>
                    )}
                  </button>
                </div>
              </td>
              {visibleCols.map((col) => {
                // Recurring occurrences: non-draggable amounts (they're a
                // characteristic of the item, not payments to retime).
                if (o.recurring) {
                  const v = o.recurring.amounts[col.idx];
                  return (
                    <td
                      key={col.key}
                      {...dropProps(col)}
                      title="repeats — edit the item"
                      className={`${chipPad} py-1.5 text-right align-top border-b border-line/40 whitespace-nowrap ${hoverBg(col)}`}
                    >
                      {v === 0 ? (
                        <Faint />
                      ) : (
                        <span
                          onClick={() => onEdit(o.cm)}
                          className={`cursor-pointer ${cellText} font-medium tabular-nums ${AMT_TONE[dir]} hover:opacity-70`}
                        >
                          {sign(dir)}
                          {fmt(v)}
                        </span>
                      )}
                    </td>
                  );
                }
                // Non-recurring: every chip edits its own amount in place;
                // clicking the cell's empty space adds a NEW payment dated on
                // this period's start (a faint + shows on hover).
                return (
                  <OppLineCell
                    key={col.key}
                    colKey={col.key}
                    droppable={col.droppable}
                    cards={o.cells[col.idx]}
                    commitmentId={o.cm.id}
                    dir={dir}
                    fmt={fmt}
                    cellText={cellText}
                    chipPad={chipPad}
                    tdClass={`${chipPad} py-1.5 text-right align-top border-b border-line/40 whitespace-nowrap ${hoverBg(col)}`}
                    dropHandlers={dropProps(col)}
                    onError={setError}
                    onFocusChange={focusHandler(dir, o.cm.id)}
                  />
                );
              })}
              <td className={totalCell}>{renderAmt(rowTotal, dir, `${cellText} font-medium`)}</td>
            </tr>
          );
        })}
      </FragmentRows>
      );
    });
  }

  function budgetRows(rows: BudgetRow[], dir: Direction): React.ReactNode {
    if (rows.length === 0) return null;
    const dimmed = focus != null && focus.section === dir;
    return (
      <FragmentRows key="budget">
        <tr className={`${ZEBRA} ${dimmed ? ROW_DIMMED : ''}`}>
          <td className={`${sticky} bg-white px-4 py-1.5 border-b border-line`}>
            <span className={`block truncate whitespace-nowrap ${labelText} font-semibold text-ink`}>
              Recurring (budget)
            </span>
          </td>
          {visibleCols.map((col) => (
            <td
              key={col.key}
              className={`${numPad} py-1.5 text-right align-top tabular-nums whitespace-nowrap border-b border-line`}
            >
              {renderAmt(
                rows.reduce((a, r) => a + r.amounts[col.idx], 0),
                dir,
                `${cellText} font-medium`,
              )}
            </td>
          ))}
          <td className={totalCell}>
            {renderAmt(
              rows.reduce((a, r) => a + sumVisible(r.amounts), 0),
              dir,
              `${cellText} font-semibold`,
            )}
          </td>
        </tr>
        {rows.map((r) => (
          <tr key={r.bl.id} className={`${ZEBRA} ${dimmed ? ROW_DIMMED : ''}`}>
            <td className={`${sticky} bg-white px-4 py-1.5 border-b border-line/40`}>
              <div
                className="ml-1 border-l border-line/60 pl-3 flex items-center gap-2"
                title={`${r.bl.label}${r.bl.category ? ` · ${r.bl.category}` : ''} (${r.bl.cadence})`}
              >
                <span className={`truncate whitespace-nowrap ${labelText} text-ink`}>
                  {r.bl.label}
                </span>
                {/* The ↻ chip is income-only — on costs it's noise. */}
                {dir === 'in' && (
                  <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-600">
                    ↻ {r.bl.cadence}
                  </span>
                )}
                {r.bl.category && (
                  <span className="shrink-0 truncate text-[11px] text-ink-muted">
                    {r.bl.category}
                  </span>
                )}
              </div>
            </td>
            {visibleCols.map((col) => (
              <td key={col.key} className={numCell} title="recurring — edit in Budget">
                {renderAmt(r.amounts[col.idx], dir, cellText)}
              </td>
            ))}
            <td className={totalCell}>{renderAmt(sumVisible(r.amounts), dir, cellText)}</td>
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

      {/* View header: filter + fit toggle + scroll chevrons. */}
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
            aria-label={fit ? 'Switch back to the scrollable layout' : 'Fit the table to the screen'}
            title={fit ? 'Scrollable layout' : 'Fit to screen'}
            onClick={() => {
              const next = !fit;
              setFit(next);
              void savePref(COOKIE_CASHFLOW_FIT, next ? 'on' : 'off'); // remembered per user
            }}
            className={`h-8 w-8 inline-flex items-center justify-center rounded-md ring-1 ring-line ${
              fit ? 'bg-ink text-ink-inverse' : 'bg-white text-ink-subtle hover:text-ink'
            }`}
          >
            {fit ? (
              <Maximize2 size={16} strokeWidth={2} />
            ) : (
              <Minimize2 size={16} strokeWidth={2} />
            )}
          </button>
          {!fit && (
            <>
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
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
        <div ref={scrollRef} className="overflow-x-auto rounded-2xl">
          <table
            className={`${fit ? 'w-full table-fixed' : 'min-w-full'} border-separate border-spacing-0 text-sm`}
          >
            <thead>
              <tr>
                <th className={`${sticky} z-20 bg-white px-4 py-3 border-b border-line`} />
                {visibleCols.map((col) => (
                  <th
                    key={col.key}
                    className={`${fit ? numPad : 'min-w-[112px] px-3'} py-3 text-right ${cellText} font-semibold tracking-tight whitespace-nowrap border-b border-line ${
                      col.key === 'overdue' ? 'text-rose-600' : 'text-ink'
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
                {/* The workbook's rightmost sums (Sjoerd 2026-07-09: "at the
                    end of each row.. you see totals"). */}
                <th
                  className={`${fit ? numPad : 'min-w-[112px] px-3'} py-3 text-right ${cellText} font-semibold tracking-tight whitespace-nowrap border-b border-line border-l-2 border-l-line bg-yellow-50 text-ink`}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {/* 1 · BANK — the workbook's chain: the actual anchor now, then
                  every column = the END POSITION of the previous one.
                  Expands into one row per account; the CURRENT column edits
                  the balance inline; reserve accounts project forward. */}
              {projection &&
                sectionHeaderRow({
                  label: 'Bank',
                  valueFor: positionFor,
                  valueCls: (v) => (v != null && v < 0 ? 'text-red-600' : 'text-ink'),
                  total: null, // running balances don't sum
                  ...(orderedAccounts.length > 0
                    ? {
                        count: orderedAccounts.length,
                        open: positionExpanded,
                        onToggle: () => setPositionOpen((v) => !v),
                      }
                    : {}),
                })}
              {projection &&
                positionExpanded &&
                orderedAccounts.map((a) => {
                  const isActive = focus?.section === 'position' && focus.rowId === a.id;
                  const isSibling = focus?.section === 'position' && !isActive;
                  const projected = reserveProjections.get(a.id);
                  return (
                    <tr
                      key={a.id}
                      className={`${ZEBRA} ${isActive ? ROW_ACTIVE : isSibling ? ROW_DIMMED : ''}`}
                    >
                      <td className={`${sticky} bg-white px-4 py-1.5 border-b border-line/40`}>
                        <div
                          className="ml-1 border-l border-line/60 pl-3 flex items-center gap-2"
                          title={a.name}
                        >
                          <span className={`truncate whitespace-nowrap ${labelText} text-ink`}>
                            {a.name}
                          </span>
                          {a.kind === 'reserve' && (
                            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500">
                              reserve
                            </span>
                          )}
                        </div>
                      </td>
                      {visibleCols.map((col) => (
                        <td key={col.key} className={numCell}>
                          {col.key === currentColKey ? (
                            <BalanceCell
                              account={a}
                              fmt={fmt}
                              cellText={cellText}
                              onError={setError}
                              onFocusChange={focusHandler('position', a.id)}
                            />
                          ) : projected?.has(col.key) ? (
                            // Virtual growth: current actual + cumulative
                            // reservations targeting this account (greyed —
                            // a projection, not an actual).
                            <span
                              title="projected — actual + reservations to date"
                              className={`${cellText} tabular-nums text-ink-muted`}
                            >
                              {fmt(projected.get(col.key)!)}
                            </span>
                          ) : (
                            <Faint />
                          )}
                        </td>
                      ))}
                      <td className={totalCell}>
                        <Faint />
                      </td>
                    </tr>
                  );
                })}

              {/* No balances yet → the position is meaningless; say where to fix it. */}
              {projection &&
                projection.anchor.bank_cents === 0 &&
                projection.anchor.reserve_cents === 0 && (
                  <tr>
                    <td className={`${sticky} bg-white px-4 py-2 border-b border-line/40`}>
                      <a
                        href="/accounts"
                        className="text-xs text-ink-subtle underline underline-offset-2 hover:text-ink"
                      >
                        Fill in your bank balances →
                      </a>
                    </td>
                    <td
                      colSpan={visibleCols.length + 1}
                      className="border-b border-line/40 px-3 py-2 text-xs text-ink-muted"
                    >
                      Add your accounts and update balances — the Bank rows anchor on them.
                    </td>
                  </tr>
                )}

              {/* 2 · INCOME */}
              {sectionHeaderRow({
                label: 'Income',
                totals: incomeTotals,
                accent: 'in',
                count: incomeRowCount,
                open: incomeExpanded,
                onToggle: () => setIncomeOpen((v) => !v),
              })}
              {incomeExpanded && clientRows(shownIncomeGroups, 'in')}
              {incomeExpanded && budgetRows(shownIncomeBudget, 'in')}
              {incomeExpanded && (
                <AddRow sticky={sticky} span={visibleCols.length + 1}>
                  <button
                    type="button"
                    onClick={() => onAdd('in')}
                    className="text-xs font-medium text-ink-subtle hover:text-ink underline-offset-2 hover:underline"
                  >
                    + Income
                  </button>
                </AddRow>
              )}

              {/* 3 · COSTS */}
              {sectionHeaderRow({
                label: 'Costs',
                totals: costTotals,
                accent: 'out',
                count: costRowCount,
                open: costsExpanded,
                onToggle: () => setCostsOpen((v) => !v),
              })}
              {costsExpanded && clientRows(shownCostGroups, 'out')}
              {costsExpanded && budgetRows(shownCostBudget, 'out')}
              {costsExpanded && (
                <AddRow sticky={sticky} span={visibleCols.length + 1}>
                  <button
                    type="button"
                    onClick={() => onAdd('out')}
                    className="text-xs font-medium text-ink-subtle hover:text-ink underline-offset-2 hover:underline"
                  >
                    + Cost
                  </button>
                </AddRow>
              )}

              {/* 4 · RESERVATIONS — header total + one row per rule (Sjoerd:
                  "I have made two reservations, I should see both"). */}
              {projection && (
                <>
                  {sectionHeaderRow({
                    label: 'Reservations',
                    valueFor: reservedFor,
                    total: visibleCols.reduce((a, c) => a + (reservedFor(c) ?? 0), 0),
                    count: projection.reservation_rules?.length ?? undefined,
                    open: reservationsExpanded,
                    onToggle: () => setReservesOpen((v) => !v),
                  })}
                  {reservationsExpanded &&
                    (projection.reservation_rules ?? []).map((rule) => {
                      const pct = Number(rule.percentage);
                      const ruleAmount = (col: Col): number => {
                        if (!col.droppable) return 0;
                        const income = projByStart.get(col.key)?.expected_in ?? 0;
                        return Math.round((income * pct) / 100);
                      };
                      const full = `${rule.label} (${pct}%)`;
                      return (
                        <tr key={rule.id}>
                          <td className={`${sticky} bg-white px-4 py-1.5 border-b border-line/40`}>
                            {/* One line always: label truncates, the pct
                                never wraps away; the full text rides the
                                tooltip (Sjoerd 2026-07-09). */}
                            <div
                              className="ml-5 flex min-w-0 items-baseline gap-1 border-l border-line/60 pl-2"
                              title={full}
                            >
                              <span className="min-w-0 truncate whitespace-nowrap text-xs text-ink-subtle">
                                {rule.label}
                              </span>
                              <span className="shrink-0 text-xs text-ink-muted">({pct}%)</span>
                            </div>
                          </td>
                          {visibleCols.map((col) => (
                            <td key={col.key} className={numCell}>
                              {renderMoney(ruleAmount(col) || null, `${cellText} text-ink-muted`)}
                            </td>
                          ))}
                          <td className={totalCell}>
                            {renderMoney(
                              visibleCols.reduce((a, c) => a + ruleAmount(c), 0) || null,
                              `${cellText} text-ink-muted`,
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </>
              )}

              {/* 5 · END POSITION — the sheet's red row. */}
              {projection && (
                <tr>
                  <td className={`${sticky} bg-yellow-100/70 px-4 py-2.5`}>
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
                        className={`${numPad} py-2.5 text-right align-middle tabular-nums whitespace-nowrap ${cellText} font-bold ${
                          negative ? 'bg-red-50 text-red-600' : 'bg-yellow-100/70 text-ink'
                        }`}
                      >
                        {v == null ? <Faint /> : fmt(Math.round(v))}
                      </td>
                    );
                  })}
                  {/* Running balance — doesn't sum. */}
                  <td
                    className={`${numPad} py-2.5 text-right align-middle whitespace-nowrap border-l-2 border-l-line bg-yellow-100/70 ${cellText} font-bold`}
                  >
                    <Faint />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Inline-editable account balance for the CURRENT period column. Click →
// euro input (comma decimals); Enter/blur records an append-only snapshot
// dated today via the Accounts action; Escape cancels.
function BalanceCell({
  account,
  fmt,
  cellText,
  onError,
  onFocusChange,
}: {
  account: PulseAccount;
  fmt: (cents: number) => string;
  cellText: string;
  onError: (msg: string) => void;
  onFocusChange?: (active: boolean) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const cancelledRef = useRef(false);

  const current = account.latest_snapshot?.balance_cents ?? null;

  function begin() {
    cancelledRef.current = false;
    setValue(current != null ? (current / 100).toFixed(2).replace('.', ',') : '');
    setEditing(true);
    onFocusChange?.(true);
  }

  async function commit() {
    setEditing(false);
    onFocusChange?.(false);
    if (cancelledRef.current) return;
    const cents = parseEuro(value);
    if (cents == null || cents === current) return;
    setSaving(true);
    const res = await recordSnapshots(todayLocalIso(), [
      { account_id: account.id, name: account.name, balance_cents: cents },
    ]);
    setSaving(false);
    if (res.error) {
      onError(`Could not update the balance — ${res.error}`);
      return;
    }
    router.refresh();
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            cancelledRef.current = true;
            e.currentTarget.blur();
          }
        }}
        inputMode="decimal"
        aria-label={`Balance for ${account.name}`}
        className={`w-24 rounded border border-line bg-white px-1.5 py-0.5 text-right ${cellText} tabular-nums focus:outline-none focus:ring-2 focus:ring-neutral-300`}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={begin}
      disabled={saving}
      title={
        account.latest_snapshot
          ? `as of ${account.latest_snapshot.as_of_date} — click to update`
          : "Click to set today's balance"
      }
      className={`${cellText} font-medium tabular-nums underline-offset-2 hover:underline ${
        saving ? 'text-ink-muted' : current != null ? 'text-ink' : 'text-ink-subtle'
      }`}
    >
      {saving ? 'Saving…' : current != null ? fmt(current) : 'Set balance'}
    </button>
  );
}

// Shared inline euro input for the grid cells — the same mechanics as the
// account-balance editor: comma decimals, Enter/blur commits, Escape cancels.
function EuroCellInput({
  initial,
  cellText,
  ariaLabel,
  onCommit,
}: {
  initial: string;
  cellText: string;
  ariaLabel: string;
  onCommit: (cents: number | null) => void; // null = cancelled / unparseable
}) {
  const [value, setValue] = useState(initial);
  const cancelledRef = useRef(false);
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => onCommit(cancelledRef.current ? null : parseEuro(value))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          cancelledRef.current = true;
          e.currentTarget.blur();
        }
      }}
      inputMode="decimal"
      aria-label={ariaLabel}
      className={`w-20 rounded border border-line bg-white px-1.5 py-0.5 text-right ${cellText} tabular-nums focus:outline-none focus:ring-2 focus:ring-neutral-300`}
    />
  );
}

// One expected-payment pill. Dragging retimes it (unchanged); a click
// WITHOUT a drag swaps the pill for the inline euro input and saves via
// updateLineAmount. Errors surface in the grid banner.
function AmountChip({
  card,
  dir,
  fmt,
  cellText,
  chipPad,
  onError,
  onFocusChange,
}: {
  card: Card;
  dir: Direction;
  fmt: (cents: number) => string;
  cellText: string;
  chipPad: string;
  onError: (msg: string) => void;
  onFocusChange?: (active: boolean) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  // A completed drag must not open the editor — dragstart arms this, and it
  // disarms on the tick after dragend (any post-drag click slips by first).
  const draggedRef = useRef(false);

  async function commit(cents: number | null) {
    setEditing(false);
    onFocusChange?.(false);
    if (cents == null || cents === card.line.amount_cents) return;
    setSaving(true);
    const res = await updateLineAmount(card.line.id, cents);
    setSaving(false);
    if (res.error) {
      onError(`Could not update the amount: ${res.error}`);
      return;
    }
    router.refresh();
  }

  if (editing) {
    return (
      <EuroCellInput
        initial={(card.line.amount_cents / 100).toFixed(2).replace('.', ',')}
        cellText={cellText}
        ariaLabel={`Amount for ${card.cm.label}`}
        onCommit={(cents) => void commit(cents)}
      />
    );
  }
  return (
    <span
      draggable={!saving}
      onDragStart={(e) => {
        draggedRef.current = true;
        e.dataTransfer.setData('text/plain', card.line.id);
        e.dataTransfer.effectAllowed = 'copyMove';
      }}
      onDragEnd={() => {
        setTimeout(() => {
          draggedRef.current = false;
        }, 0);
      }}
      onClick={(e) => {
        e.stopPropagation(); // the cell's empty-space click ADDS a line
        if (draggedRef.current || saving) return;
        setEditing(true);
        onFocusChange?.(true);
      }}
      title={`${card.cm.label} — expected ${card.date}. Click to edit the amount; drag to another period to retime.`}
      className={`inline-flex items-center gap-1 cursor-grab active:cursor-grabbing rounded-full ring-1 hover:shadow ${PILL_TONE[dir]} ${chipPad} py-0.5 ${cellText} font-medium tabular-nums`}
    >
      {saving ? (
        'Saving…'
      ) : (
        <>
          {sign(dir)}
          {fmt(card.line.amount_cents)}
        </>
      )}
      {card.line.invoiced_at && <FileText size={10} strokeWidth={2} className="text-sky-600" />}
    </span>
  );
}

// A period cell on a one-off opportunity row. Chips edit themselves
// individually; a click on the empty space (or the faint hover "+") opens
// the same inline input to ADD a payment dated on this period's start —
// colKey IS that ISO date for droppable columns.
function OppLineCell({
  colKey,
  droppable,
  cards,
  commitmentId,
  dir,
  fmt,
  cellText,
  chipPad,
  tdClass,
  dropHandlers,
  onError,
  onFocusChange,
}: {
  colKey: string;
  droppable: boolean;
  cards: Card[];
  commitmentId: string;
  dir: Direction;
  fmt: (cents: number) => string;
  cellText: string;
  chipPad: string;
  tdClass: string;
  dropHandlers: DropHandlers;
  onError: (msg: string) => void;
  onFocusChange?: (active: boolean) => void;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  async function commitAdd(cents: number | null) {
    setAdding(false);
    onFocusChange?.(false);
    if (cents == null || cents === 0) return;
    setSaving(true);
    const res = await addLine(commitmentId, colKey, cents);
    setSaving(false);
    if (res.error) {
      onError(`Could not add the expected payment: ${res.error}`);
      return;
    }
    router.refresh();
  }

  // Only real period columns can take a new dated line — Overdue/Later have
  // no single start date.
  const canAdd = droppable && !adding && !saving;

  return (
    <td
      {...dropHandlers}
      onClick={
        canAdd
          ? () => {
              setAdding(true);
              onFocusChange?.(true);
            }
          : undefined
      }
      title={droppable ? 'Click empty space to add a payment here' : undefined}
      className={`group ${tdClass} ${canAdd ? 'cursor-pointer' : ''}`}
    >
      {cards.length === 0 && !adding && !saving ? (
        droppable ? (
          <>
            <span className="group-hover:hidden">
              <Faint />
            </span>
            <span
              aria-hidden
              className={`hidden group-hover:inline ${cellText} font-medium text-ink-muted/60 select-none`}
            >
              +
            </span>
          </>
        ) : (
          <Faint />
        )
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-1">
          {cards.map((card) => (
            <AmountChip
              key={card.line.id}
              card={card}
              dir={dir}
              fmt={fmt}
              cellText={cellText}
              chipPad={chipPad}
              onError={onError}
              onFocusChange={onFocusChange}
            />
          ))}
          {adding && (
            <EuroCellInput
              initial=""
              cellText={cellText}
              ariaLabel="New payment amount"
              onCommit={(cents) => void commitAdd(cents)}
            />
          )}
          {saving && <span className={`${cellText} text-ink-muted`}>Saving…</span>}
          {!adding && !saving && droppable && cards.length > 0 && (
            <span
              aria-hidden
              className={`${cellText} font-medium text-ink-muted/60 select-none opacity-0 group-hover:opacity-100`}
            >
              +
            </span>
          )}
        </div>
      )}
    </td>
  );
}

// "+" row at the bottom of an expanded section — one dialog for everything;
// recurring is just a characteristic set inside it (Repeats select).
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
// the requested grid so every row stays aligned. Other params (the
// Me/Team/Workspace scope) are preserved.
function ShowSwitcher({ current }: { current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (
    <select
      value={current}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('show', e.target.value);
        router.push(`/cashflow?${params.toString()}`);
      }}
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
