'use client';

// One business model, two tabs. Canvas: the nine blocks, full height,
// editable by admins and team leads. Numbers: a view on top (break even and
// cash, or projection and overview) and, underneath, the canvas as columns —
// element, the turnover and cost items, the variables — edited in place.
// State lives here; every change recalculates in the browser and is saved
// for the whole team through server actions, debounced.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Download, Printer, RotateCcw, ChevronLeft, Link2, Check, Undo2, Copy } from 'lucide-react';
import { Button } from '@thefibre/shared/ui/button';
import { PageContainer } from '@thefibre/shared/ui/page';
import { Tabs } from '@thefibre/shared/ui/tabs';
import { InfoHint } from '@thefibre/shared/ui/info-hint';
import { CHIP, CHIP_STATE, NOTICE, PILL, PILL_TONE } from '@thefibre/shared/ui/recipes';
import { defaultState, mergeState, summarize, itemObj, type CanvasBlockKey, type CanvasItem, type ModelDefinition, type ModelState } from '@/lib/engine';
import type { Scope } from '@/lib/links';
import { t, type Locale } from '@/lib/i18n-ui';
import type { ModelRow } from '@/app/(app)/models/actions';
import { saveInputs, updateModel, duplicateModel, modelUpdatedAt } from '@/app/(app)/models/actions';
import { useRouter } from 'next/navigation';
import { BusinessModelCanvas } from './canvas';
import { CanvasEditor } from './canvas-editor';
import { SegmentEditor, StreamEditor, ResourcesEditor, SettingsEditor } from './editors';
import { newSegment, newStream, removeGenerator, upsertGenerator } from '@/lib/structure';
import { Kpis, YearsPanels, ChartPanels, MixPanels, ProjectionPanel } from './results';
import { ColumnsDrawer } from './columns-drawer';
import { SortablePanels } from './sortable-panels';
import { PeriodsGrid } from './periods-grid';
import { ScenariosPanel, type Scenario } from './scenarios';

type SavedInputs = Partial<ModelState> & { refMonth?: number; horizon?: number; scenarios?: Scenario[] };

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
type View = 'bep' | 'projection' | 'periods' | 'scenarios';

export function ModelView({ model: row, locale }: { model: ModelRow; locale: Locale }) {
  const [def, setDef] = useState<ModelDefinition>(row.definition);
  const saved = (row.inputs ?? {}) as SavedInputs;
  const [state, setState] = useState<ModelState>(() => mergeState(defaultState(row.definition), saved));
  const [refMonth, setRefMonth] = useState<number>(typeof saved.refMonth === 'number' ? saved.refMonth : (row.definition.breakEvenMonth ?? 12));
  const [horizon, setHorizon] = useState<number>(typeof saved.horizon === 'number' ? saved.horizon : (row.definition.horizon ?? 36));
  const [tab, setTab] = useState<Tab>('canvas');
  const [linkCopied, setLinkCopied] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>(Array.isArray(saved.scenarios) ? saved.scenarios.filter((x) => x && typeof x.id === 'string' && typeof x.name === 'string' && x.inputs && typeof x.inputs === 'object') : []);
  // Undo: a snapshot before every change, back with the button or ⌘Z.
  type Snap = { def: ModelDefinition; state: ModelState; refMonth: number; horizon: number };
  const history = useRef<Snap[]>([]);
  const [undoDepth, setUndoDepth] = useState(0);
  const snapshotRef = useRef<Snap | null>(null);
  const undo = () => {
    const snap = history.current.pop();
    if (!snap) return;
    setUndoDepth(history.current.length);
    inputsDirty.current = true; defDirty.current = true;
    setDef(snap.def); setState(snap.state); setRefMonth(snap.refMonth); setHorizon(snap.horizon);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { const el = document.activeElement as HTMLElement | null; if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.closest('[role=dialog]')) return; e.preventDefault(); undo(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A shared link opens the tab it was copied from: /models/<id>?tab=numbers.
  useEffect(() => { try { const q = new URLSearchParams(window.location.search).get('tab'); if (q === 'numbers' || q === 'canvas') setTab(q); } catch {} }, []);
  const [view, setView] = useState<View>('bep');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
  const updatedAt = useRef<string>(row.updated_at);
  const router = useRouter();
  const [editing, setEditing] = useState<{ block: CanvasBlockKey; index: number | null } | null>(null);
  const [structure, setStructure] = useState<{ kind: 'segment' | 'stream'; id: string | null } | { kind: 'resources' | 'settings' } | null>(null);
  const inputsDirty = useRef(false);
  const defDirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const s = useMemo(() => summarize(def, state, { horizon, refMonth: Math.min(refMonth, horizon) }), [def, state, horizon, refMonth]);

  // Somebody else's change: a colleague in another browser, or an assistant
  // through MCP. Every 15 seconds while the tab is visible, ask when the
  // model last changed; a newer stamp than the one this page holds means
  // there is a version to see. Nothing reloads by itself: the person may be
  // in the middle of a thought, so the page says so and offers the reload.
  const [changedElsewhere, setChangedElsewhere] = useState(false);
  useEffect(() => {
    let stop = false;
    const check = async () => {
      if (document.visibilityState !== 'visible' || inputsDirty.current || defDirty.current) return;
      const at = await modelUpdatedAt(row.id);
      if (!stop && at && at !== updatedAt.current && new Date(at) > new Date(updatedAt.current)) setChangedElsewhere(true);
    };
    const id = setInterval(check, 15_000);
    document.addEventListener('visibilitychange', check);
    return () => { stop = true; clearInterval(id); document.removeEventListener('visibilitychange', check); };
  }, [row.id]);

  // Debounced save of whatever changed: the inputs blob, the definition, or both.
  useEffect(() => {
    if (!inputsDirty.current && !defDirty.current) return;
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      // One after the other, each carrying the updated_at the last one
      // returned: two writes in flight would refuse each other otherwise.
      const results: Awaited<ReturnType<typeof saveInputs>>[] = [];
      if (inputsDirty.current) { inputsDirty.current = false; const r = await saveInputs(row.id, { ...state, refMonth, horizon, scenarios }, updatedAt.current); if (r.updated_at) updatedAt.current = r.updated_at; results.push(r); }
      if (defDirty.current && !results.some((r) => r.conflict)) { defDirty.current = false; const r = await updateModel(row.id, { definition: def }, updatedAt.current); if (r.updated_at) updatedAt.current = r.updated_at; results.push(r); }
      const conflict = results.some((r) => r.conflict);
      const err = results.find((r) => r.error);
      setStatus(conflict ? 'conflict' : err ? 'error' : 'saved');
      if (!err) setTimeout(() => setStatus((st) => (st === 'saved' ? 'idle' : st)), 1500);
    }, 800);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [state, refMonth, horizon, def, scenarios, row.id]);

  function change(scope: Scope, id: string, value: number) {
    remember();
    inputsDirty.current = true;
    setState((st) => {
      const next: ModelState = { ...st, settings: { ...st.settings }, fixed: { ...st.fixed }, investment: { ...st.investment }, transitions: { ...st.transitions }, periods: st.periods, periodRates: st.periodRates, generators: { ...st.generators } };
      if (typeof scope === 'string') next[scope][id] = value;
      else next.generators[scope.gen] = { ...(next.generators[scope.gen] ?? {}), [id]: value };
      return next;
    });
  }
  function patchDef(next: ModelDefinition) {
    lastSnapAt.current = 0; remember();
    defDirty.current = true;
    setDef(next);
    // New generators need their default numbers in the state, or every field shows 0.
    setState((st) => mergeState(defaultState(next), st));
  }
  const lastSnapAt = useRef(0);
  function remember() {
    const now = Date.now();
    if (now - lastSnapAt.current < 1200 && history.current.length) return; // one step per burst of typing
    lastSnapAt.current = now;
    history.current.push({ def, state, refMonth, horizon });
    if (history.current.length > 50) history.current.shift();
    setUndoDepth(history.current.length);
  }
  function setCell(kind: 'periods' | 'periodRates', id: string, month: number, value: number | null) {
    remember();
    inputsDirty.current = true;
    setState((st) => {
      const table = { ...(st[kind][id] ?? {}) };
      if (value == null) delete table[String(month)]; else table[String(month)] = value;
      const next = { ...st[kind] };
      if (Object.keys(table).length) next[id] = table; else delete next[id];
      return { ...st, [kind]: next };
    });
  }
  function setItems(block: CanvasBlockKey, items: CanvasItem[]) {
    lastSnapAt.current = 0; remember();
    defDirty.current = true;
    setDef((d) => ({ ...d, canvas: { ...(d.canvas ?? {}), [block]: items } }));
  }
  function reset() {
    if (!confirm(t(locale, 'reset_confirm'))) return;
    lastSnapAt.current = 0; remember();
    inputsDirty.current = true;
    setState(defaultState(def));
    setRefMonth(def.breakEvenMonth ?? 12);
    setHorizon(def.horizon ?? 36);
  }
  function saveScenario(name: string) {
    const sc: Scenario = { id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())), name, savedAt: new Date().toISOString(), inputs: { ...state, refMonth, horizon } };
    inputsDirty.current = true;
    setScenarios((list) => [...list.filter((x) => x.name !== name), sc]);
  }
  function loadScenario(sc: Scenario) {
    lastSnapAt.current = 0; remember();
    inputsDirty.current = true;
    setState(mergeState(defaultState(def), sc.inputs));
    if (typeof sc.inputs.refMonth === 'number') setRefMonth(sc.inputs.refMonth);
    if (typeof sc.inputs.horizon === 'number') setHorizon(sc.inputs.horizon);
  }
  function deleteScenario(sc: Scenario) { inputsDirty.current = true; setScenarios((list) => list.filter((x) => x.id !== sc.id)); }
  async function duplicate() {
    const name = window.prompt(t(locale, 'duplicate_name'), `${row.name} (${t(locale, 'copy_suffix')})`);
    if (!name) return;
    const r = await duplicateModel(row.id, name.trim());
    if (r.error || !r.id) { alert(r.error ?? t(locale, 'duplicate_failed')); return; }
    router.push(`/models/${r.id}`);
  }
  async function copyLink() {
    const url = `${window.location.origin}/models/${row.id}?tab=${tab}`;
    try { await navigator.clipboard.writeText(url); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1500); } catch { window.prompt(t(locale, 'copy_link'), url); }
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
    <div className="print-page">
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
            <Button variant="ghost" size="icon" onClick={undo} disabled={undoDepth === 0} title={t(locale, 'undo')}><Undo2 size={16} /></Button>
            {editable && <Button variant="ghost" size="icon" onClick={duplicate} title={t(locale, 'duplicate')}><Copy size={16} /></Button>}
            <Button variant="ghost" size="icon" onClick={copyLink} title={linkCopied ? t(locale, 'link_copied') : t(locale, 'copy_link')}>{linkCopied ? <Check size={16} /> : <Link2 size={16} />}</Button>
            <Button variant="ghost" size="icon" onClick={() => window.print()} title={t(locale, 'print_canvas')}><Printer size={16} /></Button>
            <Button variant="ghost" size="icon" onClick={exportCsv} title={t(locale, 'export_csv')}><Download size={16} /></Button>
            <Button variant="ghost" size="icon" onClick={reset} title={t(locale, 'reset')}><RotateCcw size={16} /></Button>
          </div>
        </header>
        {status === 'error' && <div className={`${NOTICE.error} mt-3`}>{t(locale, 'save_failed')}</div>}
        {status === 'conflict' && <div className={`${NOTICE.warning} mt-3 flex flex-wrap items-center justify-between gap-2`}><span>{t(locale, 'save_conflict')}</span><Button variant="secondary" size="sm" onClick={() => window.location.reload()}>{t(locale, 'reload')}</Button></div>}
        {changedElsewhere && status !== 'conflict' && <div className={`${NOTICE.info} mt-3 flex flex-wrap items-center justify-between gap-2 print:hidden`}><span>{t(locale, 'changed_elsewhere')}</span><Button variant="secondary" size="sm" onClick={() => window.location.reload()}>{t(locale, 'reload')}</Button></div>}
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
            {(['bep', 'projection', 'periods', 'scenarios'] as View[]).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={`${CHIP} ${view === v ? CHIP_STATE.on : CHIP_STATE.off}`}>{t(locale, v === 'bep' ? 'view_bep_cash' : v === 'projection' ? 'view_projection' : v === 'periods' ? 'view_periods' : 'view_scenarios')}</button>
            ))}
          </div>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pb-4 pl-0 lg:pl-7">
            {view === 'bep' ? (
              <SortablePanels key="bep" storageKey={`bm-order-${row.id}-bep`} title={t(locale, 'drag_to_reorder')} panels={[
                { id: 'kpis', node: <Kpis model={def} s={s} locale={locale} /> },
                { id: 'charts', node: <ChartPanels model={def} s={s} locale={locale} /> },
              ]} />
            ) : view === 'periods' ? (
              <PeriodsGrid model={def} state={state} s={s} locale={locale} onCell={setCell} />
            ) : view === 'scenarios' ? (
              <ScenariosPanel model={def} state={state} refMonth={Math.min(refMonth, horizon)} horizon={horizon} scenarios={scenarios} locale={locale} onSave={saveScenario} onLoad={loadScenario} onDelete={deleteScenario} />
            ) : (
              <SortablePanels key="projection" storageKey={`bm-order-${row.id}-projection`} title={t(locale, 'drag_to_reorder')} panels={[
                { id: 'years', node: <YearsPanels model={def} s={s} locale={locale} /> },
                { id: 'mix', node: <MixPanels model={def} state={state} s={s} locale={locale} /> },
                { id: 'projection', node: <ProjectionPanel model={def} s={s} locale={locale} /> },
              ]} />
            )}
          </div>
          <ColumnsDrawer model={def} state={state} s={s} locale={locale} refMonth={Math.min(refMonth, horizon)} horizon={horizon} onChange={change} onRefMonth={(v) => { inputsDirty.current = true; setRefMonth(v); }} onHorizon={(v) => { inputsDirty.current = true; setHorizon(v); }}
            edit={editable ? {
              onAdd: (groupId) => { if (groupId === 'segments') setStructure({ kind: 'segment', id: null }); else if (groupId === 'streams') setStructure({ kind: 'stream', id: null }); else if (groupId === 'resources') setStructure({ kind: 'resources' }); else if (groupId === 'settings') setStructure({ kind: 'settings' }); },
              onEdit: (ref) => { if (ref.kind === 'statement') setEditing({ block: ref.block, index: ref.index }); else setStructure(ref.kind === 'segment' || ref.kind === 'stream' ? { kind: ref.kind, id: ref.id } : { kind: ref.kind }); },
            } : undefined} />
        </FillToBottom>
      )}

      {structure?.kind === 'segment' && (
        <SegmentEditor open def={def} locale={locale} gen={structure.id ? (def.generators.find((g) => g.id === structure.id) ?? null) : null} onClose={() => setStructure(null)}
          onSave={(g, transitions) => { const fresh = g.id ? g : { ...newSegment(def, g.name), name: g.name, short: g.short, segment: g.segment, help: g.help }; patchDef({ ...upsertGenerator(def, fresh), transitions }); setStructure(null); }}
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
    </div>
  );
}
