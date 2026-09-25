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
};
export type CanvasItem = string | { text: string; segments?: string[] };
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
  canvas?: Partial<Record<'keyPartners' | 'keyActivities' | 'keyResources' | 'valuePropositions' | 'customerRelationships' | 'channels', CanvasItem[]>>;
  settings?: NumberInput[];
  genericVariable?: { id: string; label: string; kind: 'percentRevenue' | 'perUnit' | 'perNewUnit'; value?: number }[];
  generators: Generator[];
  fixedCosts?: (NumberInput & { startMonth?: number })[];
  investment?: NumberInput[];
};

export type ModelState = {
  settings: Record<string, number>;
  generators: Record<string, Record<string, number>>;
  fixed: Record<string, number>;
  investment: Record<string, number>;
};

type Scope = Record<string, number>;

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
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const f = new Function('s', 'with (s) { return (' + key + '); }') as (s: unknown) => unknown;
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
  const st: ModelState = { settings: {}, generators: {}, fixed: {}, investment: {} };
  (model.settings ?? []).forEach((s) => { st.settings[s.id] = s.value; });
  model.generators.forEach((g) => {
    const gs: Record<string, number> = {};
    (g.inputs ?? []).forEach((i) => { gs[i.id] = i.value; });
    (g.costs ?? []).forEach((c) => { gs[c.id] = c.value; });
    st.generators[g.id] = gs;
  });
  (model.fixedCosts ?? []).forEach((f) => { st.fixed[f.id] = f.value; });
  (model.investment ?? []).forEach((i) => { st.investment[i.id] = i.value; });
  return st;
}

/** Saved numbers over the defaults; only keys the definition knows, only numbers. */
export function mergeState(base: ModelState, saved: unknown): ModelState {
  if (!saved || typeof saved !== 'object') return base;
  const sv = saved as Record<string, Record<string, unknown>>;
  const out: ModelState = JSON.parse(JSON.stringify(base));
  (['settings', 'fixed', 'investment'] as const).forEach((k) => {
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
export type GenMonth = { units: number; newUnits: number; revenue: number; cost: number; costLines: Record<string, number>; generic?: boolean };
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
    ordered.forEach((g) => {
      const inp = state.generators[g.id] ?? {};
      const scope: Scope = { ...state.settings, ...inp, month: m };
      const v = g.volume ?? {};
      let units = 0;
      const startMonth = v.startMonth != null ? evalExpr(v.startMonth, scope) : 1;
      if (m < startMonth) units = 0;
      else if (v.linkedTo) {
        units = (unitsNow[v.linkedTo] ?? 0) * evalExpr(v.factor == null ? 1 : v.factor, scope);
      } else {
        const prev = unitsPrev[g.id];
        if (prev == null || m === startMonth) units = evalExpr(v.start, scope);
        else {
          const growth = evalExpr(v.growth ?? 0, scope) / 100;
          const churn = evalExpr(v.churn ?? 0, scope) / 100;
          const add = evalExpr(v.add ?? 0, scope);
          units = prev * (1 + growth - churn) + add;
        }
        if (v.cap != null) units = Math.min(units, evalExpr(v.cap, scope));
      }
      const newUnits = Math.max(units - (unitsPrev[g.id] ?? 0), 0);
      unitsNow[g.id] = units;
      scope.units = units;
      scope.newUnits = newUnits;
      const revenue = g.revenueTotal != null ? (units > 0 ? evalExpr(g.revenueTotal, scope) : 0) : units * evalExpr(g.revenuePerUnit ?? 0, scope);
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
      row.gens[g.id] = { units, newUnits, revenue, cost, costLines };
      row.revenue += revenue;
      row.variableCost += cost;
      if (g.countsAsUnit !== false && !v.linkedTo) { row.units += units; row.newUnits += newUnits; }
    });
    Object.assign(unitsPrev, unitsNow);

    (model.genericVariable ?? []).forEach((c) => {
      const value = state.settings[c.id] ?? c.value ?? 0;
      const amount = c.kind === 'percentRevenue' ? (row.revenue * value) / 100 : c.kind === 'perUnit' ? row.units * value : row.newUnits * value;
      row.gens[c.id] = { units: 0, newUnits: 0, revenue: 0, cost: amount, costLines: {}, generic: true };
      row.variableCost += amount;
    });
    (model.fixedCosts ?? []).forEach((f) => { if (m >= (f.startMonth ?? 1)) row.fixedCost += state.fixed[f.id] ?? 0; });
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
