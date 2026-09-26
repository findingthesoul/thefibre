'use client';

// The result panels: KPI tiles, years, break even, cash, the turnover mix,
// the cost structure and the monthly projection.

import { useState, type ReactNode } from 'react';
import { CalendarDays, Scale, Wallet, Landmark, TrendingUp, Coins, Users, Receipt } from 'lucide-react';
import { CARD, ERROR_TEXT, PILL, PILL_TONE } from '@thefibre/shared/ui/recipes';
import type { ModelDefinition, ModelState, Summary } from '@/lib/engine';
import { makeFormatters, singular, cap } from '@/lib/format';
import { t, type Locale } from '@/lib/i18n-ui';
import { LineChart, BarChart } from './charts';

export function Panel({ id, title, help, actions, children, className = '' }: { id?: string; title: ReactNode; help?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`${CARD} flex min-w-0 flex-col ${className}`}>
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
        <div><h2 className="text-[15px] font-medium tracking-tight">{title}</h2>{help && <p className="mt-0.5 text-[12.5px] text-ink-muted">{help}</p>}</div>
        {actions}
      </div>
      <div className="flex-1 px-4 pb-4 pt-3">{children}</div>
    </section>
  );
}

const NEG = ERROR_TEXT.replace('text-sm ', '');
const th = 'px-2 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-muted border-b border-line';
const td = 'px-2 py-1.5 border-b border-line/60 align-middle';
const num = 'text-right tabular-nums whitespace-nowrap';
const Bar = ({ pct }: { pct: number }) => <div className="h-1.5 rounded bg-surface-sunken"><div className="h-1.5 rounded bg-ink" style={{ width: `${Math.max(pct, 1).toFixed(1)}%` }} /></div>;

export function Kpis({ model, s, locale }: { model: ModelDefinition; s: Summary; locale: Locale }) {
  const { fmtMoney, fmtMoneyK, fmtNum } = makeFormatters(model.currencySymbol ?? '');
  const unit = model.unitLabel ?? 'units';
  const ref = s.ref;
  const H = s.horizon;
  const tiles: { icon: ReactNode; lab: string; num: string; warn?: boolean; note: string }[] = [
    { icon: <CalendarDays size={16} />, lab: t(locale, 'kpi_break_even_month'), num: s.breakEvenMonth ? t(locale, 'month_n', { n: s.breakEvenMonth }) : t(locale, 'not_within_months', { n: H }), warn: !s.breakEvenMonth, note: t(locale, 'first_positive_month') },
    { icon: <Scale size={16} />, lab: t(locale, 'kpi_break_even_units', { units: unit }), num: s.breakEvenUnits != null ? fmtNum(s.breakEvenUnits) : t(locale, 'not_reachable'), warn: s.breakEvenUnits == null, note: s.breakEvenUnits != null ? t(locale, 'units_in_month', { units: `${fmtNum(ref.units)} ${unit}`, n: s.refMonth }) : t(locale, 'contribution_not_positive', { unit: singular(unit) }) },
    { icon: <Wallet size={16} />, lab: t(locale, 'kpi_funding_need'), num: fmtMoneyK(s.fundingNeed), note: t(locale, 'invest_plus_dip', { n: s.minCashMonth }) },
    { icon: <Landmark size={16} />, lab: t(locale, 'kpi_cash_positive'), num: s.cashPositiveMonth ? t(locale, 'month_n', { n: s.cashPositiveMonth }) : t(locale, 'not_within_months', { n: H }), warn: !s.cashPositiveMonth, note: t(locale, 'investment_earned_back') },
    { icon: <TrendingUp size={16} />, lab: t(locale, 'kpi_revenue_month', { n: s.refMonth }), num: fmtMoneyK(ref.revenue), note: t(locale, 'in_month_n', { v: fmtMoneyK(s.last.revenue), n: H }) },
    { icon: <Coins size={16} />, lab: t(locale, 'kpi_net_month', { n: s.refMonth }), num: fmtMoneyK(ref.net), warn: ref.net < 0, note: t(locale, 'in_month_n', { v: fmtMoneyK(s.last.net), n: H }) },
    { icon: <Users size={16} />, lab: t(locale, 'kpi_revenue_per_unit', { unit: singular(unit) }), num: fmtMoney(s.arpu), note: t(locale, 'blended_month', { n: s.refMonth }) },
    { icon: <Receipt size={16} />, lab: t(locale, 'kpi_contribution', { unit: singular(unit) }), num: fmtMoney(s.contribution), warn: s.contribution <= 0, note: t(locale, 'after_variable_cost', { v: fmtMoney(s.varPerUnit) }) },
  ];
  return (
    <div id="overview" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((k) => (
        <div key={k.lab} className={`${CARD} min-w-0 p-4`}>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-subtle">{k.icon}<span className="truncate">{k.lab}</span></div>
          <div className={`mt-2 truncate text-2xl font-medium tracking-tight tabular-nums ${k.warn ? NEG : ''}`}>{k.num}</div>
          <div className="mt-1 text-xs text-ink-muted">{k.note}</div>
        </div>
      ))}
    </div>
  );
}

export function YearsPanels({ model, s, locale }: { model: ModelDefinition; s: Summary; locale: Locale }) {
  const { fmtMoney, fmtMoneyK } = makeFormatters(model.currencySymbol ?? '');
  return (
    <div className="grid grid-cols-1 gap-4 lg:[grid-template-columns:minmax(0,3fr)_minmax(0,2fr)]">
      <Panel title={t(locale, 'years_panel')} help={t(locale, 'years_help')}>
        <Legend items={[{ label: t(locale, 'turnover'), tone: 'ink' }, { label: t(locale, 'total_cost'), tone: 'muted' }]} />
        <div className="mt-2"><BarChart groups={s.years.map((y) => ({ label: t(locale, 'year_n', { n: y.year }) + (y.months < 12 ? '*' : ''), revenue: y.revenue, cost: y.totalCost, net: y.net }))} series={[{ key: 'revenue', label: t(locale, 'turnover'), tone: 'ink' }, { key: 'cost', label: t(locale, 'total_cost'), tone: 'muted' }]} yFmt={fmtMoneyK} yFmtFull={fmtMoney} netFmt={fmtMoneyK} netLabel={t(locale, 'net')} /></div>
      </Panel>
      <Panel title={t(locale, 'years')} help={t(locale, 'years_table_help')}>
        <table className="w-full border-collapse text-[13px]"><thead><tr><th className={th}>{t(locale, 'year_n', { n: '' }).trim()}</th><th className={`${th} text-right`}>{t(locale, 'turnover')}</th><th className={`${th} text-right`}>{t(locale, 'net')}</th><th className={`${th} text-right`}>{t(locale, 'cash_year_end')}</th></tr></thead>
          <tbody>{s.years.map((y) => <tr key={y.year}><td className={td}>{t(locale, 'year_n', { n: y.year })}{y.months < 12 ? ` (${y.months} mo)` : ''}</td><td className={`${td} ${num}`}>{fmtMoney(y.revenue)}</td><td className={`${td} ${num} ${y.net < 0 ? NEG : ''}`}>{fmtMoney(y.net)}</td><td className={`${td} ${num} ${y.cash < 0 ? NEG : ''}`}>{fmtMoney(y.cash)}</td></tr>)}</tbody>
          <tfoot><tr><td className="px-2 py-1.5 font-medium">{t(locale, 'break_even_year')}</td><td colSpan={3} className={`px-2 py-1.5 ${num}`}>{s.breakEvenYear ? t(locale, 'year_n', { n: s.breakEvenYear }) : t(locale, 'not_within_horizon')}</td></tr></tfoot>
        </table>
      </Panel>
    </div>
  );
}

function Legend({ items }: { items: { label: string; tone: 'ink' | 'muted'; dash?: boolean }[] }) {
  return <div className="flex flex-wrap gap-4 text-xs text-ink-subtle">{items.map((i) => <span key={i.label} className="inline-flex items-center gap-1.5"><span className={`inline-block h-0.5 w-3.5 rounded ${i.tone === 'ink' ? 'bg-ink' : 'bg-ink-muted'} ${i.dash ? 'opacity-60' : ''}`} />{i.label}</span>)}</div>;
}

export function ChartPanels({ model, s, locale }: { model: ModelDefinition; s: Summary; locale: Locale }) {
  const { fmtMoney, fmtMoneyK, fmtNum } = makeFormatters(model.currencySymbol ?? '');
  const unit = model.unitLabel ?? 'units';
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel id="breakeven" title={t(locale, 'break_even_point')} help={t(locale, 'break_even_help', { units: unit, n: s.refMonth })}>
        <Legend items={[{ label: t(locale, 'revenue'), tone: 'ink' }, { label: t(locale, 'total_cost'), tone: 'muted', dash: true }]} />
        <div className="mt-2"><LineChart points={s.curve.map((p) => ({ x: p.units, revenue: p.revenue, cost: p.cost }))} series={[{ key: 'cost', label: t(locale, 'total_cost'), tone: 'muted', dash: '5 4' }, { key: 'revenue', label: t(locale, 'revenue'), tone: 'ink' }]} xLabel={unit} xFmt={fmtNum} yFmt={fmtMoneyK} yFmtFull={fmtMoney} marker={s.breakEvenUnits} markerLabel={s.breakEvenUnits != null ? `${t(locale, 'break_even').toLowerCase()} ${fmtNum(s.breakEvenUnits)}` : ''} tipTitle={(p) => `${fmtNum(p.x)} ${unit}`} /></div>
      </Panel>
      <Panel title={t(locale, 'cash_position')} help={t(locale, 'cash_help')}>
        <Legend items={[{ label: t(locale, 'cash_position'), tone: 'ink' }, { label: t(locale, 'monthly_net'), tone: 'muted', dash: true }]} />
        <div className="mt-2"><LineChart points={[{ x: 0, cash: -s.investmentTotal, net: 0 }, ...s.months.map((m) => ({ x: m.m, cash: m.cash, net: m.net }))]} series={[{ key: 'net', label: t(locale, 'monthly_net'), tone: 'muted', dash: '3 3', width: 1.5 }, { key: 'cash', label: t(locale, 'cash_position'), tone: 'ink' }]} xLabel={t(locale, 'unit_month')} xFmt={(v) => String(v)} yFmt={fmtMoneyK} yFmtFull={fmtMoney} marker={s.minCashMonth} markerLabel={`${t(locale, 'kpi_funding_need').toLowerCase()} ${fmtMoneyK(s.fundingNeed)}`} tipTitle={(p) => (p.x === 0 ? `${t(locale, 'month_n', { n: 0 })}, ${t(locale, 'investment').toLowerCase()}` : t(locale, 'month_n', { n: p.x }))} /></div>
      </Panel>
    </div>
  );
}

export function MixPanels({ model, state, s, locale }: { model: ModelDefinition; state: ModelState; s: Summary; locale: Locale }) {
  const { fmtMoney, fmtNum, fmtPct } = makeFormatters(model.currencySymbol ?? '');
  const unit = model.unitLabel ?? 'units';
  const ref = s.ref;
  const gens = model.generators;
  const maxRev = Math.max(...gens.map((g) => ref.gens[g.id]?.revenue ?? 0), 1);
  const rows: { label: string; amount: number; kind: 'fixed' | 'variable' }[] = [];
  gens.forEach((g) => { const c = ref.gens[g.id]?.cost ?? 0; if (c > 0) rows.push({ label: `${g.short ?? g.name} ${t(locale, 'own_costs').toLowerCase()}`, amount: c, kind: 'variable' }); });
  (model.genericVariable ?? []).forEach((c) => { const r = ref.gens[c.id]; if (r && r.cost > 0) rows.push({ label: c.label, amount: r.cost, kind: 'variable' }); });
  (model.fixedCosts ?? []).forEach((f) => { const v = state.fixed[f.id] ?? 0; if (v > 0 && s.refMonth >= (f.startMonth ?? 1)) rows.push({ label: f.label, amount: v, kind: 'fixed' }); });
  rows.sort((a, b) => b.amount - a.amount);
  const maxCost = Math.max(...rows.map((r) => r.amount), 1);
  const totalOwn = gens.reduce((a, g) => a + (ref.gens[g.id]?.cost ?? 0), 0);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title={t(locale, 'cost_structure_at_month', { n: s.refMonth })} help={t(locale, 'cost_help')}>
        <table className="w-full border-collapse text-[13px]"><thead><tr><th className={th}>{t(locale, 'cost_line')}</th><th className={th} /><th className={`${th} text-right`}>{t(locale, 'per_month')}</th><th className={th} style={{ width: '22%' }} /><th className={`${th} text-right`}>{t(locale, 'share')}</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.label}><td className={td}>{r.label}</td><td className={td}><span className={`${PILL} ${PILL_TONE.neutral}`}>{t(locale, r.kind)}</span></td><td className={`${td} ${num}`}>{fmtMoney(r.amount)}</td><td className={td}><Bar pct={(r.amount / maxCost) * 100} /></td><td className={`${td} ${num}`}>{fmtPct((r.amount / (ref.totalCost || 1)) * 100)}</td></tr>)}</tbody>
          <tfoot><tr className="font-medium"><td className="px-2 py-1.5">{t(locale, 'total_cost')}</td><td /><td className={`px-2 py-1.5 ${num}`}>{fmtMoney(ref.totalCost)}</td><td /><td className={`px-2 py-1.5 ${num}`}>{fmtPct((ref.totalCost / (ref.revenue || 1)) * 100)} {t(locale, 'of_revenue')}</td></tr></tfoot>
        </table>
      </Panel>
      <Panel title={t(locale, 'generators_at_month', { n: s.refMonth })} help={t(locale, 'generators_help')}>
        <table className="w-full border-collapse text-[13px]"><thead><tr><th className={th}>{t(locale, 'generator')}</th><th className={`${th} text-right`}>{cap(unit)}</th><th className={`${th} text-right`}>{t(locale, 'revenue')}</th><th className={th} style={{ width: '22%' }} /><th className={`${th} text-right`}>{t(locale, 'own_costs')}</th><th className={`${th} text-right`}>{t(locale, 'margin')}</th></tr></thead>
          <tbody>{gens.map((g) => { const r = ref.gens[g.id]!; const m = r.revenue - r.cost; return <tr key={g.id}><td className={td}>{g.short ?? g.name}</td><td className={`${td} ${num}`}>{g.countsAsUnit === false ? '' : fmtNum(r.units)}</td><td className={`${td} ${num}`}>{fmtMoney(r.revenue)}</td><td className={td}><Bar pct={(r.revenue / maxRev) * 100} /></td><td className={`${td} ${num}`}>{fmtMoney(r.cost)}</td><td className={`${td} ${num} ${m < 0 ? NEG : ''}`}>{fmtMoney(m)}</td></tr>; })}</tbody>
          <tfoot><tr className="font-medium"><td className="px-2 py-1.5">{t(locale, 'total')}</td><td className={`px-2 py-1.5 ${num}`}>{fmtNum(ref.units)}</td><td className={`px-2 py-1.5 ${num}`}>{fmtMoney(ref.revenue)}</td><td /><td className={`px-2 py-1.5 ${num}`}>{fmtMoney(totalOwn)}</td><td className={`px-2 py-1.5 ${num}`}>{fmtMoney(ref.revenue - totalOwn)}</td></tr></tfoot>
        </table>
      </Panel>
    </div>
  );
}

export function ProjectionPanel({ model, s, locale }: { model: ModelDefinition; s: Summary; locale: Locale }) {
  const { fmtMoney, fmtNum } = makeFormatters(model.currencySymbol ?? '');
  const unit = model.unitLabel ?? 'units';
  const [detail, setDetail] = useState(false);
  const gens = model.generators;
  type Col = { label: string; cell: (m: Summary['months'][number]) => ReactNode; group?: boolean; left?: boolean };
  const cols: Col[] = [{ label: t(locale, 'month'), cell: (m) => m.m, left: true }, { label: cap(unit), cell: (m) => fmtNum(m.units) }];
  if (detail) gens.forEach((g) => cols.push({ label: `${g.short ?? g.name} ${t(locale, 'revenue').toLowerCase()}`, cell: (m) => fmtMoney(m.gens[g.id]?.revenue ?? 0) }));
  cols.push({ label: t(locale, 'revenue'), cell: (m) => fmtMoney(m.revenue), group: true });
  if (detail) gens.forEach((g) => cols.push({ label: `${g.short ?? g.name} ${t(locale, 'own_costs').toLowerCase()}`, cell: (m) => fmtMoney(m.gens[g.id]?.cost ?? 0) }));
  cols.push(
    { label: t(locale, 'variable_cost'), cell: (m) => fmtMoney(m.variableCost), group: detail },
    { label: t(locale, 'fixed_cost'), cell: (m) => fmtMoney(m.fixedCost) },
    { label: t(locale, 'total_cost'), cell: (m) => fmtMoney(m.totalCost) },
    { label: t(locale, 'net_result'), cell: (m) => <span className={m.net < 0 ? NEG : ''}>{fmtMoney(m.net)}</span>, group: true },
    { label: t(locale, 'cash_position'), cell: (m) => <span className={m.cash < 0 ? NEG : ''}>{fmtMoney(m.cash)}</span> },
  );
  return (
    <Panel id="projection" title={t(locale, 'monthly_projection')} help={t(locale, 'projection_help', { n: s.horizon })} actions={<label className="flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-ink-subtle"><input type="checkbox" checked={detail} onChange={(e) => setDetail(e.target.checked)} /> {t(locale, 'by_generator')}</label>}>
      <div className="-mx-4 max-h-[420px] overflow-auto border-t border-line px-4">
        <table className="w-full border-collapse whitespace-nowrap text-[12.5px]">
          <thead><tr>{cols.map((c, i) => <th key={i} className={`sticky top-0 z-[2] bg-surface-raised px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-muted border-b border-line ${c.left ? 'left-0 z-[3] text-left' : 'text-right'} ${c.group ? 'border-l border-line' : ''}`}>{c.label}</th>)}</tr></thead>
          <tbody>{s.months.map((m) => <tr key={m.m} className={m.m === s.refMonth ? 'bg-surface-sunken' : ''}>{cols.map((c, i) => <td key={i} className={`px-2.5 py-1.5 tabular-nums border-b border-line/60 ${c.left ? `sticky left-0 z-[1] text-left ${m.m === s.refMonth ? 'bg-surface-sunken' : 'bg-surface-raised'}` : 'text-right'} ${c.group ? 'border-l border-line' : ''}`}>{c.cell(m)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </Panel>
  );
}
