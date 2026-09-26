'use client';

// Putting the first person into a workspace that has nobody.
//
// Sjoerd made a workspace to present from, and could not get into it — and
// neither could anybody else, because membership is a user ROW and nothing in
// the product could create one for a workspace you are not already in. The
// remedy was editing the database by hand, which is the thing a product
// should make unnecessary: *"I want to to be fixed on an approach"*
// (2026-09-26).
//
// Only ever offered on a workspace with no users, and the API enforces that
// independently — the button being hidden is a courtesy, not the guard.

import { useState, useTransition } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { addFirstAdmin } from './actions';
import type { Workspace } from './list';

export function FirstAdminDialog({
  workspace,
  onClose,
}: {
  workspace: Workspace;
  onClose: (changed: boolean) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const field =
    'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-line-strong';

  function save() {
    setError(null);
    if (!email.trim()) {
      setError('An email address — it is the only way in.');
      return;
    }
    start(async () => {
      const r = await addFirstAdmin(workspace.id, email.trim(), name.trim() || null);
      if (r.error) setError(r.error);
      else onClose(true);
    });
  }

  return (
    <Dialog
      open
      onClose={() => onClose(false)}
      title={`First admin for ${workspace.name}`}
      description="This workspace has nobody in it, so nobody can open it. Give it a first admin and it becomes usable."
      footer={
        <>
          <Button variant="ghost" onClick={() => onClose(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !email.trim()}>
            {pending ? 'Adding…' : 'Add first admin'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="text-ink-subtle">Email</span>
          <input
            className={`${field} mt-1`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="them@their-organisation.org"
            autoFocus
          />
          <span className="mt-1 block text-xs text-ink-muted">
            They become super admin of this workspace, its apps are switched on, and they get an
            email. They sign in with this address — Google, or an emailed code if they have no
            Google account on it.
          </span>
        </label>
        <label className="block text-sm">
          <span className="text-ink-subtle">Name (optional)</span>
          <input
            className={`${field} mt-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional"
          />
        </label>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </Dialog>
  );
}
