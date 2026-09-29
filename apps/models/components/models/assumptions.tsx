'use client';

// The Assumptions tab, set as a document rather than a dashboard (Sjoerd,
// 2026-09-29: "Like HEADER - listed assumptions. Not a full box per one.
// Simpler. Less heavy."). A header, a hairline, the lines under it. Stated
// assumptions first, under the team's own headers and numbered through, each
// with how sure it is; then what the model itself carries, read from the
// definition and the numbers as they stand, so the list is never out of step
// with the projection.

import { useMemo, useState } from 'react';
import { Check, ClipboardCopy, Plus } from 'lucide-react';
import { Button } from '@thefibre/shared/ui/button';
import { FIELD_CLASS, FIELD_INPUT_CLASS_INLINE } from '@thefibre/shared/ui/fields';
import { CHIP, CHIP_STATE, PILL, PILL_TONE } from '@thefibre/shared/ui/recipes';
import { ASSUMPTION_STATUSES, type AssumptionStatus, type ModelDefinition, type ModelState } from '@/lib/engine';
import { assumptionsText, buildAssumptions, statedList, statedSections, type AssumptionGroup, type Stated, type Words } from '@/lib/assumptions';
import { slugId } from '@/lib/structure';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';

const STATUS_KEY: Record<AssumptionStatus, UiKey> = { real: 'status_real', guess: 'status_guess', wrong: 'status_wrong', pending: 'status_pending' };
const STATUS_TONE: Record<AssumptionStatus, string> = { real: PILL_TONE.positive, guess: PILL_TONE.neutral, wrong: PILL_TONE.negative, pending: PILL_TONE.attention };

const H2 = 'text-[11px] font-medium uppercase tracking-[0.14em] text-ink-subtle';
const H3 = 'border-b border-line pb-1 text-[13px] font-medium tracking-tight';

function StatusMark({ status, locale }: { status?: AssumptionStatus; locale: Locale }) {
  if (!status) return null;
  return <span className={`${PILL} ${STATUS_TONE[status]} ml-2 align-middle`}>{t(locale, STATUS_KEY[status])}</span>;
}

/** One stated assumption being written: the sentence, its header, how sure. */
function StatedEditor({ a, sections, locale, onDone, onRemove }: { a: Stated; sections: string[]; locale: Locale; onDone: (next: Stated) => void; onRemove: () => void }) {
  const [text, setText] = useState(a.text);
  const [section, setSection] = useState(a.section ?? '');
  const [status, setStatus] = useState<AssumptionStatus | ''>(a.status ?? '');
  const listId = `sections-${a.id ?? 'new'}`;
  return (
    <div className="my-1 rounded-md bg-surface-sunken p-2.5">
      <textarea autoFocus value={text} rows={Math.max(2, Math.ceil(text.length / 95))} placeholder={t(locale, 'assumption_placeholder')} onChange={(e) => setText(e.target.value)} className={`${FIELD_CLASS} w-full resize-y`} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input list={listId} value={section} placeholder={t(locale, 'asm_header')} onChange={(e) => setSection(e.target.value)} className={`${FIELD_INPUT_CLASS_INLINE} h-8 w-64 max-w-full`} />
        <datalist id={listId}>{sections.map((x) => <option key={x} value={x} />)}</datalist>
        <select value={status} onChange={(e) => setStatus(e.target.value as AssumptionStatus | '')} className={`${FIELD_INPUT_CLASS_INLINE} h-8 w-48 max-w-full`}>
          <option value="">{t(locale, 'status_none')}</option>
          {ASSUMPTION_STATUSES.map((x) => <option key={x} value={x}>{t(locale, STATUS_KEY[x])}</option>)}
        </select>
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onRemove}>{t(locale, 'remove')}</Button>
        <Button variant="primary" size="sm" onClick={() => onDone({ ...a, text: text.trim(), section: section.trim() || undefined, status: status || undefined })}>{t(locale, 'done')}</Button>
      </div>
    </div>
  );
}

/** What the model itself carries: a header, then label and value per line. */
function ModelGroup({ g, changed }: { g: AssumptionGroup; changed: string }) {
  return (
    <section className="assumption-group min-w-0 break-inside-avoid">
      <h3 className={H3}>{g.title}{g.sub && <span className="ml-2 font-normal text-ink-muted">{g.sub}</span>}</h3>
      <dl className="mt-1">
        {g.rows.map((r) => (
          <div key={r.id} className="grid grid-cols-1 gap-x-4 py-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <dt className="min-w-0 text-[13px] text-ink-subtle">{r.label}{r.code && <code className="ml-1.5 text-[11px] text-ink-muted">{r.code}</code>}</dt>
            <dd className="min-w-0 text-[13px]">
              <span className={r.rule ? '' : 'font-medium tabular-nums'}>{r.value}</span>
              {r.was && <span className="ml-2 text-[12px] text-ink-muted" title={changed}>({r.was})</span>}
              {r.note && <span className="block text-[12px] text-ink-muted">{r.note}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export type AssumptionsView = 'list' | 'model';

export function Assumptions({ model, state, horizon, refMonth, locale, editable, view, onView, onStated }: {
  model: ModelDefinition; state: ModelState; horizon: number; refMonth: number; locale: Locale; editable: boolean;
  view: AssumptionsView; onView: (v: AssumptionsView) => void;
  /** Admins and team leads write the stated assumptions; the page saves them in the definition. */
  onStated: (list: Stated[]) => void;
}) {
  const T: Words = useMemo(() => (key, vars) => t(locale, key, vars), [locale]);
  const groups = useMemo(() => buildAssumptions(model, state, { horizon, refMonth }, T), [model, state, horizon, refMonth, T]);
  const stated = statedList(model);
  const sections = statedSections(stated, true);
  const headers = sections.map((x) => x.title).filter(Boolean);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [newIn, setNewIn] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const changedCount = groups.reduce((a, g) => a + g.rows.filter((r) => r.was).length, 0);
  const chip = (on: boolean) => `${CHIP} ${on ? CHIP_STATE.on : CHIP_STATE.off}`;

  async function copy() {
    const text = assumptionsText(`${model.name}: ${t(locale, 'tab_assumptions').toLowerCase()}`, t(locale, 'stated_assumptions'), stated, view === 'list' ? [] : groups, (st) => t(locale, STATUS_KEY[st]));
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { window.prompt(t(locale, 'copy_as_text'), text); }
  }
  function save(index: number | 'new', next: Stated) {
    setEditing(null);
    if (index === 'new') { if (next.text) onStated([...stated, { ...next, id: slugId(`a${stated.length + 1}`, stated.map((a) => a.id ?? ''), 'a') }]); return; }
    onStated(next.text ? stated.map((a, j) => (j === index ? next : a)) : stated.filter((_, j) => j !== index));
  }
  const startNew = (section: string) => { setNewIn(section); setEditing('new'); };

  return (
    <div id="assumptions" className="mx-auto max-w-5xl">
      <div className="assumptions-title hidden print:block">
        <div className="text-xl font-semibold tracking-tight">{model.name}</div>
        <div className="text-xs uppercase tracking-widest">{t(locale, 'tab_assumptions')} · {t(locale, view === 'list' ? 'view_assumption_list' : 'asm_from_model')}</div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onView('list')} className={chip(view === 'list')}>{t(locale, 'view_assumption_list')}{stated.filter((a) => a.text).length > 0 && <span className="ml-1.5 tabular-nums opacity-70">{stated.filter((a) => a.text).length}</span>}</button>
          <button type="button" onClick={() => onView('model')} className={chip(view === 'model')}>{t(locale, 'asm_from_model')}</button>
        </div>
        <Button variant="ghost" size="sm" onClick={copy}>{copied ? <Check size={14} /> : <ClipboardCopy size={14} />}<span className="ml-1.5">{copied ? t(locale, 'copied') : t(locale, 'copy_as_text')}</span></Button>
      </div>

      {view === 'list' && (
        <div className="mt-5 max-w-3xl">
          <p className="text-[13px] text-ink-muted print:hidden">{t(locale, 'stated_assumptions_hint')}</p>
          {sections.length === 0 && editing !== 'new' && <p className="mt-4 text-sm italic text-ink-muted">{t(locale, 'stated_none')}</p>}
          {sections.map((sec) => (
            <section key={sec.title || '_'} className="assumption-group mt-6 break-inside-avoid first:mt-4">
              <div className="flex items-end justify-between gap-2 border-b border-line pb-1">
                <h3 className={H2}>{sec.title || t(locale, 'stated_assumptions')}</h3>
                {editable && <button type="button" onClick={() => startNew(sec.title)} title={t(locale, 'add_assumption')} className="text-ink-muted hover:text-ink print:hidden"><Plus size={14} /></button>}
              </div>
              <ol className="mt-1.5">
                {sec.items.map(({ a, index, n }) => (
                  <li key={a.id ?? index}>
                    {editing === index ? <StatedEditor a={a} sections={headers} locale={locale} onDone={(next) => save(index, next)} onRemove={() => { setEditing(null); onStated(stated.filter((_, j) => j !== index)); }} /> : (
                      <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] py-1 text-[14px] leading-relaxed">
                        <span className="tabular-nums text-ink-muted">{n}.</span>
                        {editable ? (
                          <button type="button" onClick={() => setEditing(index)} title={t(locale, 'edit')} className="-mx-1 rounded px-1 text-left hover:bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong">{a.text}<StatusMark status={a.status} locale={locale} /></button>
                        ) : <span>{a.text}<StatusMark status={a.status} locale={locale} /></span>}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
              {editing === 'new' && newIn === sec.title && <StatedEditor a={{ text: '', section: sec.title || undefined }} sections={headers} locale={locale} onDone={(next) => save('new', next)} onRemove={() => setEditing(null)} />}
            </section>
          ))}
          {editing === 'new' && !sections.some((x) => x.title === newIn) && <div className="mt-4"><StatedEditor a={{ text: '', section: newIn || undefined }} sections={headers} locale={locale} onDone={(next) => save('new', next)} onRemove={() => setEditing(null)} /></div>}
          {editable && editing === null && <button type="button" onClick={() => startNew('')} className="mt-5 inline-flex items-center gap-1 text-[13px] text-ink-subtle hover:text-ink print:hidden"><Plus size={14} />{t(locale, 'add_assumption')}</button>}
        </div>
      )}

      {view === 'model' && (
        <div className="mt-5">
          <p className="max-w-3xl text-[13px] text-ink-muted print:hidden">{t(locale, 'assumptions_intro')}{changedCount > 0 && <> {t(locale, 'asm_changed_count', { n: changedCount })}</>}</p>
          <div className="mt-4 gap-x-10 lg:columns-2 print:columns-2">
            {groups.map((g) => <div key={g.id} className="mb-6 break-inside-avoid"><ModelGroup g={g} changed={t(locale, 'asm_changed')} /></div>)}
          </div>
        </div>
      )}
    </div>
  );
}
