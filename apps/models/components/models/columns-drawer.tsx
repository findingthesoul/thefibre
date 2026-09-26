'use client';

// The variables as columns, the way Connect's Landscape browses a disk
// (Sjoerd, 2026-09-26: "a frozen bottom bar with the column structure that
// we also create in Connect Landscape, apple columns").
//
//   GROUPS  →  ELEMENTS in that group  →  ALL VARIABLES of that element, with its relations
//
// Column 1: customer segments, revenue streams, key resources, settings, and
// every canvas block that has statements linked to items. Column 2: the
// elements of the chosen group. Column 3: every variable of the chosen
// element, edited in place, and the relations it has (where its volume comes
// from, what it feeds, which value propositions serve it).
//
// A drawer pinned to the bottom of the page, its height dragged by hand and
// remembered in this browser. Below `md` only the deepest open column shows,
// with a back arrow — what Finder does in a narrow window too.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, GripHorizontal, Plus, Pencil } from 'lucide-react';
import { SECTION_LABEL } from '@thefibre/shared/ui/recipes';
import { CANVAS_BLOCK_KEYS, itemObj, type BandTable, type CanvasBlockKey, type ModelDefinition, type ModelState, type Summary, type TableNumbers } from '@/lib/engine';
import { genVars, readingFor, variablesFor, transitionVar, tablesUsedBy, usersOfTable, type Scope, type Variable } from '@/lib/links';
import { dependents } from '@/lib/structure';
import { BandsEditor, TableChart } from './editors';
import { makeFormatters } from '@/lib/format';
import { t, type Locale } from '@/lib/i18n-ui';
import { Field } from './inputs';

type Element = { id: string; label: string; sub?: string; reading?: string; vars: Variable[]; relations: string[]; horizon?: boolean; editRef?: EditRef; /** A band table: its bands edit in place. */ table?: BandTable };
export type EditRef = { kind: 'segment' | 'stream'; id: string } | { kind: 'resources' } | { kind: 'settings' } | { kind: 'tables' } | { kind: 'statement'; block: CanvasBlockKey; index: number };
export type DrawerEditHandlers = { onAdd: (groupId: string) => void; onEdit: (ref: EditRef) => void };
type Group = { id: string; label: string; elements: Element[] };

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
  if (kind === 'table') return (def.tables ?? []).find((tb) => tb.id === rest)?.label ?? rest;
  return link;
}

function buildGroups(def: ModelDefinition, state: ModelState, s: Summary, locale: Locale, horizon: number, refMonth: number): Group[] {
  const { fmtMoney, fmtNum } = makeFormatters(def.currencySymbol ?? '');
  const fm = { money: fmtMoney, num: fmtNum };
  const ref = s.ref;
  const unit = def.unitLabel ?? 'units';
  const cur = def.currency ?? '';
  const mo = t(locale, 'unit_month');
  const name = (id: string) => def.generators.find((g) => g.id === id)?.name ?? id;
  const servedBy = (gid: string) => (def.canvas?.valuePropositions ?? []).map(itemObj).filter((it) => (it.segments ?? []).includes(gid)).map((it) => it.text);
  const costVars = (g: ModelDefinition['generators'][number]): Variable[] => (g.costs ?? []).filter((c) => c.kind !== 'formula').map((c) => ({ scope: { gen: g.id }, def: c, value: state.generators[g.id]?.[c.id] ?? c.value }));
  const tableName = (id: string) => (def.tables ?? []).find((tb) => tb.id === id)?.label ?? id;
  // A formula cost has no value of its own: it reads as a relation, with the formula. So does a table a formula reads, and a billing moment.
  const formulaRels = (g: ModelDefinition['generators'][number]): string[] => [
    ...(g.costs ?? []).filter((c) => c.kind === 'formula').map((c) => t(locale, 'rel_formula_cost', { l: c.label, f: String(c.formula ?? '') })),
    ...tablesUsedBy(g).map((id) => t(locale, 'rel_uses_table', { n: tableName(id) })),
    ...(g.billing && g.billing.every > 1 ? [t(locale, 'rel_billing', { n: g.billing.every, m: g.billing.month ?? 1 })] : []),
  ];

  const segs = def.generators.filter((g) => g.countsAsUnit !== false && !g.volume?.linkedTo);
  const groups: Group[] = [
    { id: 'segments', label: t(locale, 'customer_segments'), elements: segs.map((g) => {
      const r = ref.gens[g.id]!;
      const out = (def.transitions ?? []).filter((tr) => tr.from === g.id);
      const inn = (def.transitions ?? []).filter((tr) => tr.to === g.id);
      return { id: g.id, label: g.name, sub: g.segment, reading: `${fmtNum(r.units)} ${unit} · ${fmtMoney(r.revenue)} / ${mo}${r.inflow ? ` · +${fmtNum(r.inflow)}` : ''}${r.outflow ? ` · −${fmtNum(r.outflow)}` : ''}`, vars: [...genVars(def, state, g.id, 'all'), ...out.map((tr) => transitionVar(def, state, tr)), ...costVars(g)], editRef: { kind: 'segment' as const, id: g.id },
        relations: [
          ...out.map((tr) => t(locale, tr.move === false ? 'rel_flow_copy' : 'rel_flow_move', { n: name(tr.to), r: String(state.transitions[tr.id] ?? tr.rate) })),
          ...inn.map((tr) => t(locale, 'rel_flow_in', { n: name(tr.from), r: String(state.transitions[tr.id] ?? tr.rate) })),
          ...dependents(def, g.id).map((d) => t(locale, 'rel_feeds', { n: d.name })), ...servedBy(g.id).map((v) => t(locale, 'rel_served_by', { n: v })), ...formulaRels(g)] };
    }) },
    { id: 'streams', label: t(locale, 'revenue_streams'), elements: def.generators.map((g) => {
      const r = ref.gens[g.id]!;
      const rel: string[] = [];
      if (g.volume?.linkedTo) rel.push(t(locale, 'rel_volume_from', { n: `${name(g.volume.linkedTo)} × ${String(g.volume.factor ?? 1)}` }));
      else if (g.revenueTotal != null) rel.push(t(locale, 'rel_lump'));
      else rel.push(t(locale, 'rel_own_segment'));
      if (g.revenuePerUnit != null) rel.push(t(locale, 'rel_price_formula', { n: String(g.revenuePerUnit) }));
      if (g.revenueTotal != null) rel.push(t(locale, 'rel_amount_formula', { n: String(g.revenueTotal) }));
      rel.push(...formulaRels(g));
      return { id: g.id, label: g.name, sub: g.help, reading: `${fmtMoney(r.revenue)} / ${mo}`, vars: [...genVars(def, state, g.id, 'all'), ...costVars(g)], relations: rel, editRef: { kind: 'stream' as const, id: g.id } };
    }) },
    { id: 'resources', label: t(locale, 'key_resources'), elements: [
      ...(def.fixedCosts ?? []).map((f) => ({ id: `fixed:${f.id}`, label: f.label, reading: `${fmtMoney(state.fixed[f.id] ?? f.value)} / ${mo}`, vars: [{ scope: 'fixed' as const, def: { ...f, unit: `${cur} / ${mo}` }, value: state.fixed[f.id] ?? f.value }], relations: f.startMonth && f.startMonth > 1 ? [t(locale, 'rel_from_month', { n: f.startMonth })] : [], editRef: { kind: 'resources' as const } })),
      ...(def.investment ?? []).map((i) => ({ id: `invest:${i.id}`, label: i.label, reading: `${fmtMoney(state.investment[i.id] ?? i.value)} ${t(locale, 'one_off')}`, vars: [{ scope: 'investment' as const, def: { ...i, unit: `${cur} ${t(locale, 'one_off')}` }, value: state.investment[i.id] ?? i.value }], relations: [t(locale, 'one_off_investment')], editRef: { kind: 'resources' as const } })),
    ] },
    { id: 'settings', label: t(locale, 'settings'), elements: [
      ...(def.settings ?? []).map((st) => ({ id: `setting:${st.id}`, label: st.label, reading: `${state.settings[st.id] ?? st.value} ${st.unit ?? ''}`, vars: [{ scope: 'settings' as const, def: st, value: state.settings[st.id] ?? st.value }], relations: (def.genericVariable ?? []).filter((c) => c.id === st.id).map((c) => t(locale, 'rel_generic_cost', { n: c.label })), editRef: { kind: 'settings' as const } })),
      { id: '__horizon', label: t(locale, 'horizon_and_ref'), reading: `${horizon} · ${t(locale, 'month_n', { n: refMonth })}`, vars: [], relations: [], horizon: true, editRef: { kind: 'settings' as const } },
    ] },
    { id: 'tables', label: t(locale, 'tables'), elements: (def.tables ?? []).map((tb) => {
      const users = usersOfTable(def, tb.id);
      return { id: `table:${tb.id}`, label: tb.label, sub: tb.unit, reading: `${t(locale, 'bands_n', { n: (state.tables[tb.id]?.bands ?? tb.bands).length })} · ${tb.mode}`, vars: [], table: tb, editRef: { kind: 'tables' as const },
        relations: users.length ? users.map((g) => t(locale, 'rel_used_by', { n: g.name })) : [t(locale, 'rel_not_used')] };
    }) },
  ];
  CANVAS_BLOCK_KEYS.forEach((k) => {
    const all = (def.canvas?.[k] ?? []).map(itemObj);
    const items = all.map((it, index) => ({ it, index })).filter(({ it }) => (it.links?.length ?? 0) > 0);
    if (!items.length) return;
    groups.push({ id: `block:${k}`, label: t(locale, TITLE[k]), elements: items.map(({ it, index }) => ({
      id: `stmt:${it.id ?? index}`, label: it.text, reading: (it.links ?? []).map((l) => readingFor(def, s, state, l, fm)).filter(Boolean).join(' · '),
      vars: (it.links ?? []).flatMap((l) => variablesFor(def, state, l)), relations: (it.links ?? []).map((l) => t(locale, 'rel_stands_for', { n: readingLabel(def, l) })),
      editRef: { kind: 'statement' as const, block: k, index },
    })) });
  });
  return groups;
}

const MIN_H = 160, MAX_H = 640, DEFAULT_H = 300, BAR_H = 28;

export function ColumnsDrawer({ model, state, s, locale, refMonth, horizon, onChange, onRefMonth, onHorizon, onTable, edit }: {
  model: ModelDefinition; state: ModelState; s: Summary; locale: Locale; refMonth: number; horizon: number;
  onChange: (scope: Scope, id: string, value: number) => void; onRefMonth: (v: number) => void; onHorizon: (v: number) => void;
  /** A band table's numbers, edited in place (every active member may). */
  onTable: (id: string, patch: Partial<TableNumbers>) => void;
  /** Create and edit from the drawer, for admins and team leads. */
  edit?: DrawerEditHandlers;
}) {
  const groups = useMemo(() => buildGroups(model, state, s, locale, horizon, refMonth), [model, state, s, locale, horizon, refMonth]);
  const [groupId, setGroupId] = useState<string>('segments');
  const [elementId, setElementId] = useState<string | null>(null);
  const [level, setLevel] = useState<'group' | 'element' | 'vars'>('group');
  const [height, setHeight] = useState(DEFAULT_H);
  const [collapsed, setCollapsed] = useState(false);
  const remember = (h: number) => { try { localStorage.setItem('bm-drawer-h', String(h)); } catch {} };
  const drag = useRef<{ startY: number; startH: number } | null>(null);
  useEffect(() => { try { const h = parseInt(localStorage.getItem('bm-drawer-h') ?? '', 10); if (h >= MIN_H && h <= MAX_H) setHeight(h); } catch {} }, []);
  const group = groups.find((g) => g.id === groupId) ?? groups[0] ?? null;
  const element = group?.elements.find((e) => e.id === elementId) ?? null;

  function onPointerDown(e: React.PointerEvent) { if (collapsed) return; drag.current = { startY: e.clientY, startH: height }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }
  function onPointerMove(e: React.PointerEvent) { if (!drag.current) return; setHeight(Math.min(MAX_H, Math.max(MIN_H, drag.current.startH + (drag.current.startY - e.clientY)))); }
  function onPointerUp() { if (drag.current) { drag.current = null; remember(height); } }

  const column = 'min-h-0 overflow-y-auto border-line';
  const phone = (l: typeof level) => (l === level ? '' : 'hidden md:block');

  return (
    <div className="z-20 -mx-4 shrink-0 border-t border-line bg-surface-raised shadow-[0_-8px_24px_-16px_rgb(0_0_0_/_0.25)] sm:-mx-8" style={{ height: collapsed ? BAR_H : height }}>
      <div className="flex items-center" style={{ height: BAR_H }}>
        <div role="separator" aria-orientation="horizontal" title={t(locale, 'drawer_resize')} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} className={`flex h-full flex-1 items-center justify-center text-ink-muted ${collapsed ? '' : 'cursor-row-resize touch-none hover:bg-surface-sunken'}`}><GripHorizontal size={14} /></div>
        <div className="flex shrink-0 items-center gap-0.5 px-2">
          <button type="button" title={t(locale, 'drawer_down')} onClick={() => { if (collapsed) return; if (height > DEFAULT_H) { setHeight(DEFAULT_H); remember(DEFAULT_H); } else setCollapsed(true); }} className="rounded p-0.5 text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-40" disabled={collapsed}><ChevronDown size={14} /></button>
          <button type="button" title={t(locale, 'drawer_up')} onClick={() => { if (collapsed) { setCollapsed(false); return; } setHeight(MAX_H); remember(MAX_H); }} className="rounded p-0.5 text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-40" disabled={!collapsed && height >= MAX_H}><ChevronUp size={14} /></button>
        </div>
      </div>
      <div className={`grid grid-cols-1 md:grid-cols-[13rem_18rem_minmax(0,1fr)] ${collapsed ? 'hidden' : ''}`} style={{ height: `calc(100% - ${BAR_H}px)` }}>
        <div className={`${column} border-r ${phone('group')}`}>
          <ColumnHead>{t(locale, 'col_canvas_element')}</ColumnHead>
          <ul className="py-1">
            {groups.map((g) => (
              <Row key={g.id} on={g.id === group?.id} open onClick={() => { setGroupId(g.id); setElementId(null); setLevel('element'); }}>
                <span className="min-w-0 flex-1 truncate">{g.label}</span>
                <span className={`shrink-0 text-xs tabular-nums ${g.id === group?.id ? 'opacity-80' : 'text-ink-muted'}`}>{g.elements.length}</span>
              </Row>
            ))}
          </ul>
        </div>
        <div className={`${column} border-r ${phone('element')}`}>
          <ColumnHead>
            <button type="button" onClick={() => setLevel('group')} className="mr-1 md:hidden"><ChevronLeft size={14} /></button>
            <span className="min-w-0 flex-1 truncate">{group?.label ?? t(locale, 'col_items')}</span>
            {edit && group && !group.id.startsWith('block:') && <button type="button" onClick={() => edit.onAdd(group.id)} title={t(locale, 'add')} className="rounded p-0.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"><Plus size={14} /></button>}
          </ColumnHead>
          {!group && <p className="px-3 pt-3 text-xs text-ink-muted">{t(locale, 'pick_element')}</p>}
          {group && (
            <ul className="py-1">
              {group.elements.map((el) => (
                <Row key={el.id} on={el.id === elementId} open onClick={() => { setElementId(el.id); setLevel('vars'); }}>
                  <span className="min-w-0 flex-1"><span className="block truncate">{el.label}</span>{el.reading && <span className={`block truncate text-[11px] tabular-nums ${el.id === elementId ? 'opacity-80' : 'text-ink-muted'}`}>{el.reading}</span>}</span>
                </Row>
              ))}
            </ul>
          )}
        </div>
        <div className={`${column} ${phone('vars')}`}>
          <ColumnHead>
            <button type="button" onClick={() => setLevel('element')} className="mr-1 md:hidden"><ChevronLeft size={14} /></button>
            <span className="min-w-0 flex-1 truncate">{element ? element.label : t(locale, 'col_variables')}</span>
            {element?.reading && <span className="shrink-0 text-xs normal-case tracking-normal text-ink-muted tabular-nums">{element.reading}</span>}
            {edit && element?.editRef && <button type="button" onClick={() => edit.onEdit(element.editRef!)} title={t(locale, 'edit')} className="ml-2 rounded p-0.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"><Pencil size={13} /></button>}
          </ColumnHead>
          {!element && <p className="px-3 pt-3 text-xs text-ink-muted">{t(locale, 'pick_item')}</p>}
          {element && (
            <div className="grid grid-cols-1 gap-x-6 px-3 pb-3 pt-1 lg:grid-cols-[minmax(0,1fr)_16rem]">
              <div>
                {element.vars.map((v) => <Field key={(typeof v.scope === 'string' ? v.scope : v.scope.gen) + ':' + v.def.id} def={v.def} value={v.value} onChange={(val) => onChange(v.scope, v.def.id, val)} />)}
                {element.horizon && (
                  <>
                    <Field def={{ id: 'horizon', label: t(locale, 'horizon'), unit: t(locale, 'horizon_unit'), value: horizon, step: 12 }} value={horizon} onChange={(v) => { if (v >= 12 && v <= 120) onHorizon(Math.round(v)); }} />
                    <Field def={{ id: 'refMonth', label: t(locale, 'ref_month'), unit: t(locale, 'unit_month'), value: refMonth, step: 1 }} value={refMonth} onChange={(v) => { if (v >= 1 && v <= horizon) onRefMonth(Math.round(v)); }} />
                  </>
                )}
                {element.table && (() => { const nums = state.tables[element.table.id] ?? { bands: element.table.bands, cap: element.table.cap }; return (
                  <div className="flex flex-col gap-3 pt-1">
                    <BandsEditor compact locale={locale} mode={element.table.mode} bands={nums.bands} cap={nums.cap} onChange={(patch) => onTable(element.table!.id, patch)} />
                    <TableChart table={{ mode: element.table.mode, cap: nums.cap, bands: nums.bands }} locale={locale} />
                    <p className="font-mono text-[11px] text-ink-muted">lookup({element.table.id}, …)</p>
                  </div>
                ); })()}
                {element.vars.length === 0 && !element.horizon && !element.table && <p className="pt-2 text-xs text-ink-muted">—</p>}
              </div>
              {element.relations.length > 0 && (
                <div className="pt-1">
                  <div className={SECTION_LABEL}>{t(locale, 'relations')}</div>
                  <ul className="mt-1 flex flex-col gap-1">{element.relations.map((r, i) => <li key={i} className="text-[12px] leading-snug text-ink-subtle">{r}</li>)}</ul>
                </div>
              )}
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
    <li>
      <button type="button" onClick={onClick} aria-current={on ? 'true' : undefined} className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${on ? 'bg-ink text-ink-inverse' : 'hover:bg-surface-sunken'}`}>
        {children}
        {open && <ChevronRight size={13} className={on ? 'opacity-80' : 'text-ink-subtle'} />}
      </button>
    </li>
  );
}
