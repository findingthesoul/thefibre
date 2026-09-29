'use client';

// The Assumptions tab: what this calculation rests on, as a list to read,
// check with a colleague, print or paste into a mail. Stated assumptions (the
// ones nobody can type as a number) come first and are written by admins and
// team leads; the rest is read from the definition and the numbers as they
// stand now, so the list is never out of step with the projection.

import { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardCopy, Plus, Trash2 } from 'lucide-react';
import { Button } from '@thefibre/shared/ui/button';
import { FIELD_CLASS } from '@thefibre/shared/ui/fields';
import { CARD, PILL, PILL_TONE, SECTION_LABEL } from '@thefibre/shared/ui/recipes';
import type { ModelDefinition, ModelState } from '@/lib/engine';
import { assumptionsText, buildAssumptions, statedList, type AssumptionGroup, type Stated, type Words } from '@/lib/assumptions';
import { slugId } from '@/lib/structure';
import { t, type Locale } from '@/lib/i18n-ui';

function StatedLine({ value, editable, placeholder, removeLabel, onCommit, onRemove }: { value: string; editable: boolean; placeholder: string; removeLabel: string; onCommit: (text: string) => void; onRemove: () => void }) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  if (!editable) return <li className="relative pl-4 text-sm leading-snug before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-ink-muted">{value}</li>;
  return (
    <li className="flex items-start gap-2 print:block">
      <textarea value={text} rows={Math.max(1, Math.ceil(text.length / 90))} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onBlur={() => { if (text.trim() !== value) onCommit(text.trim()); }} className={`${FIELD_CLASS} min-h-[38px] flex-1 resize-y print:hidden`} />
      <span className="hidden print:block">{text}</span>
      <button type="button" onClick={onRemove} title={removeLabel} className="mt-2 text-ink-muted hover:text-ink print:hidden"><Trash2 size={15} /></button>
    </li>
  );
}

function GroupCard({ g, changed }: { g: AssumptionGroup; changed: string }) {
  return (
    <section className={`${CARD} assumption-card min-w-0 p-4`}>
      <h3 className="text-[15px] font-medium tracking-tight">{g.title}</h3>
      {g.sub && <p className="mt-0.5 text-[12.5px] text-ink-muted">{g.sub}</p>}
      <dl className="mt-2 divide-y divide-line/60">
        {g.rows.map((r) => (
          <div key={r.id} className="grid grid-cols-1 gap-x-4 gap-y-0.5 py-1.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <dt className="min-w-0 text-[13px] text-ink-subtle">
              {r.label}
              {r.code && <code className="ml-1.5 text-[11px] text-ink-muted">{r.code}</code>}
            </dt>
            <dd className="min-w-0 text-[13px]">
              <span className={r.rule ? '' : 'font-medium tabular-nums'}>{r.value}</span>
              {r.was && <span className={`${PILL} ${PILL_TONE.neutral} ml-2 align-middle`} title={changed}>{r.was}</span>}
              {r.note && <span className="block text-[12px] text-ink-muted">{r.note}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function Assumptions({ model, state, horizon, refMonth, locale, editable, onStated }: {
  model: ModelDefinition; state: ModelState; horizon: number; refMonth: number; locale: Locale; editable: boolean;
  /** Admins and team leads write the stated assumptions; the page saves them in the definition. */
  onStated: (list: Stated[]) => void;
}) {
  const T: Words = useMemo(() => (key, vars) => t(locale, key, vars), [locale]);
  const groups = useMemo(() => buildAssumptions(model, state, { horizon, refMonth }, T), [model, state, horizon, refMonth, T]);
  const stated = statedList(model);
  const [copied, setCopied] = useState(false);
  const changedCount = groups.reduce((a, g) => a + g.rows.filter((r) => r.was).length, 0);

  async function copy() {
    const text = assumptionsText(`${model.name}: ${t(locale, 'tab_assumptions').toLowerCase()}`, t(locale, 'stated_assumptions'), stated.filter((a) => a.text), groups);
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { window.prompt(t(locale, 'copy_as_text'), text); }
  }
  const commit = (i: number, text: string) => onStated(text ? stated.map((a, j) => (j === i ? { ...a, text } : a)) : stated.filter((_, j) => j !== i));
  const add = () => onStated([...stated, { id: slugId(`a${stated.length + 1}`, stated.map((a) => a.id ?? ''), 'a'), text: '' }]);

  return (
    <div id="assumptions" className="mx-auto max-w-6xl">
      <div className="assumptions-title hidden print:block">
        <div className="text-xl font-semibold tracking-tight">{model.name}</div>
        <div className="text-xs uppercase tracking-widest">{t(locale, 'tab_assumptions')}</div>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <p className="max-w-3xl text-[13px] text-ink-muted">{t(locale, 'assumptions_intro')}{changedCount > 0 && <> {t(locale, 'asm_changed_count', { n: changedCount })}</>}</p>
        <Button variant="secondary" size="sm" onClick={copy}>{copied ? <Check size={14} /> : <ClipboardCopy size={14} />}<span className="ml-1.5">{copied ? t(locale, 'copied') : t(locale, 'copy_as_text')}</span></Button>
      </div>

      <section className={`${CARD} assumption-card mt-3 p-4`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-medium tracking-tight">{t(locale, 'stated_assumptions')}</h3>
          {editable && <button type="button" onClick={add} className="inline-flex items-center gap-1 text-xs text-ink-subtle hover:text-ink print:hidden"><Plus size={13} />{t(locale, 'add_assumption')}</button>}
        </div>
        <p className="mt-0.5 text-[12.5px] text-ink-muted print:hidden">{t(locale, 'stated_assumptions_hint')}</p>
        {(editable ? stated : stated.filter((a) => a.text)).length === 0 ? <p className="mt-2 text-sm italic text-ink-muted">{t(locale, 'stated_none')}</p> : (
          <ul className="mt-2 flex flex-col gap-2">
            {stated.map((a, i) => (!editable && !a.text ? null : <StatedLine key={a.id ?? i} value={a.text} editable={editable} placeholder={t(locale, 'assumption_placeholder')} removeLabel={t(locale, 'remove')} onCommit={(text) => commit(i, text)} onRemove={() => onStated(stated.filter((_, j) => j !== i))} />))}
          </ul>
        )}
      </section>

      <div className={`${SECTION_LABEL} mt-5`}>{t(locale, 'asm_from_model')}</div>
      <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-2 print:grid-cols-2">
        {groups.map((g) => <GroupCard key={g.id} g={g} changed={t(locale, 'asm_changed')} />)}
      </div>
    </div>
  );
}
