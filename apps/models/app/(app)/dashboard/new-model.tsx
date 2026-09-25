'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@thefibre/shared/ui/button';
import { Dialog } from '@thefibre/shared/ui/dialog';
import { TextField, SelectField, TextAreaField } from '@thefibre/shared/ui/fields';
import { ERROR_TEXT } from '@thefibre/shared/ui/recipes';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { t } from '@/lib/i18n-ui';
import { TEMPLATES } from '@/lib/templates';
import type { ModelDefinition } from '@/lib/engine';
import { createModel, type TeamChoice } from '../models/actions';

export function NewModelButton({ teams, isAdmin }: { teams: TeamChoice[]; isAdmin: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [teamId, setTeamId] = useState<string>(teams.find((x) => x.role !== 'member')?.id ?? (isAdmin ? '' : ''));
  const [source, setSource] = useState<string>('doab');
  const [pasted, setPasted] = useState('');

  const teamOptions = [
    ...(isAdmin ? [{ value: '', label: t(locale, 'workspace_wide') }] : []),
    ...teams.filter((x) => x.role !== 'member').map((x) => ({ value: x.id, label: x.name })),
  ];
  const sourceOptions = [...TEMPLATES.map((x) => ({ value: x.id, label: x.name })), { value: 'paste', label: t(locale, 'paste_definition') }];

  async function submit() {
    setError(null);
    if (!name.trim()) return setError(t(locale, 'name_required'));
    let definition: ModelDefinition | null = null;
    if (source === 'paste') {
      try {
        const parsed = JSON.parse(pasted) as ModelDefinition;
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.generators) || !parsed.generators.length) throw new Error('shape');
        definition = { ...parsed, name: parsed.name || name.trim() };
      } catch {
        return setError(t(locale, 'bad_json'));
      }
    } else {
      const tpl = TEMPLATES.find((x) => x.id === source)!;
      definition = { ...tpl.definition, name: name.trim(), tagline: tagline.trim() || tpl.definition.tagline };
    }
    setBusy(true);
    const r = await createModel({ name: name.trim(), tagline: tagline.trim() || null, team_id: teamId || null, definition });
    setBusy(false);
    if (r.error || !r.id) return setError(r.error ?? t(locale, 'create_failed'));
    setOpen(false);
    router.push(`/models/${r.id}`);
    router.refresh();
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)} leading={<Plus size={16} />}>{t(locale, 'new_model')}</Button>
      <Dialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={t(locale, 'new_model')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>{t(locale, 'cancel')}</Button>
            <Button variant="primary" type="submit" onClick={submit} disabled={busy}>{busy ? t(locale, 'creating') : t(locale, 'create')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextField label={t(locale, 'name')} required value={name} onChange={(e) => setName(e.target.value)} placeholder={t(locale, 'name_ph')} autoFocus />
          <TextField label={`${t(locale, 'tagline')} (${t(locale, 'optional').toLowerCase()})`} value={tagline} onChange={(e) => setTagline(e.target.value)} />
          <SelectField label={t(locale, 'team')} value={teamId} onChange={(e) => setTeamId(e.target.value)} options={teamOptions} />
          <SelectField label={t(locale, 'start_from')} value={source} onChange={(e) => setSource(e.target.value)} options={sourceOptions} />
          {source !== 'paste' && (
            <p className="text-sm text-ink-subtle">{TEMPLATES.find((x) => x.id === source)?.blurb}</p>
          )}
          {source === 'paste' && (
            <TextAreaField label={t(locale, 'paste_definition')} hint={t(locale, 'paste_hint')} rows={8} value={pasted} onChange={(e) => setPasted(e.target.value)} spellCheck={false} />
          )}
          {error && <div className={ERROR_TEXT}>{error}</div>}
        </div>
      </Dialog>
    </>
  );
}
