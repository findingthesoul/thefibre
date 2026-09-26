'use client';

// The Business Model Canvas: nine blocks in the Strategyzer layout. The six
// text blocks come from the model's story and, for admins and team leads,
// are edited in place: click a statement to change, link or delete it, "+" to
// add one. Segments, revenue streams and cost structure are the live numbers.
// Each block shows its first lines and grows on "… more" — the page grows
// with it, nothing scrolls inside a block.

import { useState, type ReactNode } from 'react';
import { Link2, Activity, Box, Gift, Heart, Truck, Users, Tag, Banknote, Plus, Settings2, Pencil } from 'lucide-react';
import { SECTION_LABEL } from '@thefibre/shared/ui/recipes';
import { Dialog } from '@thefibre/shared/ui/dialog';
import { CANVAS_BLOCK_KEYS, itemObj, type CanvasBlockKey, type ModelDefinition, type ModelState, type Summary } from '@/lib/engine';
import { linkables } from '@/lib/links';
import { makeFormatters, singular } from '@/lib/format';
import { t, type Locale } from '@/lib/i18n-ui';

type Block = { key: CanvasBlockKey; title: 'key_partners' | 'key_activities' | 'key_resources' | 'value_propositions' | 'customer_relationships' | 'channels'; icon: ReactNode; area: string };
const BLOCKS: Block[] = [
  { key: 'keyPartners', title: 'key_partners', icon: <Link2 size={16} />, area: 'lg:[grid-area:1/1/3/3]' },
  { key: 'keyActivities', title: 'key_activities', icon: <Activity size={16} />, area: 'lg:[grid-area:1/3/2/5]' },
  { key: 'keyResources', title: 'key_resources', icon: <Box size={16} />, area: 'lg:[grid-area:2/3/3/5]' },
  { key: 'valuePropositions', title: 'value_propositions', icon: <Gift size={16} />, area: 'lg:[grid-area:1/5/3/7]' },
  { key: 'customerRelationships', title: 'customer_relationships', icon: <Heart size={16} />, area: 'lg:[grid-area:1/7/2/9]' },
  { key: 'channels', title: 'channels', icon: <Truck size={16} />, area: 'lg:[grid-area:2/7/3/9]' },
];
const PREVIEW = 4;

export type CanvasEditHandlers = {
  onEditItem: (block: CanvasBlockKey, index: number) => void;
  onAddItem: (block: CanvasBlockKey) => void;
  onEditSegment: (id: string | null) => void;
  onEditStream: (id: string | null) => void;
  onEditResources: () => void;
  onEditSettings: () => void;
};

function Cell({ title, icon, question, area, children, action }: { title: string; icon: ReactNode; question: string; area: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 bg-surface-raised p-3.5 ${area}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-medium tracking-tight">{title}</h3>
        <span className="flex items-center gap-1 text-ink-muted">{action}{icon}</span>
      </div>
      <div className="text-[11px] leading-snug text-ink-muted">{question}</div>
      {children}
    </div>
  );
}

function Items({ def, block, locale, editable, edit }: { def: ModelDefinition; block: CanvasBlockKey; locale: Locale; editable: boolean; edit?: CanvasEditHandlers }) {
  const [open, setOpen] = useState(false);
  const items = def.canvas?.[block] ?? [];
  const segName = (id: string) => { const g = def.generators.find((x) => x.id === id); return g ? (g.short ?? g.name) : id; };
  const linkLabel = (id: string) => linkables(def).find((l) => l.id === id)?.label ?? id;
  if (!items.length) return <div className="text-[11px] italic text-ink-muted">{t(locale, 'not_described')}</div>;
  const shown = open ? items : items.slice(0, PREVIEW);
  return (
    <>
      <ul className="flex flex-col gap-1.5">
        {shown.map((raw, i) => {
          const it = itemObj(raw);
          const body = (
            <>
              {it.text}
              {((it.segments?.length ?? 0) > 0 || (it.links?.length ?? 0) > 0) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {(it.segments ?? []).map((id) => <span key={'s' + id} className="inline-flex rounded-full bg-surface-sunken px-1.5 text-[10px] leading-4 text-ink-subtle ring-1 ring-line">{segName(id)}</span>)}
                  {(it.links ?? []).map((id) => <span key={'l' + id} className="inline-flex rounded-full px-1.5 text-[10px] leading-4 text-ink-muted ring-1 ring-line">{linkLabel(id)}</span>)}
                </div>
              )}
            </>
          );
          return (
            <li key={it.id ?? i} className="relative pl-3 text-[12.5px] leading-snug before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-ink-muted">
              {editable && edit ? (
                <button type="button" onClick={() => edit.onEditItem(block, i)} className="-mx-1 -my-0.5 w-[calc(100%+0.5rem)] rounded px-1 py-0.5 text-left hover:bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong" title={t(locale, 'edit_statement')}>
                  {body}
                </button>
              ) : body}
            </li>
          );
        })}
      </ul>
      {items.length > PREVIEW && (
        <button type="button" onClick={() => setOpen(!open)} className="self-start text-[11px] text-ink-subtle underline-offset-2 hover:text-ink hover:underline">
          {open ? t(locale, 'show_less') : t(locale, 'more_n', { n: items.length - PREVIEW })}
        </button>
      )}
    </>
  );
}

const Sub = ({ children }: { children: ReactNode }) => <div className={`${SECTION_LABEL} mt-1`}>{children}</div>;
const Row = ({ a, b, c, total, onClick, title }: { a: ReactNode; b?: ReactNode; c: ReactNode; total?: boolean; onClick?: () => void; title?: string }) => (
  <tr className={`${total ? 'font-medium [&>td]:border-t [&>td]:border-line' : ''} ${onClick ? 'cursor-pointer hover:bg-surface-sunken' : ''}`} onClick={onClick} title={title}>
    <td className="border-b border-line/50 py-1 align-top">{a}</td>
    {b !== undefined && <td className="whitespace-nowrap border-b border-line/50 py-1 pl-2.5 text-right text-[11px] text-ink-muted">{b}</td>}
    <td className="whitespace-nowrap border-b border-line/50 py-1 pl-2.5 text-right tabular-nums">{c}</td>
  </tr>
);

export function BusinessModelCanvas({ model, state, s, locale, editable = false, edit, tall = false }: { model: ModelDefinition; state: ModelState; s: Summary; locale: Locale; editable?: boolean; edit?: CanvasEditHandlers; tall?: boolean }) {
  const [popup, setPopup] = useState<'variable' | 'fixed' | 'invest' | null>(null);
  const { fmtMoney, fmtMoneyK, fmtNum, fmtPct } = makeFormatters(model.currencySymbol ?? '');
  const unit = model.unitLabel ?? 'units';
  const ref = s.ref;
  const gens = model.generators;
  const segName = (id: string) => { const g = gens.find((x) => x.id === id); return g ? (g.short ?? g.name) : id; };
  const segs = gens.filter((g) => g.countsAsUnit !== false && !g.volume?.linkedTo);
  const maxRev = Math.max(...gens.map((g) => ref.gens[g.id]?.revenue ?? 0), 1);
  const ownCost = gens.reduce((a, g) => a + (ref.gens[g.id]?.cost ?? 0), 0);
  const generic = (model.genericVariable ?? []).reduce((a, c) => a + (ref.gens[c.id]?.cost ?? 0), 0);
  const priceOf = (g: ModelDefinition['generators'][number]) => {
    const r = ref.gens[g.id]!;
    if (g.revenueTotal != null) return `${fmtMoney(r.revenue)} / ${t(locale, 'unit_month')}`;
    const p = r.units > 0 ? r.revenue / r.units : 0;
    const base = g.volume?.linkedTo ? singular(segName(g.volume.linkedTo)).toLowerCase() : singular(unit);
    return `${fmtMoney(p)} ${t(locale, 'per')} ${base} × ${fmtNum(r.units)}`;
  };
  const acts: { label: string; who: string; unit: string; amount: number; gid?: string }[] = [];
  gens.forEach((g) => (g.costs ?? []).forEach((c) => { const amt = ref.gens[g.id]?.costLines[c.id] ?? 0; if (amt > 0) acts.push({ gid: g.id, label: c.label, who: g.short ?? g.name, unit: `${fmtMoney(state.generators[g.id]?.[c.id] ?? 0)} ${(c.unit ?? '').replace(/^[A-Z]{3}\s*/, '')}`, amount: amt }); }));
  (model.genericVariable ?? []).forEach((c) => { const r = ref.gens[c.id]; if (r && r.cost > 0) acts.push({ label: c.label, who: t(locale, 'all_streams'), unit: `${state.settings[c.id] ?? 0}${c.kind === 'percentRevenue' ? '% ' + t(locale, 'of_revenue') : ' ' + t(locale, 'per') + ' ' + singular(unit)}`, amount: r.cost }); });
  acts.sort((a, b) => b.amount - a.amount);
  const tbl = 'w-full border-collapse text-[12.5px]';

  // Default view: one total per block; the breakdown opens in a popup
  // (Sjoerd, 2026-09-26: "should only show total in default mode").
  const TotalLine = ({ label, value, onClick }: { label: string; value: string; onClick: () => void }) => (
    <button type="button" onClick={onClick} className="mt-1 flex w-full items-center justify-between gap-2 rounded border border-line bg-surface-sunken px-2 py-1 text-left text-[12.5px] hover:border-line-strong print:hidden" title={t(locale, 'show_breakdown')}>
      <span className="text-ink-subtle">{label}</span><span className="font-medium tabular-nums">{value}</span>
    </button>
  );
  const numbers: Partial<Record<CanvasBlockKey, ReactNode>> = {
    keyActivities: <TotalLine label={t(locale, 'variable_cost_month', { n: s.refMonth })} value={fmtMoney(ref.variableCost)} onClick={() => setPopup('variable')} />,
    keyResources: (
      <>
        <TotalLine label={t(locale, 'fixed_cost_per_month')} value={fmtMoney(ref.fixedCost)} onClick={() => setPopup('fixed')} />
        <TotalLine label={t(locale, 'one_off_investment')} value={fmtMoney(s.investmentTotal)} onClick={() => setPopup('invest')} />
      </>
    ),
  };
  const popupTitle = popup === 'variable' ? t(locale, 'variable_cost_month', { n: s.refMonth }) : popup === 'fixed' ? t(locale, 'fixed_cost_per_month') : t(locale, 'one_off_investment');
  const popupBody = popup === 'variable' ? (
    <table className={tbl}><tbody>
      {acts.map((a) => <Row key={a.label + a.who} onClick={editable && edit && a.gid ? () => { setPopup(null); edit.onEditStream(a.gid!); } : undefined} title={editable && a.gid ? t(locale, 'edit_stream') : undefined} a={<><span className="block">{a.label}</span><span className="block text-[11px] text-ink-muted">{a.who} · {a.unit}</span></>} c={fmtMoney(a.amount)} />)}
      <Row total a={t(locale, 'total_variable_cost')} c={fmtMoney(ref.variableCost)} />
    </tbody></table>
  ) : popup === 'fixed' ? (
    <table className={tbl}><tbody>
      {(model.fixedCosts ?? []).map((f) => <Row key={f.id} onClick={editable && edit ? () => { setPopup(null); edit.onEditResources(); } : undefined} a={f.label} c={fmtMoney(state.fixed[f.id] ?? 0)} />)}
      <Row total a={t(locale, 'total_fixed_cost')} c={fmtMoney(ref.fixedCost)} />
    </tbody></table>
  ) : (
    <table className={tbl}><tbody>
      {(model.investment ?? []).map((i) => <Row key={i.id} onClick={editable && edit ? () => { setPopup(null); edit.onEditResources(); } : undefined} a={i.label} c={fmtMoney(state.investment[i.id] ?? 0)} />)}
      <Row total a={t(locale, 'investment')} c={fmtMoney(s.investmentTotal)} />
    </tbody></table>
  );
  const addBtn = (block: CanvasBlockKey) => editable && edit ? (
    <button type="button" onClick={() => edit.onAddItem(block)} title={t(locale, 'add_statement')} className="rounded p-0.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"><Plus size={14} /></button>
  ) : null;

  return (
    <div id="canvas">
      <div className={`grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:[grid-template-columns:repeat(10,minmax(0,1fr))] ${tall ? 'lg:[grid-template-rows:minmax(0,1fr)_minmax(0,1fr)_auto] lg:min-h-[calc(100dvh-14rem)]' : 'lg:[grid-template-rows:auto_auto_auto]'} print:rounded-none`}>
        {BLOCKS.map((b) => (
          <Cell key={b.key} title={t(locale, b.title)} icon={b.icon} question={t(locale, `${b.title}_q`)} area={b.area} action={<>{b.key === 'keyResources' && editable && edit && <button type="button" onClick={() => edit.onEditResources()} title={t(locale, 'edit_resources')} className="rounded p-0.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"><Pencil size={13} /></button>}{addBtn(b.key)}</>}>
            <Items def={model} block={b.key} locale={locale} editable={editable} edit={edit} />
            {numbers[b.key]}
          </Cell>
        ))}
        <Cell title={t(locale, 'customer_segments')} icon={<Users size={16} />} question={t(locale, 'customer_segments_q', { n: s.refMonth })} area="lg:[grid-area:1/9/3/11]" action={editable && edit ? <button type="button" onClick={() => edit.onEditSegment(null)} title={t(locale, 'add_segment')} className="rounded p-0.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"><Plus size={14} /></button> : null}>
          <table className={tbl}><tbody>
            {segs.map((g) => <Row key={g.id} onClick={editable && edit ? () => edit.onEditSegment(g.id) : undefined} title={editable ? t(locale, 'edit_segment') : undefined} a={<><span className="block">{g.name}</span>{g.segment && <span className="block text-[11px] text-ink-muted">{g.segment}</span>}</>} c={fmtNum(ref.gens[g.id]?.units ?? 0)} />)}
            <Row total a={t(locale, 'total_units', { units: unit })} c={fmtNum(ref.units)} />
          </tbody></table>
          <Sub>{t(locale, 'by_year')}</Sub>
          <table className={tbl}><tbody>{s.years.map((y) => <Row key={y.year} a={t(locale, 'year_n', { n: y.year })} c={`${fmtNum(y.units)} ${unit}`} />)}</tbody></table>
          <div className="mt-auto pt-2 text-[11px] text-ink-muted">
            {s.breakEvenUnits != null ? t(locale, 'break_even_at', { n: fmtNum(s.breakEvenUnits), units: unit }) : t(locale, 'no_reachable_units', { units: unit })}
            {s.breakEvenMonth ? `, ${t(locale, 'reached_in_month', { n: s.breakEvenMonth })}` : ''}.
          </div>
        </Cell>
        <Cell title={t(locale, 'cost_structure')} icon={<Tag size={16} />} question={t(locale, 'cost_structure_q')} area="sm:col-span-2 lg:[grid-area:3/1/4/6]">
          <table className={tbl}><tbody>
            <Row a={<><span className="block">{t(locale, 'key_resources')}</span><span className="block text-[11px] text-ink-muted">{(model.fixedCosts ?? []).map((f) => f.label).join(', ')}</span></>} b={t(locale, 'fixed')} c={fmtMoney(ref.fixedCost)} />
            <Row a={<><span className="block">{t(locale, 'key_activities')}</span><span className="block text-[11px] text-ink-muted">{t(locale, 'activities_desc')}</span></>} b={t(locale, 'variable')} c={fmtMoney(ownCost)} />
            {generic > 0 && <Row a={(model.genericVariable ?? []).map((c) => c.label).join(', ')} b={t(locale, 'variable')} c={fmtMoney(generic)} />}
            <Row total a={t(locale, 'total_cost_per_month')} b="" c={fmtMoney(ref.totalCost)} />
          </tbody></table>
          <Sub>{t(locale, 'cost_by_year')}</Sub>
          <table className={tbl}><tbody>{s.years.map((y) => <Row key={y.year} a={t(locale, 'year_n', { n: y.year })} b={`${fmtPct((y.totalCost / (y.revenue || 1)) * 100)} ${t(locale, 'of_turnover')}`} c={fmtMoney(y.totalCost)} />)}</tbody></table>
          <div className="mt-auto pt-2 text-[11px] text-ink-muted">
            {t(locale, 'funding_line', { i: fmtMoney(s.investmentTotal), f: fmtMoney(s.fundingNeed), when: s.cashPositiveMonth ? t(locale, 'in_month_lower', { n: s.cashPositiveMonth }) : t(locale, 'not_within_months', { n: s.horizon }).toLowerCase() })}
          </div>
        </Cell>
        <Cell title={t(locale, 'revenue_streams')} icon={<Banknote size={16} />} question={t(locale, 'revenue_streams_q', { n: s.refMonth })} area="sm:col-span-2 lg:[grid-area:3/6/4/11]" action={editable && edit ? <button type="button" onClick={() => edit.onEditStream(null)} title={t(locale, 'add_stream')} className="rounded p-0.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"><Plus size={14} /></button> : null}>
          <table className={tbl}><tbody>
            {gens.map((g) => { const r = ref.gens[g.id]!; return (
              <Row key={g.id} onClick={editable && edit ? () => edit.onEditStream(g.id) : undefined} title={editable ? t(locale, 'edit_stream') : undefined} a={<><span className="block">{g.name}</span><span className="block text-[11px] text-ink-muted">{priceOf(g)}</span><div className="mt-1 h-1 rounded bg-surface-sunken"><div className="h-1 rounded bg-ink" style={{ width: `${((r.revenue / maxRev) * 100).toFixed(1)}%` }} /></div></>} b={fmtPct((r.revenue / (ref.revenue || 1)) * 100)} c={fmtMoney(r.revenue)} />
            ); })}
            <Row total a={t(locale, 'turnover_per_month')} b="" c={fmtMoney(ref.revenue)} />
          </tbody></table>
          <Sub>{t(locale, 'turnover_by_year')}</Sub>
          <table className={tbl}><tbody>{s.years.map((y) => <Row key={y.year} a={t(locale, 'year_n', { n: y.year })} b={`${t(locale, 'net').toLowerCase()} ${fmtMoneyK(y.net)}`} c={fmtMoney(y.revenue)} />)}</tbody></table>
          <div className="mt-auto pt-2 text-[11px] text-ink-muted">{t(locale, 'per_unit_per_month', { v: fmtMoney(s.arpu), unit: singular(unit), c: fmtMoney(s.contribution) })}</div>
        </Cell>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 px-0.5 text-[11px] text-ink-muted">
        <span className="flex items-center gap-2">{model.name}{model.tagline ? ` · ${model.tagline}` : ''}{editable && edit && <button type="button" onClick={() => edit.onEditSettings()} className="inline-flex items-center gap-1 rounded px-1 text-ink-subtle hover:bg-surface-sunken hover:text-ink print:hidden" title={t(locale, 'edit_settings')}><Settings2 size={12} />{t(locale, 'settings')}</button>}</span>
        <span>{t(locale, 'canvas_note', { n: s.refMonth })}</span>
      </div>
      {editable && <p className="mt-1 px-0.5 text-[11px] text-ink-muted print:hidden">{t(locale, 'canvas_edit_hint')} {t(locale, 'canvas_structure_hint')}</p>}
      <Dialog open={popup !== null} onClose={() => setPopup(null)} title={popupTitle} size="md">{popupBody}</Dialog>
    </div>
  );
}

export { CANVAS_BLOCK_KEYS };
