'use client';

// Inputs per period (Sjoerd, 2026-09-26: "change the amounts of input (input
// of clients) per period, of the various types"). A grid: a row per segment
// with the new clients you type for a month, the resulting clients under it;
// a row per funnel step with its rate for a month. A typed cell replaces the
// formula for that month (churn still applies); months between two typed
// cells run in a straight line; before the first and after the last the
// formula rules. Empty the cell to go back to the formula.

import { Fragment } from 'react';
import { CARD, SECTION_LABEL } from '@thefibre/shared/ui/recipes';
import { typedForMonth, type ModelDefinition, type ModelState, type Summary } from '@/lib/engine';
import { transitionLabel } from '@/lib/links';
import { makeFormatters } from '@/lib/format';
import { t, type Locale } from '@/lib/i18n-ui';

export function PeriodsGrid({ model, state, s, locale, onCell }: {
  model: ModelDefinition; state: ModelState; s: Summary; locale: Locale;
  onCell: (kind: 'periods' | 'periodRates', id: string, month: number, value: number | null) => void;
}) {
  const { fmtNum } = makeFormatters(model.currencySymbol ?? '');
  const months = s.months.map((m) => m.m);
  const segs = model.generators.filter((g) => g.countsAsUnit !== false && !g.volume?.linkedTo);
  const flows = model.transitions ?? [];
  const cell = 'h-7 w-16 rounded border border-line bg-surface-raised px-1 text-right text-[12px] tabular-nums focus:border-line-strong focus:outline-none placeholder:text-ink-muted';
  const th = 'sticky top-0 z-[2] border-b border-line bg-surface-raised px-1.5 py-1.5 text-center text-[11px] font-medium text-ink-muted';
  const first = 'sticky left-0 z-[1] border-b border-line/60 bg-surface-raised px-3 py-1 text-left text-[12.5px]';
  const yearEdge = (m: number) => (m % 12 === 1 && m > 1 ? 'border-l-2 border-l-line-strong' : '');
  const input = (kind: 'periods' | 'periodRates', id: string, m: number, placeholder: string, step: number) => {
    const cells = kind === 'periods' ? state.periods[id] : state.periodRates[id];
    const typed = cells?.[String(m)];
    const interpolated = typed == null ? typedForMonth(cells, m) : null;
    return (
      <input type="number" step={step} value={typed ?? ''} placeholder={interpolated != null ? fmtNum(interpolated) : placeholder} title={interpolated != null ? t(locale, 'interpolated') : undefined}
        onChange={(e) => { const v = e.target.value; onCell(kind, id, m, v === '' ? null : Number.isFinite(parseFloat(v)) ? parseFloat(v) : null); }}
        className={`${cell} ${typed != null ? 'font-medium text-ink' : interpolated != null ? 'italic text-ink-subtle' : 'text-ink-subtle'}`} />
    );
  };
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
        <div><h2 className="text-[15px] font-medium tracking-tight">{t(locale, 'periods_title')}</h2><p className="mt-0.5 text-[12.5px] text-ink-muted">{t(locale, 'periods_help')}</p></div>
      </div>
      <div className="mt-3 max-h-[60vh] overflow-auto border-t border-line">
        <table className="border-collapse whitespace-nowrap">
          <thead><tr><th className={`${th} sticky left-0 z-[3] text-left`}>{t(locale, 'unit_month')}</th>{months.map((m) => <th key={m} className={`${th} ${yearEdge(m)}`}>{m}</th>)}</tr></thead>
          <tbody>
            <tr><td colSpan={months.length + 1} className={`${SECTION_LABEL} sticky left-0 border-b border-line bg-surface-sunken px-3 py-1`}>{t(locale, 'customer_segments')}</td></tr>
            {segs.map((g) => (
              <Fragment key={g.id}>
                <tr>
                  <td className={first}><span className="block font-medium">{g.short ?? g.name}</span><span className="block text-[11px] text-ink-muted">{t(locale, 'new_clients_typed')}</span></td>
                  {months.map((m) => { const row = s.months[m - 1]!; const prev = m > 1 ? s.months[m - 2]!.gens[g.id]!.units : 0; const churn = 0; const formulaNew = m === 1 ? row.gens[g.id]!.units : row.gens[g.id]!.units - prev * (1 - churn) - row.gens[g.id]!.inflow + row.gens[g.id]!.outflow; return <td key={m} className={`border-b border-line/60 px-1 py-0.5 ${yearEdge(m)}`}>{input('periods', g.id, m, fmtNum(Math.max(formulaNew, 0)), 1)}</td>; })}
                </tr>
                <tr>
                  <td className={`${first} text-[11px] text-ink-muted`}>{t(locale, 'clients_result')}</td>
                  {months.map((m) => <td key={m} className={`border-b border-line/60 px-1.5 py-0.5 text-right text-[11px] tabular-nums text-ink-muted ${yearEdge(m)}`}>{fmtNum(s.months[m - 1]!.gens[g.id]!.units)}</td>)}
                </tr>
              </Fragment>
            ))}
            {flows.length > 0 && <tr><td colSpan={months.length + 1} className={`${SECTION_LABEL} sticky left-0 border-b border-line bg-surface-sunken px-3 py-1`}>{t(locale, 'funnel')}</td></tr>}
            {flows.map((tr) => (
              <tr key={tr.id}>
                <td className={first}><span className="block font-medium">{transitionLabel(model, tr)}</span><span className="block text-[11px] text-ink-muted">{t(locale, 'rate_per_month')}</span></td>
                {months.map((m) => <td key={m} className={`border-b border-line/60 px-1 py-0.5 ${yearEdge(m)}`}>{input('periodRates', tr.id, m, String(state.transitions[tr.id] ?? tr.rate), 0.5)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
