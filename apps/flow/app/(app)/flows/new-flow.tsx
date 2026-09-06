'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { createFlow } from './actions';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';

type Scope = 'personal' | 'team' | 'workspace';

const SCOPE_KEY: Record<Scope, UiKey> = {
  personal: 'scope_personal',
  team: 'scope_team',
  workspace: 'scope_workspace',
};

export function NewFlowButton({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button leading={<Plus size={16} strokeWidth={2} />} onClick={() => setOpen(true)}>
        {t(locale, 'new_flow')}
      </Button>
      {open && <NewFlowDialog locale={locale} onClose={() => setOpen(false)} />}
    </>
  );
}

function NewFlowDialog({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<Scope>('personal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!name.trim()) {
      setError(t(locale, 'name_required'));
      return;
    }
    if (scope === 'team') {
      setError(t(locale, 'team_scope_unavailable'));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createFlow({
      name: name.trim(),
      description: description.trim() || null,
      scope,
    });
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    if (res.data?.id) {
      router.push(`/flows/${res.data.id}`);
    } else {
      onClose();
      router.refresh();
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(locale, 'new_flow')}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="new-flow-form" disabled={busy}>
            {busy ? t(locale, 'creating') : t(locale, 'create_flow')}
          </Button>
        </>
      }
    >
      <form id="new-flow-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'name')}</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(locale, 'name_example_ph')}
            className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'description')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder={t(locale, 'optional')}
            className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">{t(locale, 'scope')}</label>
          <div className="grid grid-cols-3 gap-2">
            {(['personal', 'workspace', 'team'] as Scope[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`rounded-md border px-3 py-2 text-sm ${
                  scope === s
                    ? 'border-ink bg-ink text-ink-inverse'
                    : 'border-line text-ink-subtle hover:border-line-strong'
                }`}
              >
                {t(locale, SCOPE_KEY[s])}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">
            {scope === 'personal' && t(locale, 'scope_personal_hint')}
            {scope === 'workspace' && t(locale, 'scope_workspace_hint')}
            {scope === 'team' && t(locale, 'scope_team_hint')}
          </p>
        </div>
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </Dialog>
  );
}
