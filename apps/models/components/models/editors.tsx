'use client';

// The structure editors: a segment, a revenue stream (with its variables and
// own cost lines), the key resources (fixed costs and investment), and the
// settings. Admins and team leads only; every save goes through the page's
// definition state and the API rule. Ids are minted from labels and never
// shown; formulas are checked before a save.

import { useEffect, useState, type ReactNode } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '@thefibre/shared/ui/button';
import { Dialog } from '@thefibre/shared/ui/dialog';
import { TextField, SelectField, TextAreaField, FIELD_INPUT_CLASS } from '@thefibre/shared/ui/fields';
import { ERROR_TEXT, SECTION_LABEL } from '@thefibre/shared/ui/recipes';
import type { CostKind, CostLine, Generator, ModelDefinition, NumberInput, Transition } from '@/lib/engine';
import { dependents, formulaProblem, newCost, newInput, newTransition, segments } from '@/lib/structure';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';

const KINDS: CostKind[] = ['perUnit', 'perNewUnit', 'perBatch', 'percentRevenue', 'fixed'];
const KIND_KEY: Record<CostKind, UiKey> = { perUnit: 'kind_per_unit', perNewUnit: 'kind_per_new_unit', perBatch: 'kind_per_batch', percentRevenue: 'kind_percent_revenue', fixed: 'kind_fixed', formula: 'kind_formula' };

function Num({ value, onChange, step = 1, className = '' }: { value: number; onChange: (v: number) => void; step?: number; className?: string }) {
  return <input type="number" step={step} value={value} onChange={(e) => { const v = parseFloat(e.target.value); onChange(Number.isFinite(v) ? v : 0); }} className={`${FIELD_INPUT_CLASS} h-8 text-right tabular-nums ${className}`} />;
}
function Txt({ value, onChange, placeholder = '', className = '' }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${FIELD_INPUT_CLASS} h-8 ${className}`} />;
}
const Head = ({ children, action }: { children: ReactNode; action?: ReactNode }) => <div className="flex items-center justify-between gap-2"><div className={SECTION_LABEL}>{children}</div>{action}</div>;
const AddBtn = ({ onClick, label }: { onClick: () => void; label: string }) => <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs text-ink-subtle hover:text-ink"><Plus size={13} />{label}</button>;
const Del = ({ onClick, label }: { onClick: () => void; label: string }) => <button type="button" onClick={onClick} title={label} className="text-ink-muted hover:text-ink"><Trash2 size={14} /></button>;

/** A list of number inputs: label, unit, value, step. */
function VarsEditor({ vars, onChange, locale, fixedIds = [] }: { vars: NumberInput[]; onChange: (v: NumberInput[]) => void; locale: Locale; fixedIds?: string[] }) {
  const set = (i: number, patch: Partial<NumberInput>) => onChange(vars.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[minmax(0,1fr)_5rem_7rem_5.5rem_4rem_1.25rem] gap-2 text-[10px] uppercase tracking-wider text-ink-muted"><span>{t(locale, 'label')}</span><span>{t(locale, 'id_in_formulas')}</span><span>{t(locale, 'unit')}</span><span className="text-right">{t(locale, 'value')}</span><span className="text-right">{t(locale, 'step')}</span><span /></div>
      {vars.map((v, i) => (
        <div key={v.id} className="grid grid-cols-[minmax(0,1fr)_5rem_7rem_5.5rem_4rem_1.25rem] items-center gap-2">
          <Txt value={v.label} onChange={(label) => set(i, { label })} />
          <code className="truncate text-[11px] text-ink-muted" title={v.id}>{v.id}</code>
          <Txt value={v.unit ?? ''} onChange={(unit) => set(i, { unit })} />
          <Num value={v.value} step={v.step ?? 1} onChange={(value) => set(i, { value })} />
          <Num value={v.step ?? 1} onChange={(step) => set(i, { step })} />
          {fixedIds.includes(v.id) ? <span /> : <Del label={t(locale, 'remove')} onClick={() => onChange(vars.filter((_, j) => j !== i))} />}
        </div>
      ))}
    </div>
  );
}

/** A list of cost lines: label, unit, kind, value, step, batch size. */
function CostsEditor({ costs, onChange, locale }: { costs: CostLine[]; onChange: (c: CostLine[]) => void; locale: Locale }) {
  const set = (i: number, patch: Partial<CostLine>) => onChange(costs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div className="flex flex-col gap-1.5">
      {costs.map((c, i) => (
        <div key={c.id} className="rounded-md border border-line p-2">
          <div className="grid grid-cols-[minmax(0,1fr)_5rem_7rem_1.25rem] items-center gap-2">
            <Txt value={c.label} onChange={(label) => set(i, { label })} />
            <code className="truncate text-[11px] text-ink-muted" title={c.id}>{c.id}</code>
            <Txt value={c.unit ?? ''} placeholder={t(locale, 'unit')} onChange={(unit) => set(i, { unit })} />
            <Del label={t(locale, 'remove')} onClick={() => onChange(costs.filter((_, j) => j !== i))} />
          </div>
          <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_5.5rem_4rem] items-center gap-2">
            <select value={c.kind} onChange={(e) => set(i, { kind: e.target.value as CostKind })} className={`${FIELD_INPUT_CLASS} h-8`}>{KINDS.map((k) => <option key={k} value={k}>{t(locale, KIND_KEY[k])}</option>)}</select>
            <Num value={c.value} step={c.step ?? 1} onChange={(value) => set(i, { value })} />
            <Num value={c.step ?? 1} onChange={(step) => set(i, { step })} />
          </div>
          {c.kind === 'perBatch' && <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-2"><span className="text-xs text-ink-subtle">{t(locale, 'batch_size')}</span><Txt value={String(c.batchSize ?? '')} onChange={(v) => set(i, { batchSize: /^\d+(\.\d+)?$/.test(v) ? Number(v) : v })} /></div>}
        </div>
      ))}
    </div>
  );
}

/** How this generator reaches the numbers, in one paragraph, from its own
 *  definition — so a variable's place in the arithmetic is never a guess. */
function HowItComputes({ g, locale, flows = [] }: { g: Generator; locale: Locale; flows?: Transition[] }) {
  const v = g.volume ?? {};
  const lines: string[] = [];
  flows.forEach((f) => lines.push(t(locale, f.move === false ? 'calc_flow_copy' : 'calc_flow_move', { n: f.to, r: String(f.rate) })));
  if (v.linkedTo) lines.push(t(locale, 'calc_linked', { n: `${v.linkedTo} × ${String(v.factor ?? 1)}` }));
  else if (g.revenueTotal != null) lines.push(t(locale, 'calc_lump', { n: String(v.startMonth ?? 1) }));
  else lines.push(t(locale, 'calc_volume', { s: String(v.start ?? 0), g: String(v.growth ?? 0), c: String(v.churn ?? 0) }));
  if (g.revenueTotal != null) lines.push(t(locale, 'calc_revenue_total', { n: String(g.revenueTotal) }));
  else lines.push(t(locale, 'calc_revenue', { n: String(g.revenuePerUnit ?? 0) }));
  (g.costs ?? []).forEach((c) => {
    const how = c.kind === 'perUnit' ? t(locale, 'calc_cost_per_unit', { id: c.id }) : c.kind === 'perNewUnit' ? t(locale, 'calc_cost_per_new', { id: c.id }) : c.kind === 'perBatch' ? t(locale, 'calc_cost_per_batch', { id: c.id, b: String(c.batchSize ?? 1) }) : c.kind === 'percentRevenue' ? t(locale, 'calc_cost_percent', { id: c.id }) : c.kind === 'fixed' ? t(locale, 'calc_cost_fixed', { id: c.id }) : String(c.formula ?? '');
    lines.push(`${c.label}: ${how}`);
  });
  return (
    <div className="rounded-md border border-line bg-surface-sunken px-3 py-2">
      <div className={SECTION_LABEL}>{t(locale, 'in_the_calculation')}</div>
      <ul className="mt-1 flex flex-col gap-0.5 font-mono text-[11px] leading-snug text-ink-subtle">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </div>
  );
}

/** The numbers of a generator: its variables (with ids), the revenue formula, its own cost lines. Shared by both editors. */
function GeneratorNumbers({ g, setG, def, locale, source }: { g: Generator; setG: (g: Generator) => void; def: ModelDefinition; locale: Locale; source: 'own' | 'linked' | 'lump' }) {
  const vol = ['start', 'growth', 'churn', 'from'];
  const shown = (g.inputs ?? []).filter((i) => !vol.includes(i.id) || source === 'linked');
  const known = [...(g.inputs ?? []).map((i) => i.id), ...(def.settings ?? []).map((s) => s.id)];
  return (
    <>
      <div>
        <Head action={<AddBtn label={t(locale, 'add_variable')} onClick={() => setG({ ...g, inputs: [...(g.inputs ?? []), newInput((g.inputs ?? []).map((i) => i.id))] })} />}>{source === 'own' ? t(locale, 'price_variables') : t(locale, 'variables')}</Head>
        <p className="mb-1.5 text-xs text-ink-muted">{t(locale, 'variables_hint')}</p>
        <VarsEditor locale={locale} vars={shown} fixedIds={vol} onChange={(vs) => setG({ ...g, inputs: [...(g.inputs ?? []).filter((i) => vol.includes(i.id) && source !== 'linked' && !vs.some((v) => v.id === i.id)), ...vs] })} />
      </div>
      <TextField label={source === 'lump' ? t(locale, 'amount_formula') : t(locale, 'price_formula')} value={String(source === 'lump' ? g.revenueTotal ?? '' : g.revenuePerUnit ?? '')} onChange={(e) => setG(source === 'lump' ? { ...g, revenueTotal: e.target.value } : { ...g, revenuePerUnit: e.target.value })} hint={t(locale, 'formula_hint', { n: known.join(', ') || '—' })} />
      <div>
        <Head action={<AddBtn label={t(locale, 'add_cost_line')} onClick={() => setG({ ...g, costs: [...(g.costs ?? []), newCost([...(g.costs ?? []).map((c) => c.id), ...(g.inputs ?? []).map((i) => i.id)])] })} />}>{t(locale, 'own_cost_structure')}</Head>
        <p className="mb-1.5 text-xs text-ink-muted">{t(locale, 'cost_lines_hint')}</p>
        <CostsEditor locale={locale} costs={g.costs ?? []} onChange={(costs) => setG({ ...g, costs })} />
      </div>
      <HowItComputes g={g} locale={locale} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Segment: who pays, how many, how they grow and leave — and, because a
// segment is also a stream, its price, its variables and its own costs.
// ---------------------------------------------------------------------------
export function SegmentEditor({ open, def, gen, locale, onSave, onDelete, onClose }: { open: boolean; def: ModelDefinition; gen: Generator | null; locale: Locale; onSave: (g: Generator, transitions: Transition[]) => void; onDelete: () => void; onClose: () => void }) {
  const [g, setG] = useState<Generator>(gen ?? blank());
  const [flows, setFlows] = useState<Transition[]>(gen ? (def.transitions ?? []).filter((tr) => tr.from === gen.id) : []);
  useEffect(() => { setG(gen ?? blank()); setFlows(gen ? (def.transitions ?? []).filter((tr) => tr.from === gen.id) : []); }, [gen, open, def]);
  function blank(): Generator { return { id: '', name: '', short: '', segment: '', help: '', inputs: [], volume: { start: 'start', growth: 'growth', churn: 'churn' }, costs: [] }; }
  const [err, setErr] = useState<string | null>(null);
  const vol = ['start', 'growth', 'churn'];
  const volVars = (g.inputs ?? []).filter((i) => vol.includes(i.id));
  const deps = gen ? dependents(def, gen.id) : [];
  function save() {
    const known = [...(g.inputs ?? []).map((i) => i.id), ...(def.settings ?? []).map((st) => st.id)];
    const formula = String(g.revenuePerUnit ?? '');
    if (gen && formula.trim()) { const problem = formulaProblem(formula, known); if (problem) return setErr(t(locale, 'formula_invalid', { n: problem })); }
    const others = (def.transitions ?? []).filter((tr) => !gen || tr.from !== gen.id);
    onSave({ ...g, name: g.name.trim(), short: (g.short ?? '').trim() || g.name.trim(), revenuePerUnit: formula.trim() || 0 }, [...others, ...flows]);
  }
  return (
    <Dialog open={open} onClose={onClose} size="xl" title={gen ? t(locale, 'edit_segment') : t(locale, 'add_segment')}
      footer={<>
        {gen && <Button variant="danger" disabled={deps.length > 0} title={deps.length ? t(locale, 'cannot_delete_linked', { n: deps.map((d) => d.name).join(', ') }) : undefined} onClick={() => { if (confirm(t(locale, 'delete_segment_confirm'))) onDelete(); }}>{t(locale, 'delete')}</Button>}
        <Button variant="secondary" onClick={onClose}>{t(locale, 'cancel')}</Button>
        <Button variant="primary" type="submit" disabled={!g.name.trim()} onClick={save}>{t(locale, 'save')}</Button>
      </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label={t(locale, 'name')} required value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} autoFocus />
          <TextField label={t(locale, 'short_name')} value={g.short ?? ''} onChange={(e) => setG({ ...g, short: e.target.value })} />
        </div>
        <TextField label={t(locale, 'segment_desc')} value={g.segment ?? ''} onChange={(e) => setG({ ...g, segment: e.target.value })} />
        <TextAreaField label={t(locale, 'help_text')} rows={2} value={g.help ?? ''} onChange={(e) => setG({ ...g, help: e.target.value })} />
        {gen && (
          <div>
            <Head>{t(locale, 'volume')}</Head>
            <p className="mb-1.5 text-xs text-ink-muted">{t(locale, 'volume_hint')}</p>
            <VarsEditor locale={locale} vars={volVars} fixedIds={vol} onChange={(vs) => setG({ ...g, inputs: (g.inputs ?? []).map((i) => vs.find((v) => v.id === i.id) ?? i) })} />
          </div>
        )}
        {gen && (
          <div>
            <Head action={segments(def).some((x) => x.id !== gen.id) ? <AddBtn label={t(locale, 'add_flow')} onClick={() => { const target = segments(def).find((x) => x.id !== gen.id && !flows.some((f) => f.to === x.id)) ?? segments(def).find((x) => x.id !== gen.id); if (target) setFlows([...flows, newTransition({ ...def, transitions: [...(def.transitions ?? []), ...flows] }, gen.id, target.id)]); }} /> : undefined}>{t(locale, 'funnel')}</Head>
            <p className="mb-1.5 text-xs text-ink-muted">{t(locale, 'funnel_hint')}</p>
            <div className="flex flex-col gap-1.5">
              {flows.map((f, i) => (
                <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_5.5rem_auto_1.25rem] items-center gap-2">
                  <select value={f.to} onChange={(e) => setFlows(flows.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} className={`${FIELD_INPUT_CLASS} h-8`}>{segments(def).filter((x) => x.id !== gen.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                  <div className="flex items-center gap-1"><Num value={f.rate} step={0.5} onChange={(rate) => setFlows(flows.map((x, j) => (j === i ? { ...x, rate } : x)))} /><span className="text-xs text-ink-muted">%</span></div>
                  <label className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs"><input type="checkbox" checked={f.move !== false} onChange={(e) => setFlows(flows.map((x, j) => (j === i ? { ...x, move: e.target.checked } : x)))} />{t(locale, 'flow_move')}</label>
                  <Del label={t(locale, 'remove')} onClick={() => setFlows(flows.filter((_, j) => j !== i))} />
                </div>
              ))}
              {flows.length === 0 && <p className="text-xs text-ink-muted">—</p>}
            </div>
          </div>
        )}
        {gen && <GeneratorNumbers g={g} setG={setG} def={def} locale={locale} source="own" />}
        {deps.length > 0 && <p className="text-xs text-ink-muted">{t(locale, 'feeds_streams', { n: deps.map((d) => d.name).join(', ') })}</p>}
        {err && <div className={ERROR_TEXT}>{err}</div>}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Stream: where the volume comes from, the price, the own cost lines.
// ---------------------------------------------------------------------------
type Source = 'own' | 'linked' | 'lump';
export function StreamEditor({ open, def, gen, locale, onSave, onDelete, onClose }: { open: boolean; def: ModelDefinition; gen: Generator | null; locale: Locale; onSave: (g: Generator) => void; onDelete: () => void; onClose: () => void }) {
  const [g, setG] = useState<Generator>(gen ?? blank());
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setG(gen ?? blank()); setErr(null); }, [gen, open]);
  function blank(): Generator { return { id: '', name: '', short: '', help: '', volume: { linkedTo: segments(def)[0]?.id ?? undefined, factor: 1 }, inputs: [{ id: 'price', label: 'Price', unit: `${def.currency ?? ''} / month`, value: 10, step: 1 }], revenuePerUnit: 'price', costs: [] }; }
  const source: Source = g.revenueTotal != null ? 'lump' : g.volume?.linkedTo ? 'linked' : 'own';
  const segs = segments(def).filter((s) => s.id !== g.id);
  const known = [...(g.inputs ?? []).map((i) => i.id), ...(def.settings ?? []).map((s) => s.id)];
  const deps = gen ? dependents(def, gen.id) : [];
  function setSource(src: Source) {
    if (src === 'linked') setG({ ...g, countsAsUnit: undefined, volume: { linkedTo: segs[0]?.id, factor: 1 }, revenueTotal: undefined, revenuePerUnit: g.revenuePerUnit || 'price' });
    else if (src === 'lump') setG({ ...g, countsAsUnit: false, volume: { start: 1, startMonth: 'from' }, revenuePerUnit: undefined, revenueTotal: g.revenueTotal || 'amount', inputs: [...(g.inputs ?? []).filter((i) => i.id !== 'from'), { id: 'from', label: 'Starts in month', unit: 'month', value: 1, step: 1 }] });
    else setG({ ...g, countsAsUnit: undefined, volume: { start: 'start', growth: 'growth', churn: 'churn' }, revenueTotal: undefined, revenuePerUnit: g.revenuePerUnit || 'fee', inputs: [...(g.inputs ?? []), ...(['start', 'growth', 'churn'].filter((id) => !(g.inputs ?? []).some((i) => i.id === id)).map((id) => ({ id, label: id === 'start' ? 'Units in month one' : id === 'growth' ? 'Monthly growth' : 'Monthly churn', unit: id === 'start' ? (def.unitLabel ?? 'units') : '%', value: id === 'start' ? 10 : 5, step: id === 'start' ? 1 : 0.5 })))] });
  }
  function save() {
    const formula = source === 'lump' ? String(g.revenueTotal ?? '') : String(g.revenuePerUnit ?? '');
    const problem = formulaProblem(formula, known);
    if (problem) return setErr(t(locale, 'formula_invalid', { n: problem }));
    if (source === 'lump' && !(g.inputs ?? []).some((i) => i.id === 'from')) return setErr(t(locale, 'formula_invalid', { n: 'from' }));
    onSave({ ...g, name: g.name.trim(), short: (g.short ?? '').trim() || g.name.trim() });
  }
  return (
    <Dialog open={open} onClose={onClose} size="xl" title={gen ? t(locale, 'edit_stream') : t(locale, 'add_stream')}
      footer={<>
        {gen && <Button variant="danger" disabled={deps.length > 0} title={deps.length ? t(locale, 'cannot_delete_linked', { n: deps.map((d) => d.name).join(', ') }) : undefined} onClick={() => { if (confirm(t(locale, 'delete_stream_confirm'))) onDelete(); }}>{t(locale, 'delete')}</Button>}
        <Button variant="secondary" onClick={onClose}>{t(locale, 'cancel')}</Button>
        <Button variant="primary" type="submit" disabled={!g.name.trim()} onClick={save}>{t(locale, 'save')}</Button>
      </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label={t(locale, 'name')} required value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} autoFocus />
          <TextField label={t(locale, 'short_name')} value={g.short ?? ''} onChange={(e) => setG({ ...g, short: e.target.value })} />
        </div>
        <TextAreaField label={t(locale, 'help_text')} rows={2} value={g.help ?? ''} onChange={(e) => setG({ ...g, help: e.target.value })} />
        <div>
          <Head>{t(locale, 'volume_source')}</Head>
          <div className="mt-1.5 flex flex-wrap gap-3 text-sm">
            {(['own', 'linked', 'lump'] as Source[]).map((src) => <label key={src} className="inline-flex items-center gap-1.5"><input type="radio" name="src" checked={source === src} onChange={() => setSource(src)} />{t(locale, src === 'own' ? 'source_own' : src === 'linked' ? 'source_linked' : 'source_lump')}</label>)}
          </div>
          {source === 'linked' && (
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SelectField label={t(locale, 'linked_segment')} value={g.volume?.linkedTo ?? ''} onChange={(e) => setG({ ...g, volume: { ...(g.volume ?? {}), linkedTo: e.target.value } })} options={segs.map((s) => ({ value: s.id, label: s.name }))} />
              <TextField label={t(locale, 'factor')} value={String(g.volume?.factor ?? 1)} onChange={(e) => setG({ ...g, volume: { ...(g.volume ?? {}), factor: /^\d+(\.\d+)?$/.test(e.target.value) ? Number(e.target.value) : e.target.value } })} hint={t(locale, 'factor_hint')} />
            </div>
          )}
        </div>
        <GeneratorNumbers g={g} setG={setG} def={def} locale={locale} source={source} />
        {err && <div className={ERROR_TEXT}>{err}</div>}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Key resources: fixed costs per month, one-off investment.
// ---------------------------------------------------------------------------
export function ResourcesEditor({ open, def, locale, onSave, onClose }: { open: boolean; def: ModelDefinition; locale: Locale; onSave: (patch: Pick<ModelDefinition, 'fixedCosts' | 'investment'>) => void; onClose: () => void }) {
  const [fixed, setFixed] = useState<NonNullable<ModelDefinition['fixedCosts']>>(def.fixedCosts ?? []);
  const [invest, setInvest] = useState<NumberInput[]>(def.investment ?? []);
  useEffect(() => { setFixed(def.fixedCosts ?? []); setInvest(def.investment ?? []); }, [def, open]);
  return (
    <Dialog open={open} onClose={onClose} size="lg" title={t(locale, 'edit_resources')}
      footer={<><Button variant="secondary" onClick={onClose}>{t(locale, 'cancel')}</Button><Button variant="primary" type="submit" onClick={() => onSave({ fixedCosts: fixed, investment: invest })}>{t(locale, 'save')}</Button></>}>
      <div className="space-y-5">
        <div>
          <Head action={<AddBtn label={t(locale, 'add_fixed_cost')} onClick={() => setFixed([...fixed, { ...newInput(fixed.map((f) => f.id), 'New fixed cost'), step: 50 }])} />}>{t(locale, 'fixed_cost_per_month')}</Head>
          <div className="mt-1.5 flex flex-col gap-1.5">
            <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_4rem_4.5rem_1.25rem] gap-2 text-[10px] uppercase tracking-wider text-ink-muted"><span>{t(locale, 'label')}</span><span className="text-right">{t(locale, 'value')}</span><span className="text-right">{t(locale, 'step')}</span><span className="text-right">{t(locale, 'start_month')}</span><span /></div>
            {fixed.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_5.5rem_4rem_4.5rem_1.25rem] items-center gap-2">
                <Txt value={f.label} onChange={(label) => setFixed(fixed.map((x, j) => (j === i ? { ...x, label } : x)))} />
                <Num value={f.value} step={f.step ?? 50} onChange={(value) => setFixed(fixed.map((x, j) => (j === i ? { ...x, value } : x)))} />
                <Num value={f.step ?? 50} onChange={(step) => setFixed(fixed.map((x, j) => (j === i ? { ...x, step } : x)))} />
                <Num value={f.startMonth ?? 1} onChange={(m) => setFixed(fixed.map((x, j) => (j === i ? { ...x, startMonth: Math.max(1, Math.round(m)) } : x)))} />
                <Del label={t(locale, 'remove')} onClick={() => setFixed(fixed.filter((_, j) => j !== i))} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <Head action={<AddBtn label={t(locale, 'add_investment')} onClick={() => setInvest([...invest, { ...newInput(invest.map((f) => f.id), 'New investment'), step: 500 }])} />}>{t(locale, 'one_off_investment')}</Head>
          <div className="mt-1.5"><VarsEditor locale={locale} vars={invest.map((i) => ({ ...i, unit: i.unit ?? `${def.currency ?? ''} ${t(locale, 'one_off')}` }))} onChange={setInvest} /></div>
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Settings: currency, unit word, horizon, global variables, generic costs.
// ---------------------------------------------------------------------------
export function SettingsEditor({ open, def, locale, onSave, onClose }: { open: boolean; def: ModelDefinition; locale: Locale; onSave: (patch: Partial<ModelDefinition>) => void; onClose: () => void }) {
  const [d, setD] = useState<ModelDefinition>(def);
  useEffect(() => { setD(def); }, [def, open]);
  const gv = d.genericVariable ?? [];
  const gvKinds: NonNullable<ModelDefinition['genericVariable']>[number]['kind'][] = ['percentRevenue', 'perUnit', 'perNewUnit'];
  return (
    <Dialog open={open} onClose={onClose} size="lg" title={t(locale, 'edit_settings')}
      footer={<><Button variant="secondary" onClick={onClose}>{t(locale, 'cancel')}</Button><Button variant="primary" type="submit" onClick={() => onSave({ name: d.name, tagline: d.tagline, description: d.description, currency: d.currency, currencySymbol: d.currencySymbol, unitLabel: d.unitLabel, horizon: d.horizon, breakEvenMonth: d.breakEvenMonth, settings: d.settings, genericVariable: d.genericVariable })}>{t(locale, 'save')}</Button></>}>
      <div className="space-y-4">
        <TextField label={t(locale, 'tagline')} value={d.tagline ?? ''} onChange={(e) => setD({ ...d, tagline: e.target.value })} />
        <TextAreaField label={t(locale, 'description')} rows={2} value={d.description ?? ''} onChange={(e) => setD({ ...d, description: e.target.value })} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TextField label={t(locale, 'currency')} value={d.currency ?? ''} onChange={(e) => setD({ ...d, currency: e.target.value })} />
          <TextField label={t(locale, 'currency_symbol')} value={d.currencySymbol ?? ''} onChange={(e) => setD({ ...d, currencySymbol: e.target.value })} />
          <TextField label={t(locale, 'unit_label')} value={d.unitLabel ?? ''} onChange={(e) => setD({ ...d, unitLabel: e.target.value })} />
          <TextField label={t(locale, 'ref_month')} type="number" value={String(d.breakEvenMonth ?? 12)} onChange={(e) => setD({ ...d, breakEvenMonth: Math.max(1, parseInt(e.target.value, 10) || 12) })} />
        </div>
        <div>
          <Head action={<AddBtn label={t(locale, 'add_variable')} onClick={() => setD({ ...d, settings: [...(d.settings ?? []), newInput((d.settings ?? []).map((s) => s.id))] })} />}>{t(locale, 'global_variables')}</Head>
          <div className="mt-1.5"><VarsEditor locale={locale} vars={d.settings ?? []} onChange={(settings) => setD({ ...d, settings, genericVariable: gv.filter((c) => settings.some((s) => s.id === c.id)) })} /></div>
        </div>
        <div>
          <Head action={<AddBtn label={t(locale, 'add_generic_cost')} onClick={() => { const free = (d.settings ?? []).find((s) => !gv.some((c) => c.id === s.id)); if (free) setD({ ...d, genericVariable: [...gv, { id: free.id, label: free.label, kind: 'percentRevenue' }] }); }} />}>{t(locale, 'generic_variable_costs')}</Head>
          <p className="mt-0.5 text-xs text-ink-muted">{t(locale, 'generic_variable_hint')}</p>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {gv.map((c, i) => (
              <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem] items-center gap-2">
                <Txt value={c.label} onChange={(label) => setD({ ...d, genericVariable: gv.map((x, j) => (j === i ? { ...x, label } : x)) })} />
                <select value={c.id} onChange={(e) => setD({ ...d, genericVariable: gv.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)) })} className={`${FIELD_INPUT_CLASS} h-8`}>{(d.settings ?? []).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
                <select value={c.kind} onChange={(e) => setD({ ...d, genericVariable: gv.map((x, j) => (j === i ? { ...x, kind: e.target.value as typeof c.kind } : x)) })} className={`${FIELD_INPUT_CLASS} h-8`}>{gvKinds.map((k) => <option key={k} value={k}>{t(locale, KIND_KEY[k])}</option>)}</select>
                <Del label={t(locale, 'remove')} onClick={() => setD({ ...d, genericVariable: gv.filter((_, j) => j !== i) })} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
