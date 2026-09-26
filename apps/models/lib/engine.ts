// The business model engine. Pure: a definition plus a state of numbers in,
// a month by month projection with break even and funding figures out. The
// same arithmetic as solidarity-lab/business-models shared/engine.js; this is
// its typed port. No React, no fetch — unit testable in node.

export type NumberInput = { id: string; label: string; unit?: string; value: number; step?: number };
export type CostKind = 'perUnit' | 'perNewUnit' | 'perBatch' | 'percentRevenue' | 'fixed' | 'formula';
export type CostLine = NumberInput & { kind: CostKind; batchSize?: string | number; formula?: string };
export type Volume = {
  start?: string | number;
  growth?: string | number;
  churn?: string | number;
  add?: string | number;
  cap?: string | number;
  startMonth?: string | number;
  linkedTo?: string;
  factor?: string | number;
};
/** When a stream bills: every `every` months, first in month `month` (default
 *  1), the amount for the whole period lands in that month (an annual fee
 *  billed in January); the months between show nothing. Absent: monthly. */
export type Billing = { every: number; month?: number };
export type Generator = {
  id: string;
  name: string;
  short?: string;
  help?: string;
  icon?: string;
  segment?: string;
  countsAsUnit?: boolean;
  inputs?: NumberInput[];
  volume?: Volume;
  revenuePerUnit?: string | number;
  revenueTotal?: string | number;
  costs?: CostLine[];
  billing?: Billing;
};
/** A band table: a stepped price, a volume discount, a licence on turnover,
 *  a tax bracket. Bands are read in ascending order of upTo; the last one has
 *  upTo null (no upper limit). A value exactly on an edge belongs to the
 *  lower band. `step`: the whole amount is the value of the band the number
 *  falls in. `marginal`: each part of the number carries the rate (%) of its
 *  own band, like income tax, optionally capped. Formulas read a table with
 *  lookup(<table id>, <expression>). */
export type Band = { upTo: number | null; value?: number; rate?: number };
export type BandTable = { id: string; label: string; unit?: string; help?: string; mode: 'step' | 'marginal'; cap?: number | null; bands: Band[] };
/** The part of a table the team may edit and a scenario may keep. */
export type TableNumbers = { bands: Band[]; cap?: number | null };
/** A canvas statement. Strings are accepted from older definitions; the app
 *  writes objects with an id, so a statement can be edited and linked to the
 *  turnover and cost items it belongs to (link ids: see lib/links.ts). */
export type CanvasItem = string | { id?: string; text: string; segments?: string[]; links?: string[] };
export type CanvasBlockKey = 'keyPartners' | 'keyActivities' | 'keyResources' | 'valuePropositions' | 'customerRelationships' | 'channels';
export const CANVAS_BLOCK_KEYS: CanvasBlockKey[] = ['keyPartners', 'keyActivities', 'keyResources', 'valuePropositions', 'customerRelationships', 'channels'];
export const itemText = (it: CanvasItem): string => (typeof it === 'string' ? it : it.text);
export const itemObj = (it: CanvasItem): { id?: string; text: string; segments?: string[]; links?: string[] } => (typeof it === 'string' ? { text: it } : it);
/** A fixed cost per month. It may step: `steps` replaces the value from a
 *  month on (a second facilitator from month 13); `per` multiplies it by
 *  ceil(units ÷ every) of a segment or of all units (one facilitator per 40
 *  Forge members). Both may combine. */
export type FixedCost = NumberInput & {
  startMonth?: number;
  steps?: { fromMonth: number; value: number }[];
  per?: { of: string | 'units'; every: number };
};
/** A funnel step: each month, `rate`% of the people in `from` go to `to`.
 *  `move` (default true) takes them out of `from`; false counts them in both. */
export type Transition = { id: string; from: string; to: string; rate: number; move?: boolean; label?: string };
export type ModelDefinition = {
  id?: string;
  name: string;
  tagline?: string;
  description?: string;
  currency?: string;
  currencySymbol?: string;
  horizon?: number;
  breakEvenMonth?: number;
  unitLabel?: string;
  canvas?: Partial<Record<CanvasBlockKey, CanvasItem[]>>;
  settings?: NumberInput[];
  genericVariable?: { id: string; label: string; kind: 'percentRevenue' | 'perUnit' | 'perNewUnit'; value?: number }[];
  generators: Generator[];
  transitions?: Transition[];
  fixedCosts?: FixedCost[];
  investment?: NumberInput[];
  tables?: BandTable[];
};

export type ModelState = {
  settings: Record<string, number>;
  generators: Record<string, Record<string, number>>;
  fixed: Record<string, number>;
  investment: Record<string, number>;
  /** Transition rates, % per month, by transition id. */
  transitions: Record<string, number>;
  /** New clients per month typed by hand, by segment id then month: they
   *  replace that month's growth (churn still applies). Months between two
   *  typed months are interpolated; before the first and after the last the
   *  formula rules. Month 1 sets the starting number. */
  periods: Record<string, Record<string, number>>;
  /** Transition rates per month typed by hand, by transition id then month. */
  periodRates: Record<string, Record<string, number>>;
  /** The bands of every band table, editable like settings, kept per scenario. */
  tables: Record<string, TableNumbers>;
};

type LookupFn = (id: string, x: number) => number;
type Scope = Record<string, number | LookupFn>;

// ---------- band tables ----------
const bandOrder = (bands: Band[]) => [...bands].sort((a, b) => (a.upTo == null ? 1 : b.upTo == null ? -1 : a.upTo - b.upTo));
/** What a table gives for a number: zero at or below zero; step mode takes
 *  the band the number falls in, marginal mode sums part × rate per band. */
export function lookupTable(table: Pick<BandTable, 'mode' | 'cap'> & TableNumbers, x: number): number {
  if (!(x > 0)) return 0;
  const bands = bandOrder(table.bands ?? []);
  if (!bands.length) return 0;
  let out = 0;
  if (table.mode === 'marginal') {
    let lower = 0;
    for (const b of bands) {
      const top = b.upTo == null ? Infinity : b.upTo;
      const part = Math.min(x, top) - lower;
      if (part > 0) out += (part * (b.rate ?? 0)) / 100;
      if (x <= top) break;
      lower = top;
    }
  } else {
    const hit = bands.find((b) => b.upTo == null || x <= b.upTo) ?? bands[bands.length - 1]!;
    out = hit.value ?? 0;
  }
  if (table.cap != null && Number.isFinite(table.cap)) out = Math.min(out, table.cap);
  return out;
}
/** The lookup a formula calls, over the tables as the state has them. */
export function makeLookup(model: ModelDefinition, state: ModelState): LookupFn {
  const byId = new Map((model.tables ?? []).map((tb) => [tb.id, tb]));
  return (id, x) => {
    const tb = byId.get(String(id));
    if (!tb) return 0;
    const nums = state.tables?.[tb.id];
    return lookupTable({ mode: tb.mode, cap: nums?.cap !== undefined ? nums.cap : tb.cap, bands: nums?.bands ?? tb.bands }, Number(x) || 0);
  };
}
/** The table ids a formula reads through lookup(). */
export const tableRefs = (expr: string | number | undefined | null): string[] =>
  expr == null ? [] : Array.from(new Set(Array.from(String(expr).matchAll(/lookup\(\s*([A-Za-z_]\w*)/g), (m) => m[1]!)));

// ---------- formulas ----------
// Small arithmetic strings over named inputs ("vol * take / 100"). The proxy
// claims every name, so a formula sees only its scope: globals are unreachable.
const fnCache = new Map<string, (s: Scope) => number>();
export function compile(expr: string | number): (s: Scope) => number {
  if (typeof expr === 'number') return () => expr;
  const key = String(expr);
  const cached = fnCache.get(key);
  if (cached) return cached;
  if (!/^[\w\s+\-*/().,<>=?:!&|]*$/.test(key)) throw new Error('Bad formula: ' + key);
  // lookup(lictable, x): the table id is a name in the text, a string to the
  // function — rewritten after the character check, which admits no quotes.
  const src = key.replace(/lookup\(\s*([A-Za-z_]\w*)\s*,/g, 'lookup("$1",');
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const f = new Function('s', 'with (s) { return (' + src + '); }') as (s: unknown) => unknown;
  const wrapped = (scope: Scope) => {
    let v: unknown = 0;
    try {
      v = f(
        new Proxy(scope, {
          has: () => true,
          get: (t, k) => (typeof k === 'string' && k in t ? t[k] : k === Symbol.unscopables ? undefined : 0),
        }),
      );
    } catch {
      v = 0;
    }
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  };
  fnCache.set(key, wrapped);
  return wrapped;
}
export const evalExpr = (expr: string | number | undefined | null, scope: Scope): number =>
  expr == null ? 0 : compile(expr)(scope);

// ---------- state ----------
export function defaultState(model: ModelDefinition): ModelState {
  const st: ModelState = { settings: {}, generators: {}, fixed: {}, investment: {}, transitions: {}, periods: {}, periodRates: {}, tables: {} };
  (model.settings ?? []).forEach((s) => { st.settings[s.id] = s.value; });
  model.generators.forEach((g) => {
    const gs: Record<string, number> = {};
    (g.inputs ?? []).forEach((i) => { gs[i.id] = i.value; });
    (g.costs ?? []).forEach((c) => { gs[c.id] = c.value; });
    st.generators[g.id] = gs;
  });
  (model.fixedCosts ?? []).forEach((f) => { st.fixed[f.id] = f.value; });
  (model.investment ?? []).forEach((i) => { st.investment[i.id] = i.value; });
  (model.transitions ?? []).forEach((tr) => { st.transitions[tr.id] = tr.rate; });
  (model.tables ?? []).forEach((tb) => { st.tables[tb.id] = { bands: (tb.bands ?? []).map((b) => ({ ...b })), ...(tb.cap != null ? { cap: tb.cap } : {}) }; });
  return st;
}

/** A saved table's numbers, if they have the shape; null otherwise. */
export function cleanTable(v: unknown): TableNumbers | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as { bands?: unknown; cap?: unknown };
  if (!Array.isArray(o.bands)) return null;
  const bands: Band[] = [];
  for (const b of o.bands) {
    if (!b || typeof b !== 'object') return null;
    const { upTo, value, rate } = b as { upTo?: unknown; value?: unknown; rate?: unknown };
    if (!(upTo === null || (typeof upTo === 'number' && Number.isFinite(upTo)))) return null;
    const band: Band = { upTo: upTo as number | null };
    if (typeof value === 'number' && Number.isFinite(value)) band.value = value;
    if (typeof rate === 'number' && Number.isFinite(rate)) band.rate = rate;
    bands.push(band);
  }
  const out: TableNumbers = { bands };
  if (o.cap === null || (typeof o.cap === 'number' && Number.isFinite(o.cap))) out.cap = o.cap as number | null;
  return out;
}

/** Saved numbers over the defaults; only keys the definition knows, only numbers. */
export function mergeState(base: ModelState, saved: unknown): ModelState {
  if (!saved || typeof saved !== 'object') return base;
  const sv = saved as Record<string, Record<string, unknown>>;
  const out: ModelState = { ...JSON.parse(JSON.stringify(base)), transitions: { ...(base.transitions ?? {}) }, periods: {}, periodRates: {}, tables: JSON.parse(JSON.stringify(base.tables ?? {})) };
  const tables = sv.tables as Record<string, unknown> | undefined;
  if (tables && typeof tables === 'object') Object.keys(out.tables).forEach((id) => { const tb = cleanTable(tables[id]); if (tb) out.tables[id] = tb; });
  (['periods', 'periodRates'] as const).forEach((k) => {
    const src = sv[k] as Record<string, Record<string, unknown>> | undefined;
    if (!src || typeof src !== 'object') return;
    Object.entries(src).forEach(([id, months]) => {
      if (!months || typeof months !== 'object') return;
      const clean: Record<string, number> = {};
      Object.entries(months).forEach(([mo, v]) => { if (/^\d+$/.test(mo) && typeof v === 'number' && Number.isFinite(v)) clean[mo] = v; });
      if (Object.keys(clean).length) out[k][id] = clean;
    });
  });
  (['settings', 'fixed', 'investment', 'transitions'] as const).forEach((k) => {
    const src = sv[k];
    if (!src || typeof src !== 'object') return;
    Object.keys(out[k]).forEach((id) => { const v = src[id]; if (typeof v === 'number' && Number.isFinite(v)) out[k][id] = v; });
  });
  const gens = sv.generators as Record<string, Record<string, unknown>> | undefined;
  if (gens && typeof gens === 'object') {
    Object.keys(out.generators).forEach((gid) => {
      const sg = gens[gid];
      const target = out.generators[gid];
      if (!sg || typeof sg !== 'object' || !target) return;
      Object.keys(target).forEach((id) => { const v = sg[id]; if (typeof v === 'number' && Number.isFinite(v)) target[id] = v; });
    });
  }
  return out;
}

// ---------- projection ----------
export type GenMonth = { units: number; newUnits: number; revenue: number; cost: number; costLines: Record<string, number>; generic?: boolean; /** Moved in from other segments this month. */ inflow: number; /** Moved out to other segments this month. */ outflow: number };
export type MonthRow = {
  m: number;
  gens: Record<string, GenMonth>;
  revenue: number;
  variableCost: number;
  fixedCost: number;
  totalCost: number;
  units: number;
  newUnits: number;
  net: number;
  cumulative: number;
  cash: number;
};

/** A fixed cost line in month m: the base value, replaced by the latest step
 *  reached, multiplied by ceil(units ÷ every) when it grows with a segment. */
export function fixedAmount(f: FixedCost, base: number, m: number, totalUnits: number, units: Record<string, number>): number {
  let value = base;
  (f.steps ?? []).filter((st) => st.fromMonth <= m).sort((a, b) => a.fromMonth - b.fromMonth).forEach((st) => { value = st.value; });
  if (f.per && f.per.every > 0) {
    const n = f.per.of === 'units' ? totalUnits : (units[f.per.of] ?? 0);
    value = value * Math.ceil(Math.max(n, 0) / f.per.every);
  }
  return value;
}

/** The new clients typed for a month: the cell itself, or a straight line
 *  between the nearest typed months on either side; null when the formula rules. */
export function typedForMonth(cells: Record<string, number> | undefined, m: number): number | null {
  if (!cells) return null;
  const direct = cells[String(m)];
  if (typeof direct === 'number') return direct;
  const months = Object.keys(cells).map(Number).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const before = months.filter((x) => x < m).pop();
  const after = months.find((x) => x > m);
  if (before == null || after == null) return null;
  const a = cells[String(before)]!, b = cells[String(after)]!;
  return a + ((b - a) * (m - before)) / (after - before);
}

/** Whether month m is a billing month: the first one, then every `every`. */
export const billsIn = (m: number, every: number, first: number): boolean => m >= first && (m - first) % every === 0;

function topoOrder(gens: Generator[]): Generator[] {
  const byId = new Map(gens.map((g) => [g.id, g]));
  const out: Generator[] = [];
  const seen = new Set<string>();
  const visit = (g: Generator) => {
    if (seen.has(g.id)) return;
    seen.add(g.id);
    const dep = g.volume?.linkedTo ? byId.get(g.volume.linkedTo) : undefined;
    if (dep) visit(dep);
    out.push(g);
  };
  gens.forEach(visit);
  return out;
}

export function project(model: ModelDefinition, state: ModelState, horizon?: number) {
  const H = horizon ?? model.horizon ?? 36;
  const gens = model.generators;
  const ordered = topoOrder(gens);
  const lookup = makeLookup(model, state);
  const months: MonthRow[] = [];
  const unitsPrev: Record<string, number> = {};
  let cumulative = 0;
  const investmentTotal = Object.values(state.investment).reduce((a, b) => a + b, 0);
  let cash = -investmentTotal;
  let minCash = cash;
  let minCashMonth = 0;

  for (let m = 1; m <= H; m++) {
    const row: MonthRow = { m, gens: {}, revenue: 0, variableCost: 0, fixedCost: 0, units: 0, newUnits: 0, net: 0, cumulative: 0, cash: 0, totalCost: 0 };
    const unitsNow: Record<string, number> = {};
    const inflow: Record<string, number> = {};
    const outflow: Record<string, number> = {};
    // Phase one: every segment's own volume, before anyone reads it.
    ordered.forEach((g) => {
      const v = g.volume ?? {};
      if (v.linkedTo) return;
      const inp = state.generators[g.id] ?? {};
      const scope: Scope = { ...state.settings, ...inp, month: m, lookup };
      const startMonth = v.startMonth != null ? evalExpr(v.startMonth, scope) : 1;
      let units = 0;
      if (m >= startMonth) {
        const prev = unitsPrev[g.id];
        const typed = typedForMonth(state.periods[g.id], m);
        if (prev == null || m === startMonth) units = typed ?? evalExpr(v.start, scope);
        else {
          const churn = evalExpr(v.churn ?? 0, scope) / 100;
          if (typed != null) units = prev * (1 - churn) + typed;
          else {
            const growth = evalExpr(v.growth ?? 0, scope) / 100;
            const add = evalExpr(v.add ?? 0, scope);
            units = prev * (1 + growth - churn) + add;
          }
        }
        if (v.cap != null) units = Math.min(units, evalExpr(v.cap, scope));
      }
      unitsNow[g.id] = units;
    });
    // Phase two: the funnel. A share of last month's people in `from` go to
    // `to`; by default they leave `from` (move), or they count in both.
    (model.transitions ?? []).forEach((tr) => {
      if (m === 1 || !(tr.from in unitsNow) || !(tr.to in unitsNow)) return;
      const rate = (typedForMonth(state.periodRates[tr.id], m) ?? state.transitions[tr.id] ?? tr.rate) / 100;
      const moved = Math.max((unitsPrev[tr.from] ?? 0) * rate, 0);
      if (!moved) return;
      unitsNow[tr.to] = (unitsNow[tr.to] ?? 0) + moved;
      inflow[tr.to] = (inflow[tr.to] ?? 0) + moved;
      if (tr.move !== false) { unitsNow[tr.from] = Math.max((unitsNow[tr.from] ?? 0) - moved, 0); outflow[tr.from] = (outflow[tr.from] ?? 0) + moved; }
    });
    // Phase three: linked streams, revenue and costs.
    ordered.forEach((g) => {
      const inp = state.generators[g.id] ?? {};
      const scope: Scope = { ...state.settings, ...inp, month: m, lookup };
      const v = g.volume ?? {};
      const units = v.linkedTo ? (unitsNow[v.linkedTo] ?? 0) * evalExpr(v.factor == null ? 1 : v.factor, scope) : (unitsNow[g.id] ?? 0);
      const newUnits = Math.max(units - (unitsPrev[g.id] ?? 0), 0);
      unitsNow[g.id] = units;
      scope.units = units;
      scope.newUnits = newUnits;
      const monthly = g.revenueTotal != null ? (units > 0 ? evalExpr(g.revenueTotal, scope) : 0) : units * evalExpr(g.revenuePerUnit ?? 0, scope);
      // A billing moment: the whole period's amount lands in the billing
      // month, on that month's units; the months between show nothing.
      const every = g.billing && g.billing.every > 1 ? Math.round(g.billing.every) : 1;
      const revenue = every > 1 ? (billsIn(m, every, g.billing?.month ?? 1) ? monthly * every : 0) : monthly;
      scope.revenue = revenue;
      let cost = 0;
      const costLines: Record<string, number> = {};
      (g.costs ?? []).forEach((c) => {
        const value = inp[c.id] != null ? inp[c.id]! : evalExpr(c.value, scope);
        let amount = 0;
        switch (c.kind) {
          case 'perUnit': amount = units * value; break;
          case 'perNewUnit': amount = newUnits * value; break;
          case 'perBatch': {
            const size = Math.max(evalExpr(c.batchSize ?? 1, scope), 1e-9);
            const batches = units > 0 ? Math.ceil(units / size) : 0;
            scope.batches = batches;
            amount = batches * value;
            break;
          }
          case 'percentRevenue': amount = (revenue * value) / 100; break;
          case 'fixed': amount = units > 0 ? value : 0; break;
          case 'formula': amount = evalExpr(c.formula, scope); break;
        }
        costLines[c.id] = amount;
        cost += amount;
      });
      row.gens[g.id] = { units, newUnits, revenue, cost, costLines, inflow: inflow[g.id] ?? 0, outflow: outflow[g.id] ?? 0 };
      row.revenue += revenue;
      row.variableCost += cost;
      if (g.countsAsUnit !== false && !v.linkedTo) { row.units += units; row.newUnits += newUnits; }
    });
    Object.assign(unitsPrev, unitsNow);

    (model.genericVariable ?? []).forEach((c) => {
      const value = state.settings[c.id] ?? c.value ?? 0;
      const amount = c.kind === 'percentRevenue' ? (row.revenue * value) / 100 : c.kind === 'perUnit' ? row.units * value : row.newUnits * value;
      row.gens[c.id] = { units: 0, newUnits: 0, revenue: 0, cost: amount, costLines: {}, generic: true, inflow: 0, outflow: 0 };
      row.variableCost += amount;
    });
    (model.fixedCosts ?? []).forEach((f) => { if (m >= (f.startMonth ?? 1)) row.fixedCost += fixedAmount(f, state.fixed[f.id] ?? 0, m, row.units, unitsNow); });
    row.totalCost = row.variableCost + row.fixedCost;
    row.net = row.revenue - row.totalCost;
    cumulative += row.net;
    row.cumulative = cumulative;
    cash += row.net;
    row.cash = cash;
    if (cash < minCash) { minCash = cash; minCashMonth = m; }
    months.push(row);
  }
  return { months, investmentTotal, minCash, minCashMonth };
}

export type YearRow = { year: number; months: number; revenue: number; variableCost: number; fixedCost: number; totalCost: number; net: number; cash: number; units: number };
export type Summary = ReturnType<typeof summarize>;

export function summarize(model: ModelDefinition, state: ModelState, opts?: { horizon?: number; refMonth?: number }) {
  const p = project(model, state, opts?.horizon);
  const months = p.months;
  const refIdx = Math.min(opts?.refMonth ?? model.breakEvenMonth ?? 12, months.length) - 1;
  const ref = months[refIdx]!;
  const arpu = ref.units > 0 ? ref.revenue / ref.units : 0;
  const varPerUnit = ref.units > 0 ? ref.variableCost / ref.units : 0;
  const contribution = arpu - varPerUnit;
  const breakEvenUnits = contribution > 0 ? ref.fixedCost / contribution : null;
  const breakEvenMonthRow = months.find((r) => r.net >= 0);
  const cashPositiveRow = months.find((r) => r.cash >= 0);
  const last = months[months.length - 1]!;
  const years: YearRow[] = [];
  for (let y = 0; y * 12 < months.length; y++) {
    const slice = months.slice(y * 12, y * 12 + 12);
    const sum = (k: 'revenue' | 'variableCost' | 'fixedCost' | 'totalCost' | 'net') => slice.reduce((a, r) => a + r[k], 0);
    const end = slice[slice.length - 1]!;
    years.push({ year: y + 1, months: slice.length, revenue: sum('revenue'), variableCost: sum('variableCost'), fixedCost: sum('fixedCost'), totalCost: sum('totalCost'), net: sum('net'), cash: end.cash, units: end.units });
  }
  const breakEvenYear = years.find((y) => y.net >= 0)?.year ?? null;
  const maxU = Math.max(ref.units * 1.6, (breakEvenUnits ?? 0) * 1.3, 10);
  const curve = Array.from({ length: 41 }, (_, i) => {
    const u = (maxU * i) / 40;
    return { units: u, revenue: u * arpu, cost: ref.fixedCost + u * varPerUnit };
  });
  return {
    months, years, ref, refMonth: refIdx + 1, horizon: months.length, arpu, varPerUnit, contribution, breakEvenUnits,
    breakEvenMonth: breakEvenMonthRow?.m ?? null, breakEvenYear, cashPositiveMonth: cashPositiveRow?.m ?? null,
    fundingNeed: Math.max(-p.minCash, 0), investmentTotal: p.investmentTotal, minCash: p.minCash, minCashMonth: p.minCashMonth,
    fixedMonthly: ref.fixedCost, last, curve,
  };
}
