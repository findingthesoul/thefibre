'use client';

// The bottom half of the Numbers tab: canvas element → turnover and cost
// items → variables. Structural rows come from the definition itself
// (segments, streams, costs, resources, settings); statement rows carry the
// items a statement was linked to. Every variable edits in place.

import { Fragment, type ReactNode } from 'react';
import { CARD, SECTION_LABEL } from '@thefibre/shared/ui/recipes';
import { CANVAS_BLOCK_KEYS, itemObj, type CanvasBlockKey, type ModelDefinition, type ModelState, type Summary } from '@/lib/engine';
import { genVars, readingFor, variablesFor, type Scope, type Variable } from '@/lib/links';
import { makeFormatters } from '@/lib/format';
import { t, type Locale } from '@/lib/i18n-ui';
import { Field } from './inputs';

type Row = { block: string; element: ReactNode; items: ReactNode; vars: Variable[]; hint?: string };

const TITLE: Record<CanvasBlockKey, 'key_partners' | 'key_activities' | 'key_resources' | 'value_propositions' | 'customer_relationships' | 'channels'> = {
  keyPartners: 'key_partners', keyActivities: 'key_activities', keyResources: 'key_resources', valuePropositions: 'value_propositions', customerRelationships: 'customer_relationships', channels: 'channels',
};

export function NumbersTable({ model, state, s, locale, refMonth, horizon, onChange, onRefMonth, onHorizon }: {
  model: ModelDefinition; state: ModelState; s: Summary; locale: Locale; refMonth: number; horizon: number;
  onChange: (scope: Scope, id: string, value: number) => void; onRefMonth: (v: number) => void; onHorizon: (v: number) => void;
}) {
  const { fmtMoney, fmtNum } = makeFormatters(model.currencySymbol ?? '');
  const fm = { money: fmtMoney, num: fmtNum };
  const ref = s.ref;
  const unit = model.unitLabel ?? 'units';
  const cur = model.currency ?? '';
  const rows: Row[] = [];
  const sub = (text: string) => <span className="block text-[11px] text-ink-muted">{text}</span>;
  const line = (label: string, value: string) => <div className="flex justify-between gap-3 text-[12.5px]"><span>{label}</span><span className="tabular-nums text-ink-subtle">{value}</span></div>;

  // Statement rows: what the story says, tied to the items it stands for.
  const statementRows = (block: CanvasBlockKey) =>
    (model.canvas?.[block] ?? []).map(itemObj).filter((it) => (it.links?.length ?? 0) > 0).map((it) => ({
      block: t(locale, TITLE[block]),
      element: <>{it.text}</>,
      items: <>{(it.links ?? []).map((l) => <Fragment key={l}>{line(readingLabel(model, l), readingFor(model, s, state, l, fm))}</Fragment>)}</>,
      vars: (it.links ?? []).flatMap((l) => variablesFor(model, state, l)),
    }));
  CANVAS_BLOCK_KEYS.filter((k) => k !== 'keyActivities' && k !== 'keyResources').forEach((k) => rows.push(...statementRows(k)));

  // Customer segments: who pays, the volume variables.
  model.generators.filter((g) => g.countsAsUnit !== false && !g.volume?.linkedTo).forEach((g) => {
    const r = ref.gens[g.id]!;
    rows.push({ block: t(locale, 'customer_segments'), element: <>{g.name}{g.segment && sub(g.segment)}</>, items: line(`${unit}, ${t(locale, 'month_n', { n: s.refMonth }).toLowerCase()}`, fmtNum(r.units)), vars: genVars(model, state, g.id, 'volume') });
  });
  // Revenue streams: the price variables of every generator.
  model.generators.forEach((g) => {
    const r = ref.gens[g.id]!;
    const vars = genVars(model, state, g.id, g.volume?.linkedTo || g.countsAsUnit === false ? 'all' : 'price');
    rows.push({ block: t(locale, 'revenue_streams'), element: <>{g.name}{g.help && sub(g.help)}</>, items: line(t(locale, 'revenue'), `${fmtMoney(r.revenue)} / ${t(locale, 'unit_month')}`), vars });
  });
  // Key activities: each generator's own cost lines.
  model.generators.filter((g) => (g.costs ?? []).length > 0).forEach((g) => {
    const r = ref.gens[g.id]!;
    rows.push({ block: t(locale, 'key_activities'), element: <>{g.short ?? g.name}{sub(t(locale, 'own_cost_structure'))}</>, items: <>{(g.costs ?? []).map((c) => <Fragment key={c.id}>{line(c.label, fmtMoney(r.costLines[c.id] ?? 0))}</Fragment>)}</>, vars: (g.costs ?? []).map((c) => ({ scope: { gen: g.id }, def: c, value: state.generators[g.id]?.[c.id] ?? c.value })) });
  });
  rows.push(...statementRows('keyActivities'));
  // Key resources: fixed costs and the investment.
  if ((model.fixedCosts ?? []).length) rows.push({ block: t(locale, 'key_resources'), element: <>{t(locale, 'generic_cost_structure')}{sub(t(locale, 'generic_help'))}</>, items: line(t(locale, 'total_fixed_cost'), `${fmtMoney(ref.fixedCost)} / ${t(locale, 'unit_month')}`), vars: (model.fixedCosts ?? []).map((f) => ({ scope: 'fixed' as const, def: { ...f, unit: `${cur} / ${t(locale, 'unit_month')}` }, value: state.fixed[f.id] ?? f.value })) });
  if ((model.investment ?? []).length) rows.push({ block: t(locale, 'key_resources'), element: <>{t(locale, 'investment_need')}{sub(t(locale, 'investment_help'))}</>, items: <>{line(t(locale, 'investment'), fmtMoney(s.investmentTotal))}{line(t(locale, 'kpi_funding_need'), fmtMoney(s.fundingNeed))}</>, vars: (model.investment ?? []).map((i) => ({ scope: 'investment' as const, def: { ...i, unit: `${cur} ${t(locale, 'one_off')}` }, value: state.investment[i.id] ?? i.value })) });
  rows.push(...statementRows('keyResources'));
  // Settings: global assumptions, horizon and reference month.
  rows.push({ block: t(locale, 'settings'), element: <>{t(locale, 'settings')}{sub(t(locale, 'settings_help'))}</>, items: <>{line(t(locale, 'horizon'), t(locale, 'horizon_months', { n: horizon }))}{line(t(locale, 'ref_month'), t(locale, 'month_n', { n: s.refMonth }))}</>, vars: (model.settings ?? []).map((st) => ({ scope: 'settings' as const, def: st, value: state.settings[st.id] ?? st.value })) });

  const th = 'px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-ink-muted border-b border-line bg-surface-raised sticky top-0 z-[2]';
  let lastBlock = '';
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead><tr><th className={th} style={{ width: '28%' }}>{t(locale, 'col_canvas_element')}</th><th className={th} style={{ width: '30%' }}>{t(locale, 'col_items')}</th><th className={th}>{t(locale, 'col_variables')}</th></tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const head = r.block !== lastBlock; lastBlock = r.block;
              return (
                <Fragment key={i}>
                  {head && <tr><td colSpan={3} className={`${SECTION_LABEL} border-b border-line bg-surface-sunken px-3 py-1.5`}>{r.block}</td></tr>}
                  <tr className="align-top">
                    <td className="border-b border-line/60 px-3 py-2">{r.element}</td>
                    <td className="border-b border-line/60 px-3 py-2">{r.items}</td>
                    <td className="border-b border-line/60 px-3 py-1">
                      {r.vars.length ? r.vars.map((v) => <Field key={(typeof v.scope === 'string' ? v.scope : v.scope.gen) + ':' + v.def.id} def={v.def} value={v.value} onChange={(val) => onChange(v.scope, v.def.id, val)} />) : <span className="text-[12px] text-ink-muted">—</span>}
                      {r.block === t(locale, 'settings') && (
                        <>
                          <Field def={{ id: 'horizon', label: t(locale, 'horizon'), unit: t(locale, 'horizon_unit'), value: horizon, step: 12 }} value={horizon} onChange={(v) => { if (v >= 12 && v <= 120) onHorizon(Math.round(v)); }} />
                          <Field def={{ id: 'refMonth', label: t(locale, 'ref_month'), unit: t(locale, 'unit_month'), value: refMonth, step: 1 }} value={refMonth} onChange={(v) => { if (v >= 1 && v <= horizon) onRefMonth(Math.round(v)); }} />
                        </>
                      )}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function readingLabel(def: ModelDefinition, link: string): string {
  const [kind, rest] = link.split(':', 2) as [string, string];
  if (kind === 'gen') return def.generators.find((g) => g.id === rest)?.name ?? rest;
  if (kind === 'cost') { const [gid, cid] = rest.split('.', 2) as [string, string]; const g = def.generators.find((x) => x.id === gid); return `${g?.short ?? gid}: ${g?.costs?.find((c) => c.id === cid)?.label ?? cid}`; }
  if (kind === 'fixed') return (def.fixedCosts ?? []).find((f) => f.id === rest)?.label ?? rest;
  if (kind === 'invest') return (def.investment ?? []).find((i) => i.id === rest)?.label ?? rest;
  if (kind === 'setting') return (def.settings ?? []).find((s) => s.id === rest)?.label ?? rest;
  return link;
}
