'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createGrant, deleteGrant } from './actions';
import { GRANT_KINDS, GRANT_KIND_LABELS, type Grant, type GrantKind } from './types';
import type { Tier } from '../tiers/types';

const INPUT =
  'w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:opacity-50';

// The API has no PATCH for grants — an existing grant opens read-only with
// Delete; to change one, delete and re-create.
export function GrantDialog({
  grant,
  tiers,
  circleTokenSet,
  onClose,
}: {
  grant: Grant | null; // null = new
  tiers: Tier[];
  circleTokenSet: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const existing = Boolean(grant);
  const [tierId, setTierId] = useState(grant?.tier_id ?? tiers[0]?.id ?? '');
  const [kind, setKind] = useState<GrantKind>(grant?.kind ?? 'circle');
  const [ref, setRef] = useState(() => {
    const raw = grant?.kind === 'circle' ? grant?.config?.space_id : grant?.config?.thread_slug;
    return typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '';
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (existing) return;
    if (!tierId) {
      setError('Pick a tier.');
      return;
    }
    if (!ref.trim()) {
      setError(kind === 'circle' ? 'Space ID is required.' : 'Thread slug is required.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createGrant({
      tier_id: tierId,
      kind,
      config: kind === 'circle' ? { space_id: ref.trim() } : { thread_slug: ref.trim() },
    });
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    onClose();
    router.refresh();
  }

  async function handleDelete() {
    if (!grant) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await deleteGrant(grant.id);
    if (res.error) {
      setError(res.error);
      setBusy(false);
      setConfirmDelete(false);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? 'Access grant' : 'New grant'}
      footer={
        <>
          {existing && (
            <Button
              type="button"
              variant="danger"
              className="mr-auto"
              disabled={busy}
              onClick={handleDelete}
            >
              {confirmDelete ? 'Really delete?' : 'Delete'}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {!existing && (
            <Button type="submit" form="grant-form" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          )}
        </>
      }
    >
      <form id="grant-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Tier</label>
          <select
            value={tierId}
            onChange={(e) => setTierId(e.target.value)}
            disabled={existing}
            className={INPUT}
          >
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Kind</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as GrantKind)}
            disabled={existing}
            className={INPUT}
          >
            {GRANT_KINDS.map((k) => (
              <option key={k} value={k}>
                {GRANT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            {kind === 'circle' ? 'Space ID' : 'Thread slug'}
          </label>
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            disabled={existing}
            placeholder={kind === 'circle' ? 'e.g. 123456' : 'e.g. post-athens-journey'}
            className={INPUT}
          />
        </div>
        {kind === 'circle' && !circleTokenSet && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40">
            Add your Circle API token in Settings for this grant to sync.
          </div>
        )}
        {existing && (
          <p className="text-xs text-ink-muted">
            Grants can&apos;t be edited — delete this one and create a new grant to change it.
          </p>
        )}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </Dialog>
  );
}
