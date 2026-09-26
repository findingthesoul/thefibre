'use client';

// The variables as columns, the way Connect's Landscape browses a disk
// (Sjoerd, 2026-09-26: "a frozen bottom bar with the column structure that
// we also create in Connect Landscape, apple columns").
//
//   CANVAS ELEMENTS  →  ITEMS of that element  →  VARIABLES of that item
//
// A drawer pinned to the bottom of the page, its height dragged by hand and
// remembered in this browser; the result views scroll above it and move on
// every keystroke. Below `md` only the deepest open column shows, with a
// back arrow — what Finder does in a narrow window too.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, GripHorizontal } from 'lucide-react';
import { CANVAS_BLOCK_KEYS, itemObj, type CanvasBlockKey, type ModelDefinition, type ModelState, type Summary } from '@/lib/engine';
import { genVars, readingFor, variablesFor, type Scope, type Variable } from '@/lib/links';
import { makeFormatters } from '@/lib/format';
import { t, type Locale } from '@/lib/i18n-ui';
import { Field } from './inputs';

type Item = { id: string; label: string; reading: string; vars: Variable[] };
type Element = { id: string; group: string; label: string; sub?: string; items: Item[] };

const TITLE: Record<CanvasBlockKey, 'key_partners' | 'key_activities' | 'key_resources' | 'value_propositions' | 'customer_relationships' | 'channels'> = {
  keyPartners: 'key_partners', keyActivities: 'key_activities', keyResources: 'key_resources', valuePropositions: 'value_propositions', customerRelationships: 'customer_relationships', channels: 'channels',
};

function readingLabel(def: ModelDefinition, link: string): string {
  const [kind, rest] = link.split(':', 2) as [string, string];
  if (kind === 'gen') return def.generators.find((g) => g.id === rest)?.name ?? rest;
  if (kind === 'cost') { const [gid, cid] = rest.split('.', 2) as [string, string]; const g = def.generators.find((x) => x.id === gid); return `${g?.short ?? gid}: ${g?.costs?.find((c) => c.id === cid)?.label ?? cid}`; }
  if (kind === 'fixed') return (def.fixedCosts ?? []).find((f) => f.id === rest)?.label ?? rest;
  if (kind === 'invest') return (def.investment ?? []).find((i) => i.id === rest)?.label ?? rest;
  if (kind === 'setting') return (def.settings ?? []).find((s) => s.id === rest)?.label ?? rest;
  return link;
}

/** The tree the columns walk, built from the definition and the numbers. */
function buildElements(def: ModelDefinition, state: ModelState, s: Summary, locale: Locale, horizon: number, refMonth: number): Element[] {
  const { fmtMoney, fmtNum } = makeFormatters(def.currencySymbol ?? '');
  const fm = { money: fmtMoney, num: fmtNum };
  const ref = s.ref;
  const unit = def.unitLabel ?? 'units';
  const cur = def.currency ?? '';
  const mo = t(locale, 'unit_month');
  const out: Element[] = [];
  def.generators.filter((g) => g.countsAsUnit !== false && !g.volume?.linkedTo).forEach((g) => {
    const r = ref.gens[g.id]!;
    out.push({ id: `seg:${g.id}`, group: t(locale, 'customer_segments'), label: g.name, sub: g.segment, items: [
      { id: 'volume', label: t(locale, 'volume'), reading: `${fmtNum(r.units)} ${unit}`, vars: genVars(def, state, g.id, 'volume') },
    ] });
  });
  def.generators.forEach((g) => {
    const r = ref.gens[g.id]!;
    const priceVars = genVars(def, state, g.id, g.volume?.linkedTo || g.countsAsUnit === false ? 'all' : 'price');
    const items: Item[] = [{ id: 'price', label: t(locale, 'price'), reading: `${fmtMoney(r.revenue)} / ${mo}`, vars: priceVars }];
    (g.costs ?? []).forEach((c) => items.push({ id: `cost:${c.id}`, label: c.label, reading: `${fmtMoney(r.costLines[c.id] ?? 0)} / ${mo}`, vars: [{ scope: { gen: g.id }, def: c, value: state.generators[g.id]?.[c.id] ?? c.value }] }));
    out.push({ id: `stream:${g.id}`, group: t(locale, 'revenue_streams'), label: g.name, sub: g.help, items });
  });
  if ((def.fixedCosts ?? []).length) out.push({ id: 'fixed', group: t(locale, 'key_resources'), label: t(locale, 'generic_cost_structure'), sub: `${fmtMoney(ref.fixedCost)} / ${mo}`, items: (def.fixedCosts ?? []).map((f) => ({ id: f.id, label: f.label, reading: `${fmtMoney(state.fixed[f.id] ?? f.value)} / ${mo}`, vars: [{ scope: 'fixed' as const, def: { ...f, unit: `${cur} / ${mo}` }, value: state.fixed[f.id] ?? f.value }] })) });
  if ((def.investment ?? []).length) out.push({ id: 'invest', group: t(locale, 'key_resources'), label: t(locale, 'investment_need'), sub: `${fmtMoney(s.investmentTotal)} ${t(locale, 'one_off')}`, items: (def.investment ?? []).map((i) => ({ id: i.id, label: i.label, reading: `${fmtMoney(state.investment[i.id] ?? i.value)} ${t(locale, 'one_off')}`, vars: [{ scope: 'investment' as const, def: { ...i, unit: `${cur} ${t(locale, 'one_off')}` }, value: state.investment[i.id] ?? i.value }] })) });
  out.push({ id: 'settings', group: t(locale, 'settings'), label: t(locale, 'settings'), sub: t(locale, 'horizon_months', { n: horizon }), items: [
    ...(def.settings ?? []).map((st) => ({ id: st.id, label: st.label, reading: `${state.settings[st.id] ?? st.value} ${st.unit ?? ''}`, vars: [{ scope: 'settings' as const, def: st, value: state.settings[st.id] ?? st.value }] })),
    { id: '__horizon', label: t(locale, 'horizon_and_ref'), reading: `${horizon} · ${t(locale, 'month_n', { n: refMonth })}`, vars: [] },
  ] });
  CANVAS_BLOCK_KEYS.forEach((k) => (def.canvas?.[k] ?? []).map(itemObj).filter((it) => (it.links?.length ?? 0) > 0).forEach((it, i) => {
    out.push({ id: `stmt:${k}:${it.id ?? i}`, group: t(locale, TITLE[k]), label: it.text, items: (it.links ?? []).map((l) => ({ id: l, label: readingLabel(def, l), reading: readingFor(def, s, state, l, fm), vars: variablesFor(def, state, l) })) });
  }));
  return out;
}

const MIN_H = 160, MAX_H = 640, DEFAULT_H = 300;

export function ColumnsDrawer({ model, state, s, locale, refMonth, horizon, onChange, onRefMonth, onHorizon }: {
  model: ModelDefinition; state: ModelState; s: Summary; locale: Locale; refMonth: number; horizon: number;
  onChange: (scope: Scope, id: string, value: number) => void; onRefMonth: (v: number) => void; onHorizon: (v: number) => void;
}) {
  const elements = useMemo(() => buildElements(model, state, s, locale, horizon, refMonth), [model, state, s, locale, horizon, refMonth]);
  const [elementId, setElementId] = useState<string | null>(elements[0]?.id ?? null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [level, setLevel] = useState<'element' | 'item' | 'vars'>('element');
  const [height, setHeight] = useState(DEFAULT_H);
  const drag = useRef<{ startY: number; startH: number } | null>(null);
  useEffect(() => { try { const h = parseInt(localStorage.getItem('bm-drawer-h') ?? '', 10); if (h >= MIN_H && h <= MAX_H) setHeight(h); } catch {} }, []);
  const element = elements.find((e) => e.id === elementId) ?? null;
  const item = element?.items.find((i) => i.id === itemId) ?? null;

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { startY: e.clientY, startH: height };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const h = Math.min(MAX_H, Math.max(MIN_H, drag.current.startH + (drag.current.startY - e.clientY)));
    setHeight(h);
  }
  function onPointerUp() { if (drag.current) { drag.current = null; try { localStorage.setItem('bm-drawer-h', String(height)); } catch {} } }

  const column = 'min-h-0 overflow-y-auto border-line';
  const phone = (l: typeof level) => (l === level ? '' : 'hidden md:block');
  let lastGroup = '';

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-surface-raised shadow-[0_-8px_24px_-16px_rgb(0_0_0_/_0.25)] sm:-mx-8" style={{ height }}>
      <div role="separator" aria-orientation="horizontal" title={t(locale, 'drawer_resize')} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} className="flex h-4 cursor-row-resize touch-none items-center justify-center text-ink-muted hover:bg-surface-sunken"><GripHorizontal size={14} /></div>
      <div className="grid h-[calc(100%-1rem)] grid-cols-1 md:grid-cols-[16rem_16rem_minmax(0,1fr)]">
        <div className={`${column} border-r ${phone('element')}`}>
          <ColumnHead>{t(locale, 'col_canvas_element')}</ColumnHead>
          <ul className="pb-2">
            {elements.map((el) => {
              const head = el.group !== lastGroup; lastGroup = el.group;
              return (
                <li key={el.id}>
                  {head && <div className="px-3 pb-0.5 pt-2 text-[10px] uppercase tracking-wider text-ink-muted">{el.group}</div>}
                  <Row on={el.id === elementId} open onClick={() => { setElementId(el.id); setItemId(el.items.length === 1 ? el.items[0]!.id : null); setLevel('item'); }}>
                    <span className="min-w-0 flex-1 truncate">{el.label}</span>
                    {el.sub && <span className={`hidden shrink-0 truncate text-xs lg:inline ${el.id === elementId ? 'opacity-80' : 'text-ink-muted'}`}>{el.sub}</span>}
                  </Row>
                </li>
              );
            })}
          </ul>
        </div>
        <div className={`${column} border-r ${phone('item')}`}>
          <ColumnHead>
            <button type="button" onClick={() => setLevel('element')} className="mr-1 md:hidden"><ChevronLeft size={14} /></button>
            <span className="min-w-0 flex-1 truncate">{element ? element.label : t(locale, 'col_items')}</span>
          </ColumnHead>
          {!element && <p className="px-3 pt-3 text-xs text-ink-muted">{t(locale, 'pick_element')}</p>}
          {element && (
            <ul className="pb-2">
              {element.items.map((it) => (
                <Row key={it.id} on={it.id === itemId} open onClick={() => { setItemId(it.id); setLevel('vars'); }}>
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                  <span className={`shrink-0 text-xs tabular-nums ${it.id === itemId ? 'opacity-80' : 'text-ink-muted'}`}>{it.reading}</span>
                </Row>
              ))}
            </ul>
          )}
        </div>
        <div className={`${column} ${phone('vars')}`}>
          <ColumnHead>
            <button type="button" onClick={() => setLevel('item')} className="mr-1 md:hidden"><ChevronLeft size={14} /></button>
            <span className="min-w-0 flex-1 truncate">{item ? `${element?.label} · ${item.label}` : t(locale, 'col_variables')}</span>
            {item && <span className="shrink-0 text-xs normal-case tracking-normal text-ink-muted tabular-nums">{item.reading}</span>}
          </ColumnHead>
          {!item && <p className="px-3 pt-3 text-xs text-ink-muted">{t(locale, 'pick_item')}</p>}
          {item && (
            <div className="px-3 pb-3 pt-1">
              {item.vars.map((v) => <Field key={(typeof v.scope === 'string' ? v.scope : v.scope.gen) + ':' + v.def.id} def={v.def} value={v.value} onChange={(val) => onChange(v.scope, v.def.id, val)} />)}
              {item.id === '__horizon' && (
                <>
                  <Field def={{ id: 'horizon', label: t(locale, 'horizon'), unit: t(locale, 'horizon_unit'), value: horizon, step: 12 }} value={horizon} onChange={(v) => { if (v >= 12 && v <= 120) onHorizon(Math.round(v)); }} />
                  <Field def={{ id: 'refMonth', label: t(locale, 'ref_month'), unit: t(locale, 'unit_month'), value: refMonth, step: 1 }} value={refMonth} onChange={(v) => { if (v >= 1 && v <= horizon) onRefMonth(Math.round(v)); }} />
                </>
              )}
              {item.vars.length === 0 && item.id !== '__horizon' && <p className="pt-2 text-xs text-ink-muted">—</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ColumnHead({ children }: { children: ReactNode }) {
  return <div className="sticky top-0 z-10 flex items-center border-b border-line bg-surface-raised px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-ink-subtle">{children}</div>;
}
function Row({ on, open, onClick, children }: { on: boolean; open?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-current={on ? 'true' : undefined} className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${on ? 'bg-ink text-ink-inverse' : 'hover:bg-surface-sunken'}`}>
      {children}
      {open && <ChevronRight size={13} className={on ? 'opacity-80' : 'text-ink-subtle'} />}
    </button>
  );
}
