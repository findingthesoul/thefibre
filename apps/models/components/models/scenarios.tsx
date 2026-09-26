'use client';

// Scenarios: a named copy of the numbers (every variable, the typed months,
// horizon and reference month). Save the current numbers under a name, load
// one back, compare them side by side on the figures that matter. The
// definition is shared by all scenarios; only the numbers differ.

import { useMemo, useState } from 'react';
import { Button } from '@thefibre/shared/ui/button';
import { TextField } from '@thefibre/shared/ui/fields';
import { CARD, ERROR_TEXT, PILL, PILL_TONE } from '@thefibre/shared/ui/recipes';
import { mergeState, defaultState, summarize, type ModelDefinition, type ModelState } from '@/lib/engine';
import { makeFormatters } from '@/lib/format';
import { t, type Locale } from '@/lib/i18n-ui';

export type Scenario = { id: string; name: string; savedAt: string; inputs: Partial<ModelState> & { refMonth?: number; horizon?: number } };

export function ScenariosPanel({ model, state, refMonth, horizon, scenarios, locale, onSave, onLoad, onDelete }: {
  model: ModelDefinition; state: ModelState; refMonth: number; horizon: number; scenarios: Scenario[]; locale: Locale;
  onSave: (name: string) => void; onLoad: (sc: Scenario) => void; onDelete: (sc: Scenario) => void;
}) {
  const [name, setName] = useState('');
  const { fmtMoneyK, fmtNum } = makeFormatters(model.currencySymbol ?? '');
  const unit = model.unitLabel ?? 'units';
  const rows = useMemo(() => {
    const cur = { id: '__current', name: t(locale, 'current_numbers'), s: summarize(model, state, { horizon, refMonth: Math.min(refMonth, horizon) }) };
    const saved = scenarios.map((sc) => {
      const st = mergeState(defaultState(model), sc.inputs);
      const h = typeof sc.inputs.horizon === 'number' ? sc.inputs.horizon : (model.horizon ?? 36);
      const r = typeof sc.inputs.refMonth === 'number' ? sc.inputs.refMonth : (model.breakEvenMonth ?? 12);
      return { id: sc.id, name: sc.name, s: summarize(model, st, { horizon: h, refMonth: Math.min(r, h) }) };
    });
    return [cur, ...saved];
  }, [model, state, refMonth, horizon, scenarios, locale]);
  const th = 'px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-ink-muted border-b border-line';
  const td = 'px-3 py-2 border-b border-line/60 tabular-nums text-right whitespace-nowrap';
  const cols: { label: string; cell: (s: ReturnType<typeof summarize>) => string }[] = [
    { label: t(locale, 'kpi_break_even_month'), cell: (s) => (s.breakEvenMonth ? t(locale, 'month_n', { n: s.breakEvenMonth }) : '—') },
    { label: t(locale, 'kpi_break_even_units', { units: unit }), cell: (s) => (s.breakEvenUnits != null ? fmtNum(s.breakEvenUnits) : '—') },
    { label: t(locale, 'kpi_funding_need'), cell: (s) => fmtMoneyK(s.fundingNeed) },
    { label: t(locale, 'kpi_cash_positive'), cell: (s) => (s.cashPositiveMonth ? t(locale, 'month_n', { n: s.cashPositiveMonth }) : '—') },
    { label: t(locale, 'kpi_revenue_month', { n: refMonth }), cell: (s) => fmtMoneyK(s.ref.revenue) },
    { label: t(locale, 'kpi_net_month', { n: refMonth }), cell: (s) => fmtMoneyK(s.ref.net) },
    { label: t(locale, 'turnover_year_n', { n: rows[0]!.s.years.length }), cell: (s) => fmtMoneyK(s.years[s.years.length - 1]?.revenue ?? 0) },
    { label: t(locale, 'cash_year_end'), cell: (s) => fmtMoneyK(s.last.cash) },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className={`${CARD} p-4`}>
        <h2 className="text-[15px] font-medium tracking-tight">{t(locale, 'scenarios_title')}</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">{t(locale, 'scenarios_help')}</p>
        <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onSave(name.trim()); setName(''); } }}>
          <div className="min-w-[16rem] flex-1"><TextField label={t(locale, 'scenario_name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t(locale, 'scenario_name_ph')} /></div>
          <Button variant="primary" type="submit" disabled={!name.trim()}>{t(locale, 'save_scenario')}</Button>
        </form>
        {scenarios.length > 0 && (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {scenarios.map((sc) => (
              <li key={sc.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0"><span className="font-medium">{sc.name}</span><span className="ml-2 text-xs text-ink-muted">{new Date(sc.savedAt).toLocaleString()}</span></span>
                <span className="flex gap-1.5">
                  <Button variant="secondary" size="sm" onClick={() => { if (confirm(t(locale, 'load_scenario_confirm', { n: sc.name }))) onLoad(sc); }}>{t(locale, 'load_scenario')}</Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm(t(locale, 'delete_scenario_confirm', { n: sc.name }))) onDelete(sc); }}>{t(locale, 'delete')}</Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {scenarios.length === 0 && <p className={`mt-3 text-xs text-ink-muted`}>{t(locale, 'no_scenarios')}</p>}
      </div>
      <div className={`${CARD} overflow-hidden`}>
        <div className="px-4 pt-3.5"><h2 className="text-[15px] font-medium tracking-tight">{t(locale, 'compare_scenarios')}</h2></div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead><tr><th className={th}>{t(locale, 'scenario')}</th>{cols.map((c) => <th key={c.label} className={`${th} text-right`}>{c.label}</th>)}</tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id} className={r.id === '__current' ? 'bg-surface-sunken' : ''}><td className="border-b border-line/60 px-3 py-2">{r.name}{r.id === '__current' && <span className={`${PILL} ${PILL_TONE.neutral} ml-2`}>{t(locale, 'now')}</span>}</td>{cols.map((c) => <td key={c.label} className={`${td} ${c.cell(r.s).startsWith('-') ? ERROR_TEXT.replace('text-sm ', '') : ''}`}>{c.cell(r.s)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
