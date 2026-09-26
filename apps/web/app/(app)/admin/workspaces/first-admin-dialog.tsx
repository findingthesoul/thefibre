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
import { PersonEmailField, type ChosenAdmin } from '@/components/ui/person-email-field';
import type { Workspace } from './list';

export function FirstAdminDialog({
  workspace,
  onClose,
}: {
  workspace: Workspace;
  onClose: (changed: boolean) => void;
}) {
  const [chosen, setChosen] = useState<ChosenAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    if (!chosen) {
      setError('Pick the person, or type their email address — it is the only way in.');
      return;
    }
    start(async () => {
      const r = await addFirstAdmin(workspace.id, chosen.email, chosen.name);
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
          <Button onClick={save} disabled={pending || !chosen}>
            {pending ? 'Adding…' : 'Add first admin'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <PersonEmailField label="First admin" value={chosen} onChange={setChosen} disabled={pending} />
        <p className="text-xs text-ink-muted">
          They become super admin of this workspace, its apps are switched on, and they get an
          email. They sign in with that address — Google, or an emailed code if they have no
          Google account on it.
        </p>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </Dialog>
  );
}
