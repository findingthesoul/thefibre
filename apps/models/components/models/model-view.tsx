'use client';

// One business model: the canvas, the results, the inputs. State lives here;
// every change recalculates in the browser and is saved for the whole team
// through a server action, debounced.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Download, Printer, RotateCcw, ChevronLeft } from 'lucide-react';
import { Button } from '@thefibre/shared/ui/button';
import { PageContainer } from '@thefibre/shared/ui/page';
import { CHIP, CHIP_STATE, NOTICE, PILL, PILL_TONE, SECTION_LABEL } from '@thefibre/shared/ui/recipes';
import { defaultState, mergeState, summarize, type ModelDefinition, type ModelState } from '@/lib/engine';
import { makeFormatters, singular } from '@/lib/format';
import { t, type Locale } from '@/lib/i18n-ui';
import type { ModelRow } from '@/app/(app)/models/actions';
import { saveInputs } from '@/app/(app)/models/actions';
import { BusinessModelCanvas } from './canvas';
import { Kpis, YearsPanels, ChartPanels, MixPanels, ProjectionPanel } from './results';
import { InputPanels, type Scope } from './inputs';

type SavedInputs = Partial<ModelState> & { refMonth?: number; horizon?: number };

export function ModelView({ model: row, locale }: { model: ModelRow; locale: Locale }) {
  const def: ModelDefinition = row.definition;
  const saved = (row.inputs ?? {}) as SavedInputs;
  const [state, setState] = useState<ModelState>(() => mergeState(defaultState(def), saved));
  const [refMonth, setRefMonth] = useState<number>(typeof saved.refMonth === 'number' ? saved.refMonth : (def.breakEvenMonth ?? 12));
  const [horizon, setHorizon] = useState<number>(typeof saved.horizon === 'number' ? saved.horizon : (def.horizon ?? 36));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const s = useMemo(() => summarize(def, state, { horizon, refMonth: Math.min(refMonth, horizon) }), [def, state, horizon, refMonth]);
  const { fmtMoney } = makeFormatters(def.currencySymbol ?? '');

  // Debounced save of the whole inputs blob; the last write wins.
  useEffect(() => {
    if (!dirty.current) return;
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await saveInputs(row.id, { ...state, refMonth, horizon });
      setStatus(r.error ? 'error' : 'saved');
      if (!r.error) setTimeout(() => setStatus((st) => (st === 'saved' ? 'idle' : st)), 1500);
    }, 800);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [state, refMonth, horizon, row.id]);

  function change(scope: Scope, id: string, value: number) {
    dirty.current = true;
    setState((st) => {
      const next: ModelState = { ...st, settings: { ...st.settings }, fixed: { ...st.fixed }, investment: { ...st.investment }, generators: { ...st.generators } };
      if (typeof scope === 'string') next[scope][id] = value;
      else next.generators[scope.gen] = { ...(next.generators[scope.gen] ?? {}), [id]: value };
      return next;
    });
  }
  function reset() {
    if (!confirm(t(locale, 'reset_confirm'))) return;
    dirty.current = true;
    setState(defaultState(def));
    setRefMonth(def.breakEvenMonth ?? 12);
    setHorizon(def.horizon ?? 36);
  }
  function exportCsv() {
    const gens = def.generators;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const rows: (string | number)[][] = [[t(locale, 'month'), def.unitLabel ?? 'units', ...gens.map((g) => `${g.short ?? g.name} revenue`), 'revenue', ...gens.map((g) => `${g.short ?? g.name} costs`), 'variable cost', 'fixed cost', 'total cost', 'net result', 'cash position']];
    s.months.forEach((m) => rows.push([m.m, r2(m.units), ...gens.map((g) => r2(m.gens[g.id]?.revenue ?? 0)), r2(m.revenue), ...gens.map((g) => r2(m.gens[g.id]?.cost ?? 0)), r2(m.variableCost), r2(m.fixedCost), r2(m.totalCost), r2(m.net), r2(m.cash)]));
    const csv = rows.map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${row.slug}-projection.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const nav = [
    { href: '#canvas', label: t(locale, 'canvas') }, { href: '#overview', label: t(locale, 'overview') }, { href: '#breakeven', label: t(locale, 'break_even') }, { href: '#projection', label: t(locale, 'projection') },
    { href: '#generators', label: t(locale, 'turnover_generators') }, { href: '#fixed', label: t(locale, 'generic_costs') }, { href: '#investment', label: t(locale, 'investment') }, { href: '#settings', label: t(locale, 'settings') },
  ];
  const unit = def.unitLabel ?? 'units';

  return (
    <PageContainer max="full">
      <div className="print:hidden">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-ink-subtle hover:text-ink"><ChevronLeft size={16} />{t(locale, 'nav_models')}</Link>
        <header className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-medium tracking-tight">{row.name}</h1>
            <p className="mt-1 max-w-[72ch] text-sm text-ink-subtle">{def.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`${PILL} ${PILL_TONE.neutral}`}>{row.team?.name ?? t(locale, 'workspace_wide')}</span>
              {def.tagline && <span className="text-xs italic text-ink-muted">{def.tagline}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-subtle" aria-live="polite">{status === 'saving' ? t(locale, 'saving') : status === 'saved' ? t(locale, 'saved') : ''}</span>
            <Button variant="secondary" size="sm" onClick={() => window.print()} leading={<Printer size={14} />}>{t(locale, 'print_canvas')}</Button>
            <Button variant="secondary" size="sm" onClick={exportCsv} leading={<Download size={14} />}>{t(locale, 'export_csv')}</Button>
            <Button variant="secondary" size="sm" onClick={reset} leading={<RotateCcw size={14} />}>{t(locale, 'reset')}</Button>
          </div>
        </header>
        {status === 'error' && <div className={`${NOTICE.error} mt-3`}>{t(locale, 'save_failed')}</div>}
        {!row.may_shape && <div className={`${NOTICE.info} mt-3`}>{t(locale, 'read_only_hint')}</div>}
        <nav className="sticky top-0 z-20 -mx-4 mt-4 flex gap-2 overflow-x-auto bg-surface-sunken/95 px-4 py-2 backdrop-blur sm:-mx-8 sm:px-8">
          {nav.map((n) => <a key={n.href} href={n.href} className={`${CHIP} ${CHIP_STATE.off} whitespace-nowrap`}>{n.label}</a>)}
        </nav>
        <div className={`${SECTION_LABEL} mt-6 mb-3 flex items-center gap-3 after:h-px after:flex-1 after:bg-line`}>{t(locale, 'business_model_canvas')}</div>
      </div>
      <BusinessModelCanvas model={def} state={state} s={s} locale={locale} />
      <div className="print:hidden">
        <div className={`${SECTION_LABEL} mt-10 mb-3 flex items-center gap-3 after:h-px after:flex-1 after:bg-line`}>{t(locale, 'results')}</div>
        <Kpis model={def} s={s} locale={locale} />
        <YearsPanels model={def} s={s} locale={locale} />
        <ChartPanels model={def} s={s} locale={locale} />
        <MixPanels model={def} state={state} s={s} locale={locale} />
        <ProjectionPanel model={def} s={s} locale={locale} />
        <InputPanels model={def} state={state} s={s} locale={locale} refMonth={Math.min(refMonth, horizon)} horizon={horizon} onChange={change} onRefMonth={(v) => { dirty.current = true; setRefMonth(v); }} onHorizon={(v) => { dirty.current = true; setHorizon(v); }} />
        <footer className="mt-10 max-w-[80ch] text-[12.5px] text-ink-muted">
          <b className="font-medium text-ink">{t(locale, 'how_it_works_title')}</b> {t(locale, 'how_it_works', { units: unit, unit: singular(unit) })} {fmtMoney(0).slice(0, 0)}
        </footer>
      </div>
    </PageContainer>
  );
}
