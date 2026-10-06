// The assumptions behind a calculation, as a list a person can read.
//
// Sjoerd, 2026-09-29: "a third tab with assumptions, so there is a clear list
// with the assumptions behind this calculation." A model rests on three kinds:
//   · the numbers the team typed or left at their default,
//   · the rules that turn those numbers into a projection (how a segment
//     grows, what a stream bills, which table a price reads),
//   · the things nobody can type as a number ("practices report their
//     turnover honestly"), which the team writes down as stated assumptions.
// This file builds the first two from the definition and the state. Pure: the
// words come in through `T`, so it runs in a test without a catalogue.

import { ASSUMPTION_STATUSES, type AssumptionStatus, type BandTable, type CostKind, type Generator, type ModelDefinition, type ModelState } from './engine';
import { tablesUsedBy, usersOfTable } from './links';
import { isSegment } from './structure';
import type { UiKey } from './i18n-ui';

export type AssumptionRow = {
  id: string;
  label: string;
  value: string;
  /** The id a formula uses for this number. */
  code?: string;
  /** How the number enters the calculation, in words. */
  note?: string;
  /** The definition's default, when the team changed the number. */
  was?: string;
  /** A rule rather than a number: set in a different voice. */
  rule?: boolean;
};
export type AssumptionGroup = { id: string; title: string; sub?: string; rows: AssumptionRow[] };
export type Words = (key: UiKey, vars?: Record<string, string | number>) => string;
export type Stated = { id?: string; text: string; section?: string; status?: AssumptionStatus };
export type StatedSection = { title: string; items: { a: Stated; index: number; n: number }[] };

const num = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 2 });
const withUnit = (v: number, unit?: string) => `${num(v)}${unit ? ` ${unit}` : ''}`;
const KIND: Record<CostKind, UiKey> = { perUnit: 'kind_per_unit', perNewUnit: 'kind_per_new_unit', perBatch: 'kind_per_batch', percentRevenue: 'kind_percent_revenue', fixed: 'kind_fixed', formula: 'kind_formula' };

export const statedList = (def: ModelDefinition): Stated[] =>
  (def.assumptions ?? [])
    .map((a) => (typeof a === 'string' ? { text: a } : a))
    .filter((a) => a && typeof a.text === 'string')
    .map((a) => ({ ...a, section: typeof a.section === 'string' && a.section.trim() ? a.section.trim() : undefined, status: ASSUMPTION_STATUSES.includes(a.status as AssumptionStatus) ? a.status : undefined }));

/** The stated assumptions under their headers, in the order the headers
 *  first appear; lines without a header come first. `index` is the place in
 *  the definition's list, `n` the number a reader sees, counted through. */
export function statedSections(list: Stated[], skipEmpty = false): StatedSection[] {
  const out: StatedSection[] = [];
  list.forEach((a, index) => {
    if (skipEmpty && !a.text) return;
    const title = a.section ?? '';
    let sec = out.find((x) => x.title === title);
    if (!sec) { sec = { title, items: [] }; if (title === '') out.unshift(sec); else out.push(sec); }
    sec.items.push({ a, index, n: 0 });
  });
  let n = 0;
  out.forEach((sec) => sec.items.forEach((it) => { it.n = ++n; }));
  return out;
}

function generatorGroup(def: ModelDefinition, state: ModelState, g: Generator, T: Words): AssumptionGroup {
  const st = state.generators[g.id] ?? {};
  const inputs = g.inputs ?? [];
  const unit = def.unitLabel ?? 'units';
  const name = (id: string) => def.generators.find((x) => x.id === id)?.name ?? id;
  const tableName = (id: string) => (def.tables ?? []).find((tb) => tb.id === id)?.label ?? id;
  const valueOf = (id: string) => st[id] ?? inputs.find((i) => i.id === id)?.value ?? state.settings[id] ?? 0;
  const known = (id: string) => inputs.some((i) => i.id === id) || id in state.settings;
  /** A volume or price reference: a number, the value of an input, or a formula as written. */
  const read = (x: string | number | undefined, fallback: number): string =>
    x == null ? num(fallback) : typeof x === 'number' ? num(x) : known(x) ? num(valueOf(x)) : x;
  const rows: AssumptionRow[] = [];
  const v = g.volume ?? {};

  if (v.linkedTo) rows.push({ id: 'volume', rule: true, label: T('asm_how_many'), value: T('asm_linked', { n: name(v.linkedTo), f: read(v.factor, 1) }) });
  else if (g.revenueTotal != null) rows.push({ id: 'volume', rule: true, label: T('asm_how_many'), value: T('asm_lump', { n: read(v.startMonth, 1) }) });
  else {
    const extra = [v.add != null ? T('asm_add', { n: read(v.add, 0), units: unit }) : '', v.cap != null ? T('asm_cap', { n: read(v.cap, 0), units: unit }) : '', v.startMonth != null ? T('asm_from_month', { n: read(v.startMonth, 1) }) : ''].filter(Boolean);
    rows.push({ id: 'volume', rule: true, label: T('asm_how_many'), value: T('asm_volume', { s: read(v.start, 0), g: read(v.growth, 0), c: read(v.churn, 0), units: unit }), note: extra.join(' · ') || undefined });
  }
  const typed = Object.keys(state.periods[g.id] ?? {}).map(Number).sort((a, b) => a - b);
  if (typed.length) rows.push({ id: 'typed', rule: true, label: T('asm_typed'), value: T('asm_typed_months', { n: typed.join(', '), units: unit }) });

  inputs.forEach((i) => {
    const now = valueOf(i.id);
    rows.push({ id: `in:${i.id}`, label: i.label, value: withUnit(now, i.unit), code: i.id, was: now !== i.value ? T('asm_default', { v: withUnit(i.value, i.unit) }) : undefined });
  });

  const price = g.revenueTotal != null ? g.revenueTotal : (g.revenuePerUnit ?? 0);
  rows.push({ id: 'price', rule: true, label: g.revenueTotal != null ? T('asm_amount') : T('asm_price', { unit: unit.replace(/s$/, '') }), value: typeof price === 'number' ? num(price) : price, note: typeof price === 'string' && known(price) ? `= ${num(valueOf(price))}` : undefined });
  if (g.billing && g.billing.every > 1) rows.push({ id: 'billing', rule: true, label: T('billing'), value: T('calc_billing', { n: g.billing.every, m: g.billing.month ?? 1 }) });
  tablesUsedBy(g).forEach((id) => rows.push({ id: `table:${id}`, rule: true, label: T('tables'), value: T('rel_uses_table', { n: tableName(id) }) }));

  (def.transitions ?? []).filter((tr) => tr.from === g.id).forEach((tr) => {
    const months = Object.keys(state.periodRates[tr.id] ?? {}).map(Number).sort((a, b) => a - b);
    const rate = state.transitions[tr.id] ?? tr.rate;
    rows.push({ id: `flow:${tr.id}`, rule: true, label: T('funnel'), value: T(tr.move === false ? 'calc_flow_copy' : 'calc_flow_move', { n: name(tr.to), r: num(rate) }), note: months.length ? T('asm_typed_rates', { n: months.join(', ') }) : undefined, was: rate !== tr.rate ? T('asm_default', { v: `${num(tr.rate)}%` }) : undefined });
  });

  (g.costs ?? []).forEach((c) => {
    if (c.kind === 'formula') { rows.push({ id: `cost:${c.id}`, label: c.label, value: String(c.formula ?? ''), code: c.id, note: T('kind_formula'), rule: true }); return; }
    const now = st[c.id] ?? c.value;
    const how = c.kind === 'perBatch' ? `${T(KIND[c.kind])} · ${T('asm_batch', { n: read(c.batchSize, 1), units: unit })}` : T(KIND[c.kind]);
    rows.push({ id: `cost:${c.id}`, label: c.label, value: withUnit(now, c.unit), code: c.id, note: how, was: now !== c.value ? T('asm_default', { v: withUnit(c.value, c.unit) }) : undefined });
  });
  return { id: `gen:${g.id}`, title: g.name, sub: g.segment || g.help || undefined, rows };
}

const bandsInWords = (tb: BandTable, bands: BandTable['bands'], T: Words): string =>
  [...bands]
    .sort((a, b) => (a.upTo == null ? 1 : b.upTo == null ? -1 : a.upTo - b.upTo))
    .map((b) => {
      const v = tb.mode === 'marginal' ? `${num(b.rate ?? 0)}%` : num(b.value ?? 0);
      return b.upTo == null ? T('asm_band_above', { v }) : T('asm_band_up_to', { a: num(b.upTo), v });
    })
    .join(' · ');

export function buildAssumptions(def: ModelDefinition, state: ModelState, opts: { horizon: number; refMonth: number }, T: Words): AssumptionGroup[] {
  const cur = def.currency ?? '';
  const unit = def.unitLabel ?? 'units';
  const groups: AssumptionGroup[] = [];
  const name = (id: string) => def.generators.find((x) => x.id === id)?.name ?? id;

  const general: AssumptionRow[] = [
    { id: 'horizon', label: T('horizon'), value: `${opts.horizon} ${T('horizon_unit')}`, was: def.horizon != null && def.horizon !== opts.horizon ? T('asm_default', { v: String(def.horizon) }) : undefined },
    { id: 'ref', label: T('ref_month'), value: T('month_n', { n: opts.refMonth }), note: T('asm_ref_note') },
    { id: 'currency', label: T('currency'), value: `${cur}${def.currencySymbol ? ` (${def.currencySymbol})` : ''}` },
    { id: 'unit', label: T('unit_label'), value: unit },
    { id: 'placeholders', rule: true, label: T('asm_numbers'), value: T('asm_numbers_note') },
  ];
  const share = state.reserve?.share ?? 0, start = state.reserve?.start ?? 0;
  if (share > 0 || start > 0) general.push({ id: 'reserve', rule: true, label: T('reserve'), value: T('asm_reserve_rule', { s: num(share), n: state.reserve?.targetMonths ?? 12, v: withUnit(start, cur) }) });
  groups.push({ id: 'general', title: T('asm_general'), rows: general });

  def.generators.filter(isSegment).forEach((g) => groups.push(generatorGroup(def, state, g, T)));
  def.generators.filter((g) => !isSegment(g)).forEach((g) => groups.push(generatorGroup(def, state, g, T)));

  const resources: AssumptionRow[] = [];
  (def.fixedCosts ?? []).forEach((f) => {
    const now = state.fixed[f.id] ?? f.value;
    const notes = [
      f.startMonth && f.startMonth > 1 ? T('asm_from_month', { n: f.startMonth }) : '',
      f.endMonth != null ? T('rel_until_month', { n: f.endMonth }) : '',
      f.per ? T('asm_per', { e: f.per.every, n: f.per.of === 'units' ? unit : name(f.per.of) }) : '',
      ...(f.steps ?? []).map((stp) => T('rel_step', { m: stp.fromMonth, v: withUnit(stp.value, cur) })),
    ].filter(Boolean);
    resources.push({ id: `fixed:${f.id}`, label: f.label, value: withUnit(now, `${cur} / ${T('unit_month')}`), note: notes.join(' · ') || undefined, was: now !== f.value ? T('asm_default', { v: withUnit(f.value, cur) }) : undefined });
  });
  (def.investment ?? []).forEach((i) => {
    const now = state.investment[i.id] ?? i.value;
    resources.push({ id: `invest:${i.id}`, label: i.label, value: withUnit(now, cur), note: T('asm_one_off'), was: now !== i.value ? T('asm_default', { v: withUnit(i.value, cur) }) : undefined });
  });
  if (resources.length) groups.push({ id: 'resources', title: T('key_resources'), sub: T('asm_resources_sub'), rows: resources });

  const settings: AssumptionRow[] = (def.settings ?? []).map((s) => {
    const now = state.settings[s.id] ?? s.value;
    const generic = (def.genericVariable ?? []).filter((c) => c.id === s.id).map((c) => `${c.label}: ${T(KIND[c.kind])}, ${T('asm_on_all')}`);
    return { id: `setting:${s.id}`, label: s.label, value: withUnit(now, s.unit), code: s.id, note: generic.join(' · ') || undefined, was: now !== s.value ? T('asm_default', { v: withUnit(s.value, s.unit) }) : undefined };
  });
  if (settings.length) groups.push({ id: 'settings', title: T('global_variables'), sub: T('asm_settings_sub'), rows: settings });

  const tables: AssumptionRow[] = (def.tables ?? []).map((tb) => {
    const nums = state.tables?.[tb.id];
    const bands = nums?.bands ?? tb.bands;
    const cap = nums?.cap !== undefined ? nums.cap : tb.cap;
    const users = usersOfTable(def, tb.id).map((g) => g.name);
    const notes = [T(tb.mode === 'marginal' ? 'asm_mode_marginal' : 'asm_mode_step'), tb.mode === 'marginal' && cap != null ? T('asm_cap_amount', { v: withUnit(cap, tb.unit) }) : '', users.length ? T('rel_used_by', { n: users.join(', ') }) : T('rel_not_used')].filter(Boolean);
    return { id: `table:${tb.id}`, label: tb.label, value: bandsInWords(tb, bands, T), code: tb.id, note: notes.join(' · '), was: JSON.stringify(bands) !== JSON.stringify(tb.bands) ? T('asm_changed') : undefined, rule: true };
  });
  if (tables.length) groups.push({ id: 'tables', title: T('tables'), rows: tables });

  return groups;
}

/** The whole list as plain text, to paste into a mail or a document. */
export function assumptionsText(title: string, statedTitle: string, stated: Stated[], groups: AssumptionGroup[], statusWord: (s: AssumptionStatus) => string = (s) => s): string {
  const out: string[] = [title, ''];
  statedSections(stated, true).forEach((sec) => {
    out.push(sec.title || statedTitle);
    sec.items.forEach(({ a, n }) => out.push(`${n}. ${a.text}${a.status ? ` [${statusWord(a.status)}]` : ''}`));
    out.push('');
  });
  groups.forEach((g) => {
    out.push(g.sub ? `${g.title} (${g.sub})` : g.title);
    g.rows.forEach((r) => out.push(`- ${r.label}: ${r.value}${r.note ? ` (${r.note})` : ''}${r.was ? ` [${r.was}]` : ''}`));
    out.push('');
  });
  return out.join('\n').trim() + '\n';
}
