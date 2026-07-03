'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { createFlow } from './actions';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type Scope = 'personal' | 'team' | 'workspace';

export function NewFlowButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button leading={<Plus size={16} strokeWidth={2} />} onClick={() => setOpen(true)}>
        New flow
      </Button>
      {open && <NewFlowDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function NewFlowDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<Scope>('personal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (scope === 'team') {
      setError('Team-scoped flows need a team picker — not in this build yet. Use Personal or Workspace for now.');
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
      title="New flow"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-flow-form" disabled={busy}>
            {busy ? 'Creating…' : 'Create flow'}
          </Button>
        </>
      }
    >
      <form id="new-flow-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sales pipeline"
            className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Optional"
            className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Scope</label>
          <div className="grid grid-cols-3 gap-2">
            {(['personal', 'workspace', 'team'] as Scope[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`rounded-md border px-3 py-2 text-sm capitalize ${
                  scope === s
                    ? 'border-ink bg-ink text-ink-inverse'
                    : 'border-line text-ink-subtle hover:border-line-strong'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">
            {scope === 'personal' && 'Only you can see and run this flow.'}
            {scope === 'workspace' && 'Everyone in the workspace can see and run it.'}
            {scope === 'team' && 'Team picker coming in a later build.'}
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
