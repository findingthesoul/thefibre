'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createFlow } from './actions';

type Scope = 'personal' | 'team' | 'workspace';

export function NewFlowButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800"
      >
        <Plus size={16} strokeWidth={2} />
        New flow
      </button>
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

  async function submit() {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-medium">New flow</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
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
                  onClick={() => setScope(s)}
                  className={`rounded-md border px-3 py-2 text-sm capitalize ${
                    scope === s
                      ? 'border-neutral-900 bg-neutral-900 text-white'
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
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-ink-subtle hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create flow'}
          </button>
        </div>
      </div>
    </div>
  );
}
