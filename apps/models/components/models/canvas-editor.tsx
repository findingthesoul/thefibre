'use client';

// One statement of the canvas: its text, the segments it serves (value
// propositions), and the turnover and cost items it stands for. Admins and
// team leads only; the API says no to anyone else.

import { useEffect, useState } from 'react';
import { Button } from '@thefibre/shared/ui/button';
import { Dialog } from '@thefibre/shared/ui/dialog';
import { TextAreaField } from '@thefibre/shared/ui/fields';
import { SECTION_LABEL } from '@thefibre/shared/ui/recipes';
import type { CanvasBlockKey, CanvasItem, ModelDefinition } from '@/lib/engine';
import { itemObj } from '@/lib/engine';
import { linkables } from '@/lib/links';
import { t, type Locale } from '@/lib/i18n-ui';

const TITLES: Record<CanvasBlockKey, 'key_partners' | 'key_activities' | 'key_resources' | 'value_propositions' | 'customer_relationships' | 'channels'> = {
  keyPartners: 'key_partners', keyActivities: 'key_activities', keyResources: 'key_resources', valuePropositions: 'value_propositions', customerRelationships: 'customer_relationships', channels: 'channels',
};

export function CanvasEditor({ open, def, block, item, locale, onSave, onDelete, onClose }: {
  open: boolean; def: ModelDefinition; block: CanvasBlockKey; item: CanvasItem | null; locale: Locale;
  onSave: (item: { id: string; text: string; segments?: string[]; links?: string[] }) => void; onDelete: () => void; onClose: () => void;
}) {
  const base = item ? itemObj(item) : { text: '' };
  const [text, setText] = useState(base.text);
  const [segments, setSegments] = useState<string[]>(base.segments ?? []);
  const [links, setLinks] = useState<string[]>(base.links ?? []);
  useEffect(() => { const b = item ? itemObj(item) : { text: '' }; setText(b.text); setSegments(b.segments ?? []); setLinks(b.links ?? []); }, [item, open]);
  const segs = def.generators.filter((g) => g.countsAsUnit !== false && !g.volume?.linkedTo);
  const all = linkables(def);
  const groups = Array.from(new Set(all.map((l) => l.group)));
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const id = base.id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()));
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={`${t(locale, TITLES[block])} — ${item ? t(locale, 'edit_statement') : t(locale, 'add_statement')}`}
      footer={
        <>
          {item && <Button variant="danger" onClick={() => { if (confirm(t(locale, 'delete_statement_confirm'))) onDelete(); }}>{t(locale, 'delete')}</Button>}
          <Button variant="secondary" onClick={onClose}>{t(locale, 'cancel')}</Button>
          <Button variant="primary" type="submit" disabled={!text.trim()} onClick={() => onSave({ id, text: text.trim(), ...(segments.length ? { segments } : {}), ...(links.length ? { links } : {}) })}>{t(locale, 'save')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextAreaField label={t(locale, 'statement_text')} rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        {block === 'valuePropositions' && segs.length > 0 && (
          <div>
            <div className={SECTION_LABEL}>{t(locale, 'serves_segments')}</div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {segs.map((g) => (
                <label key={g.id} className="inline-flex items-center gap-1.5 text-sm"><input type="checkbox" checked={segments.includes(g.id)} onChange={() => toggle(segments, setSegments, g.id)} />{g.short ?? g.name}</label>
              ))}
            </div>
          </div>
        )}
        <div>
          <div className={SECTION_LABEL}>{t(locale, 'linked_items')}</div>
          <p className="mt-0.5 text-xs text-ink-muted">{t(locale, 'linked_items_hint')}</p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {groups.map((grp) => (
              <div key={grp}>
                <div className="text-[11px] font-medium text-ink-subtle">{grp}</div>
                <div className="mt-1 flex flex-col gap-1">
                  {all.filter((l) => l.group === grp).map((l) => (
                    <label key={l.id} className="inline-flex items-center gap-1.5 text-sm"><input type="checkbox" checked={links.includes(l.id)} onChange={() => toggle(links, setLinks, l.id)} />{l.label}</label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
