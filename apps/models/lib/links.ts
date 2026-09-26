// Link ids: how a canvas statement points at the turnover and cost items it
// belongs to, and how the Numbers tab finds the variables behind each item.
//   gen:<generator id>            a turnover generator (its volume and price)
//   cost:<generator id>.<cost id> one of a generator's own cost lines
//   fixed:<fixed cost id>         a generic fixed cost
//   invest:<investment id>        a one-off investment line
//   setting:<setting id>          a global setting
//   transition:<transition id>    a funnel step's monthly rate
//   table:<table id>              a band table (a stepped licence, a discount)
import { tableRefs, type Generator, type ModelDefinition, type ModelState, type NumberInput, type Summary } from './engine';

export type Scope = 'settings' | 'fixed' | 'investment' | 'transitions' | { gen: string };
export type Variable = { scope: Scope; def: NumberInput; value: number };
export type Linkable = { id: string; label: string; group: string; kind: 'gen' | 'cost' | 'fixed' | 'invest' | 'setting' | 'transition' | 'table' };

const VOLUME_KEYS = ['start', 'growth', 'churn', 'add', 'cap', 'startMonth', 'factor'] as const;

/** Every item a statement may link to, grouped for a picker. */
export function linkables(def: ModelDefinition): Linkable[] {
  const out: Linkable[] = [];
  def.generators.forEach((g) => {
    out.push({ id: `gen:${g.id}`, label: g.name, group: 'Turnover', kind: 'gen' });
    (g.costs ?? []).forEach((c) => out.push({ id: `cost:${g.id}.${c.id}`, label: `${g.short ?? g.name}: ${c.label}`, group: 'Own costs', kind: 'cost' }));
  });
  (def.fixedCosts ?? []).forEach((f) => out.push({ id: `fixed:${f.id}`, label: f.label, group: 'Fixed costs', kind: 'fixed' }));
  (def.investment ?? []).forEach((i) => out.push({ id: `invest:${i.id}`, label: i.label, group: 'Investment', kind: 'invest' }));
  (def.settings ?? []).forEach((s) => out.push({ id: `setting:${s.id}`, label: s.label, group: 'Settings', kind: 'setting' }));
  (def.transitions ?? []).forEach((tr) => out.push({ id: `transition:${tr.id}`, label: transitionLabel(def, tr), group: 'Funnel', kind: 'transition' }));
  (def.tables ?? []).forEach((tb) => out.push({ id: `table:${tb.id}`, label: tb.label, group: 'Tables', kind: 'table' }));
  return out;
}

/** The table ids a generator's formulas read: price, amount, cost formulas, batch sizes. */
export function tablesUsedBy(g: Generator): string[] {
  const ids = new Set<string>();
  [g.revenuePerUnit, g.revenueTotal, ...(g.costs ?? []).flatMap((c) => [c.formula, c.batchSize])].forEach((f) => tableRefs(f).forEach((id) => ids.add(id)));
  return Array.from(ids);
}
/** The generators whose formulas read a table. */
export const usersOfTable = (def: ModelDefinition, tableId: string): Generator[] => def.generators.filter((g) => tablesUsedBy(g).includes(tableId));

/** "Community → Forge" for a transition. */
export function transitionLabel(def: ModelDefinition, tr: NonNullable<ModelDefinition['transitions']>[number]): string {
  const n = (id: string) => def.generators.find((g) => g.id === id)?.short ?? def.generators.find((g) => g.id === id)?.name ?? id;
  return `${n(tr.from)} → ${n(tr.to)}`;
}
/** The rate of a transition as a variable, for the drawer. */
export function transitionVar(def: ModelDefinition, state: ModelState, tr: NonNullable<ModelDefinition['transitions']>[number]): Variable {
  return { scope: 'transitions', def: { id: tr.id, label: transitionLabel(def, tr), unit: '% per month', value: tr.rate, step: 0.5 }, value: state.transitions[tr.id] ?? tr.rate };
}

/** The input ids a generator's volume reads (start, growth, churn …). */
export function volumeInputIds(g: ModelDefinition['generators'][number]): Set<string> {
  const ids = new Set<string>();
  const v = g.volume ?? {};
  VOLUME_KEYS.forEach((k) => { const ref = (v as Record<string, unknown>)[k]; if (typeof ref === 'string') ids.add(ref); });
  return ids;
}

function genVars(def: ModelDefinition, state: ModelState, gid: string, which: 'volume' | 'price' | 'all'): Variable[] {
  const g = def.generators.find((x) => x.id === gid);
  if (!g) return [];
  const vol = volumeInputIds(g);
  const st = state.generators[gid] ?? {};
  return (g.inputs ?? [])
    .filter((i) => (which === 'all' ? true : which === 'volume' ? vol.has(i.id) : !vol.has(i.id)))
    .map((i) => ({ scope: { gen: gid }, def: i, value: st[i.id] ?? i.value }));
}

/** The variables behind one link id. */
export function variablesFor(def: ModelDefinition, state: ModelState, link: string): Variable[] {
  const [kind, rest] = link.split(':', 2) as [string, string];
  if (kind === 'gen') return genVars(def, state, rest, 'all');
  if (kind === 'cost') {
    const [gid, cid] = rest.split('.', 2) as [string, string];
    const g = def.generators.find((x) => x.id === gid);
    const c = g?.costs?.find((x) => x.id === cid);
    return g && c && c.kind !== 'formula' ? [{ scope: { gen: gid }, def: c, value: state.generators[gid]?.[cid] ?? c.value }] : [];
  }
  if (kind === 'fixed') { const f = (def.fixedCosts ?? []).find((x) => x.id === rest); return f ? [{ scope: 'fixed', def: { ...f, unit: `${def.currency ?? ''} / month` }, value: state.fixed[rest] ?? f.value }] : []; }
  if (kind === 'invest') { const i = (def.investment ?? []).find((x) => x.id === rest); return i ? [{ scope: 'investment', def: { ...i, unit: `${def.currency ?? ''} one off` }, value: state.investment[rest] ?? i.value }] : []; }
  if (kind === 'setting') { const s = (def.settings ?? []).find((x) => x.id === rest); return s ? [{ scope: 'settings', def: s, value: state.settings[rest] ?? s.value }] : []; }
  if (kind === 'transition') { const tr = (def.transitions ?? []).find((x) => x.id === rest); return tr ? [transitionVar(def, state, tr)] : []; }
  return [];
}

/** A cost line with a formula has no value of its own: it is not a variable. */
export const isFormulaCost = (c: { kind: string }) => c.kind === 'formula';

/** A one-line reading of a link at the reference month, for the middle column. */
export function readingFor(def: ModelDefinition, s: Summary, state: ModelState, link: string, fm: { money: (n: number) => string; num: (n: number) => string }): string {
  const [kind, rest] = link.split(':', 2) as [string, string];
  const ref = s.ref;
  if (kind === 'gen') { const r = ref.gens[rest]; const g = def.generators.find((x) => x.id === rest); return r ? `${g?.countsAsUnit === false ? '' : fm.num(r.units) + ' × '}${fm.money(r.revenue)} / month` : ''; }
  if (kind === 'cost') { const [gid, cid] = rest.split('.', 2) as [string, string]; const amt = ref.gens[gid]?.costLines[cid]; return amt != null ? `${fm.money(amt)} / month` : ''; }
  if (kind === 'fixed') return `${fm.money(state.fixed[rest] ?? 0)} / month`;
  if (kind === 'invest') return `${fm.money(state.investment[rest] ?? 0)} one off`;
  if (kind === 'setting') { const st = (def.settings ?? []).find((x) => x.id === rest); return `${state.settings[rest] ?? 0} ${st?.unit ?? ''}`; }
  if (kind === 'transition') { const tr = (def.transitions ?? []).find((x) => x.id === rest); return tr ? `${state.transitions[tr.id] ?? tr.rate}% / month` : ''; }
  if (kind === 'table') { const tb = (def.tables ?? []).find((x) => x.id === rest); const n = state.tables[rest]?.bands.length ?? tb?.bands.length ?? 0; return tb ? `${n} bands · ${tb.mode}` : ''; }
  return '';
}

export { genVars };
