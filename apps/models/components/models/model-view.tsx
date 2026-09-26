'use client';

// One business model, two tabs. Canvas: the nine blocks, full height,
// editable by admins and team leads. Numbers: a view on top (break even and
// cash, or projection and overview) and, underneath, the canvas as columns —
// element, the turnover and cost items, the variables — edited in place.
// State lives here; every change recalculates in the browser and is saved
// for the whole team through server actions, debounced.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Download, Printer, RotateCcw, ChevronLeft } from 'lucide-react';
import { Button } from '@thefibre/shared/ui/button';
import { PageContainer } from '@thefibre/shared/ui/page';
import { Tabs } from '@thefibre/shared/ui/tabs';
import { InfoHint } from '@thefibre/shared/ui/info-hint';
import { CHIP, CHIP_STATE, NOTICE, PILL, PILL_TONE } from '@thefibre/shared/ui/recipes';
import { defaultState, mergeState, summarize, itemObj, type CanvasBlockKey, type CanvasItem, type ModelDefinition, type ModelState } from '@/lib/engine';
import type { Scope } from '@/lib/links';
import { t, type Locale } from '@/lib/i18n-ui';
import type { ModelRow } from '@/app/(app)/models/actions';
import { saveInputs, updateModel } from '@/app/(app)/models/actions';
import { BusinessModelCanvas } from './canvas';
import { CanvasEditor } from './canvas-editor';
import { SegmentEditor, StreamEditor, ResourcesEditor, SettingsEditor } from './editors';
import { newSegment, newStream, removeGenerator, upsertGenerator } from '@/lib/structure';
import { Kpis, YearsPanels, ChartPanels, MixPanels, ProjectionPanel } from './results';
import { ColumnsDrawer } from './columns-drawer';
import { SortablePanels } from './sortable-panels';

type SavedInputs = Partial<ModelState> & { refMonth?: number; horizon?: number };

/** Fills the window from where it sits to the bottom, so the drawer inside
 *  it is always at the bottom and the views scroll above it. */
function FillToBottom({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  useLayoutEffect(() => {
    const measure = () => { if (ref.current) setTop(ref.current.getBoundingClientRect().top); };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  return <div ref={ref} className={className} style={{ height: `calc(100dvh - ${Math.round(top)}px)` }}>{children}</div>;
}
type Tab = 'canvas' | 'numbers';
type View = 'bep' | 'projection';

export function ModelView({ model: row, locale }: { model: ModelRow; locale: Locale }) {
  const [def, setDef] = useState<ModelDefinition>(row.definition);
  const saved = (row.inputs ?? {}) as SavedInputs;
  const [state, setState] = useState<ModelState>(() => mergeState(defaultState(row.definition), saved));
  const [refMonth, setRefMonth] = useState<number>(typeof saved.refMonth === 'number' ? saved.refMonth : (row.definition.breakEvenMonth ?? 12));
  const [horizon, setHorizon] = useState<number>(typeof saved.horizon === 'number' ? saved.horizon : (row.definition.horizon ?? 36));
  const [tab, setTab] = useState<Tab>('canvas');
  const [view, setView] = useState<View>('bep');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [editing, setEditing] = useState<{ block: CanvasBlockKey; index: number | null } | null>(null);
  const [structure, setStructure] = useState<{ kind: 'segment' | 'stream'; id: string | null } | { kind: 'resources' | 'settings' } | null>(null);
  const inputsDirty = useRef(false);
  const defDirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const s = useMemo(() => summarize(def, state, { horizon, refMonth: Math.min(refMonth, horizon) }), [def, state, horizon, refMonth]);

  // Debounced save of whatever changed: the inputs blob, the definition, or both.
  useEffect(() => {
    if (!inputsDirty.current && !defDirty.current) return;
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const jobs: Promise<{ error?: string }>[] = [];
      if (inputsDirty.current) { inputsDirty.current = false; jobs.push(saveInputs(row.id, { ...state, refMonth, horizon })); }
      if (defDirty.current) { defDirty.current = false; jobs.push(updateModel(row.id, { definition: def })); }
      const results = await Promise.all(jobs);
      const err = results.find((r) => r.error);
      setStatus(err ? 'error' : 'saved');
      if (!err) setTimeout(() => setStatus((st) => (st === 'saved' ? 'idle' : st)), 1500);
    }, 800);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [state, refMonth, horizon, def, row.id]);

  function change(scope: Scope, id: string, value: number) {
    inputsDirty.current = true;
    setState((st) => {
      const next: ModelState = { ...st, settings: { ...st.settings }, fixed: { ...st.fixed }, investment: { ...st.investment }, generators: { ...st.generators } };
      if (typeof scope === 'string') next[scope][id] = value;
      else next.generators[scope.gen] = { ...(next.generators[scope.gen] ?? {}), [id]: value };
      return next;
    });
  }
  function patchDef(next: ModelDefinition) {
    defDirty.current = true;
    setDef(next);
    // New generators need their default numbers in the state, or every field shows 0.
    setState((st) => mergeState(defaultState(next), st));
  }
  function setItems(block: CanvasBlockKey, items: CanvasItem[]) {
    defDirty.current = true;
    setDef((d) => ({ ...d, canvas: { ...(d.canvas ?? {}), [block]: items } }));
  }
  function reset() {
    if (!confirm(t(locale, 'reset_confirm'))) return;
    inputsDirty.current = true;
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

  const editable = row.may_shape;
  const editingItem = editing && editing.index !== null ? (def.canvas?.[editing.block]?.[editing.index] ?? null) : null;

  return (
    <PageContainer max="full">
      <div className="print:hidden">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/dashboard" className="inline-flex items-center text-ink-subtle hover:text-ink" title={t(locale, 'nav_models')}><ChevronLeft size={18} /></Link>
            <h1 className="truncate text-xl font-medium tracking-tight">{row.name}</h1>
            <span className={`${PILL} ${PILL_TONE.neutral} shrink-0`}>{row.team?.name ?? t(locale, 'workspace_wide')}</span>
            {(def.description || def.tagline) && (
              <InfoHint label={t(locale, 'about_this_model')}>
                {def.description}{def.tagline && <span className="italic text-ink-muted"> · {def.tagline}</span>}
              </InfoHint>
            )}
            <span className="text-xs text-ink-subtle" aria-live="polite">{status === 'saving' ? t(locale, 'saving') : status === 'saved' ? t(locale, 'saved') : ''}</span>
          </div>
          <div className="flex items-center gap-1">
            <Tabs value={tab} onChange={setTab} tabs={[{ value: 'canvas', label: t(locale, 'tab_canvas') }, { value: 'numbers', label: t(locale, 'tab_numbers') }]} className="border-b-0" />
            <Button variant="ghost" size="icon" onClick={() => window.print()} title={t(locale, 'print_canvas')}><Printer size={16} /></Button>
            <Button variant="ghost" size="icon" onClick={exportCsv} title={t(locale, 'export_csv')}><Download size={16} /></Button>
            <Button variant="ghost" size="icon" onClick={reset} title={t(locale, 'reset')}><RotateCcw size={16} /></Button>
          </div>
        </header>
        {status === 'error' && <div className={`${NOTICE.error} mt-3`}>{t(locale, 'save_failed')}</div>}
        {!editable && <div className={`${NOTICE.info} mt-3`}>{t(locale, 'read_only_hint')}</div>}
      </div>

      {tab === 'canvas' && (
        <div className="mt-3">
          <BusinessModelCanvas model={def} state={state} s={s} locale={locale} tall editable={editable} edit={{
            onEditItem: (block, index) => setEditing({ block, index }),
            onAddItem: (block) => setEditing({ block, index: null }),
            onEditSegment: (id) => setStructure({ kind: 'segment', id }),
            onEditStream: (id) => setStructure({ kind: 'stream', id }),
            onEditResources: () => setStructure({ kind: 'resources' }),
            onEditSettings: () => setStructure({ kind: 'settings' }),
          }} />
        </div>
      )}

      {tab === 'numbers' && (
        <FillToBottom className="mt-3 flex flex-col print:hidden">
          <div className="flex flex-wrap gap-2">
            {(['bep', 'projection'] as View[]).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={`${CHIP} ${view === v ? CHIP_STATE.on : CHIP_STATE.off}`}>{t(locale, v === 'bep' ? 'view_bep_cash' : 'view_projection')}</button>
            ))}
          </div>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pb-4 pl-0 lg:pl-5">
            {view === 'bep' ? (
              <SortablePanels key="bep" storageKey={`bm-order-${row.id}-bep`} title={t(locale, 'drag_to_reorder')} panels={[
                { id: 'kpis', node: <Kpis model={def} s={s} locale={locale} /> },
                { id: 'charts', node: <ChartPanels model={def} s={s} locale={locale} /> },
              ]} />
            ) : (
              <SortablePanels key="projection" storageKey={`bm-order-${row.id}-projection`} title={t(locale, 'drag_to_reorder')} panels={[
                { id: 'years', node: <YearsPanels model={def} s={s} locale={locale} /> },
                { id: 'mix', node: <MixPanels model={def} state={state} s={s} locale={locale} /> },
                { id: 'projection', node: <ProjectionPanel model={def} s={s} locale={locale} /> },
              ]} />
            )}
          </div>
          <ColumnsDrawer model={def} state={state} s={s} locale={locale} refMonth={Math.min(refMonth, horizon)} horizon={horizon} onChange={change} onRefMonth={(v) => { inputsDirty.current = true; setRefMonth(v); }} onHorizon={(v) => { inputsDirty.current = true; setHorizon(v); }} />
        </FillToBottom>
      )}

      {structure?.kind === 'segment' && (
        <SegmentEditor open def={def} locale={locale} gen={structure.id ? (def.generators.find((g) => g.id === structure.id) ?? null) : null} onClose={() => setStructure(null)}
          onSave={(g) => { const fresh = g.id ? g : { ...newSegment(def, g.name), name: g.name, short: g.short, segment: g.segment, help: g.help }; patchDef(upsertGenerator(def, fresh)); setStructure(null); }}
          onDelete={() => { if (structure.id) patchDef(removeGenerator(def, structure.id)); setStructure(null); }} />
      )}
      {structure?.kind === 'stream' && (
        <StreamEditor open def={def} locale={locale} gen={structure.id ? (def.generators.find((g) => g.id === structure.id) ?? null) : null} onClose={() => setStructure(null)}
          onSave={(g) => { const fresh = g.id ? g : { ...g, id: newStream(def, g.name, null).id }; patchDef(upsertGenerator(def, fresh)); setStructure(null); }}
          onDelete={() => { if (structure.id) patchDef(removeGenerator(def, structure.id)); setStructure(null); }} />
      )}
      {structure?.kind === 'resources' && (
        <ResourcesEditor open def={def} locale={locale} onClose={() => setStructure(null)} onSave={(patch) => { patchDef({ ...def, ...patch }); setStructure(null); }} />
      )}
      {structure?.kind === 'settings' && (
        <SettingsEditor open def={def} locale={locale} onClose={() => setStructure(null)} onSave={(patch) => { patchDef({ ...def, ...patch }); setStructure(null); }} />
      )}
      {editing && (
        <CanvasEditor
          open
          def={def}
          block={editing.block}
          item={editingItem}
          locale={locale}
          onClose={() => setEditing(null)}
          onSave={(item) => {
            const items = [...(def.canvas?.[editing.block] ?? [])].map(itemObj);
            if (editing.index === null) items.push(item); else items[editing.index] = item;
            setItems(editing.block, items);
            setEditing(null);
          }}
          onDelete={() => {
            const items = [...(def.canvas?.[editing.block] ?? [])];
            if (editing.index !== null) items.splice(editing.index, 1);
            setItems(editing.block, items);
            setEditing(null);
          }}
        />
      )}
    </PageContainer>
  );
}
