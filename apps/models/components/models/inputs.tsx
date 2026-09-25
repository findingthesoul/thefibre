'use client';

// The input panels at the bottom of the page: one per turnover generator
// (its volume, price and own costs), then generic costs, investment, settings.

import type { ReactNode } from 'react';
import { CARD, PILL, PILL_TONE, SECTION_LABEL } from '@thefibre/shared/ui/recipes';
import { FIELD_INPUT_CLASS } from '@thefibre/shared/ui/fields';
import type { ModelDefinition, ModelState, Summary, NumberInput } from '@/lib/engine';
import { makeFormatters, singular } from '@/lib/format';
import { t, type Locale } from '@/lib/i18n-ui';

export type Scope = 'settings' | 'fixed' | 'investment' | { gen: string };

function Field({ def, value, onChange }: { def: NumberInput; value: number; onChange: (v: number) => void }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_104px] items-center gap-2.5 border-b border-line/50 py-1.5 last:border-b-0">
      <label className="text-[13px] leading-tight">{def.label}{def.unit && <span className="block text-[11px] text-ink-muted">{def.unit}</span>}</label>
      <input type="number" step={def.step ?? 1} value={value} onChange={(e) => { const v = parseFloat(e.target.value); onChange(Number.isFinite(v) ? v : 0); }} className={`${FIELD_INPUT_CLASS} h-8 text-right tabular-nums`} />
    </div>
  );
}

function InputPanel({ id, title, help, badge, children, foot }: { id: string; title: string; help?: string | undefined; badge?: ReactNode; children: ReactNode; foot: ReactNode }) {
  return (
    <section id={id} className={`${CARD} flex min-w-0 flex-col`}>
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5"><div><h2 className="text-[15px] font-medium tracking-tight">{title}</h2>{help && <p className="mt-0.5 text-[12.5px] text-ink-muted">{help}</p>}</div>{badge}</div>
      <div className="flex-1 px-4 pb-3 pt-2">{children}</div>
      <div className="flex justify-between gap-2 rounded-b-lg border-t border-line bg-surface-sunken px-4 py-2.5 text-[12.5px] text-ink-subtle">{foot}</div>
    </section>
  );
}

const B = ({ children }: { children: ReactNode }) => <b className="font-medium text-ink">{children}</b>;

export function InputPanels({ model, state, s, locale, refMonth, horizon, onChange, onRefMonth, onHorizon }: {
  model: ModelDefinition; state: ModelState; s: Summary; locale: Locale; refMonth: number; horizon: number;
  onChange: (scope: Scope, id: string, value: number) => void; onRefMonth: (v: number) => void; onHorizon: (v: number) => void;
}) {
  const { fmtMoney, fmtNum } = makeFormatters(model.currencySymbol ?? '');
  const unit = model.unitLabel ?? 'units';
  const cur = model.currency ?? '';
  const ref = s.ref;
  const linkedName = (id: string) => { const g = model.generators.find((x) => x.id === id); return g ? (g.short ?? g.name) : id; };
  return (
    <>
      <div className={`${SECTION_LABEL} mt-10 mb-3 flex items-center gap-3 after:h-px after:flex-1 after:bg-line`} id="generators">{t(locale, 'turnover_generators')}</div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {model.generators.map((g) => {
          const r = ref.gens[g.id]!;
          const gs = state.generators[g.id] ?? {};
          return (
            <InputPanel key={g.id} id={`gen-${g.id}`} title={g.name} help={g.help} badge={g.volume?.linkedTo ? <span className={`${PILL} ${PILL_TONE.neutral} shrink-0`}>{t(locale, 'per')} {singular(linkedName(g.volume.linkedTo)).toLowerCase()}</span> : undefined}
              foot={<><span>{t(locale, 'month_n', { n: s.refMonth })}: {g.countsAsUnit !== false && <><B>{fmtNum(r.units)}</B> {unit}, </>}<B>{fmtMoney(r.revenue)}</B> {t(locale, 'revenue').toLowerCase()}</span><span>{t(locale, 'margin').toLowerCase()} <B>{fmtMoney(r.revenue - r.cost)}</B></span></>}>
              {(g.inputs ?? []).map((d) => <Field key={d.id} def={d} value={gs[d.id] ?? d.value} onChange={(v) => onChange({ gen: g.id }, d.id, v)} />)}
              {(g.costs ?? []).length > 0 && <><div className={`${SECTION_LABEL} pt-2.5 pb-0.5`}>{t(locale, 'own_cost_structure')}</div>{(g.costs ?? []).map((d) => <Field key={d.id} def={d} value={gs[d.id] ?? d.value} onChange={(v) => onChange({ gen: g.id }, d.id, v)} />)}</>}
            </InputPanel>
          );
        })}
      </div>
      <div className={`${SECTION_LABEL} mt-10 mb-3 flex items-center gap-3 after:h-px after:flex-1 after:bg-line`}>{t(locale, 'generic_costs_and')}</div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <InputPanel id="fixed" title={t(locale, 'generic_cost_structure')} help={t(locale, 'generic_help')} foot={<><span>{t(locale, 'total_fixed_cost')}</span><span><B>{fmtMoney(ref.fixedCost)}</B> / {t(locale, 'unit_month')}</span></>}>
          {(model.fixedCosts ?? []).map((d) => <Field key={d.id} def={{ ...d, unit: `${cur} / ${t(locale, 'unit_month')}` }} value={state.fixed[d.id] ?? d.value} onChange={(v) => onChange('fixed', d.id, v)} />)}
        </InputPanel>
        <InputPanel id="investment" title={t(locale, 'investment_need')} help={t(locale, 'investment_help')} foot={<><span>{t(locale, 'investment')} <B>{fmtMoney(s.investmentTotal)}</B></span><span>{t(locale, 'kpi_funding_need').toLowerCase()} <B>{fmtMoney(s.fundingNeed)}</B></span></>}>
          {(model.investment ?? []).map((d) => <Field key={d.id} def={{ ...d, unit: `${cur} ${t(locale, 'one_off')}` }} value={state.investment[d.id] ?? d.value} onChange={(v) => onChange('investment', d.id, v)} />)}
        </InputPanel>
        <InputPanel id="settings" title={t(locale, 'settings')} help={t(locale, 'settings_help')} foot={<><span>{t(locale, 'horizon_months', { n: horizon })}</span><span>{cur}</span></>}>
          {(model.settings ?? []).map((d) => <Field key={d.id} def={d} value={state.settings[d.id] ?? d.value} onChange={(v) => onChange('settings', d.id, v)} />)}
          <div className={`${SECTION_LABEL} pt-2.5 pb-0.5`}>{t(locale, 'horizon_and_ref')}</div>
          <Field def={{ id: 'horizon', label: t(locale, 'horizon'), unit: t(locale, 'horizon_unit'), value: horizon, step: 12 }} value={horizon} onChange={(v) => { if (v >= 12 && v <= 120) onHorizon(Math.round(v)); }} />
          <Field def={{ id: 'refMonth', label: t(locale, 'ref_month'), unit: t(locale, 'unit_month'), value: refMonth, step: 1 }} value={refMonth} onChange={(v) => { if (v >= 1 && v <= horizon) onRefMonth(Math.round(v)); }} />
        </InputPanel>
      </div>
    </>
  );
}
