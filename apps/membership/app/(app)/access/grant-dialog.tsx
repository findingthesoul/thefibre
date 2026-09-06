'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import { createGrant, deleteGrant } from './actions';
import { GRANT_KINDS, type Grant, type GrantKind } from './types';
import type { Tier } from '../tiers/types';

const INPUT =
  'w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:opacity-50';

const GRANT_KIND_KEYS: Record<GrantKind, UiKey> = {
  circle: 'grant_kind_circle',
  thread: 'grant_kind_thread',
  fibre_seat: 'grant_kind_fibre_seat',
  google_user: 'grant_kind_google_user',
};

// The API has no PATCH for grants — an existing grant opens read-only with
// Delete; to change one, delete and re-create.
export function GrantDialog({
  grant,
  tiers,
  circleTokenSet,
  locale,
  onClose,
}: {
  grant: Grant | null; // null = new
  tiers: Tier[];
  circleTokenSet: boolean;
  locale: Locale;
  onClose: () => void;
}) {
  const router = useRouter();
  const existing = Boolean(grant);
  const [tierId, setTierId] = useState(grant?.tier_id ?? tiers[0]?.id ?? '');
  const [kind, setKind] = useState<GrantKind>(grant?.kind ?? 'circle');
  const [ref, setRef] = useState(() => {
    const raw =
      grant?.kind === 'circle'
        ? grant?.config?.space_id
        : grant?.kind === 'fibre_seat'
          ? grant?.config?.role
          : grant?.config?.thread_slug;
    return typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '';
  });
  const [seatRole, setSeatRole] = useState<'organiser' | 'admin'>(
    grant?.config?.role === 'admin' ? 'admin' : 'organiser',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (existing) return;
    if (!tierId) {
      setError(t(locale, 'pick_a_tier'));
      return;
    }
    if (kind !== 'fibre_seat' && kind !== 'google_user' && !ref.trim()) {
      setError(kind === 'circle' ? t(locale, 'space_id_required') : t(locale, 'thread_slug_required'));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createGrant({
      tier_id: tierId,
      kind,
      config:
        kind === 'circle'
          ? { space_id: ref.trim() }
          : kind === 'fibre_seat'
            ? { role: seatRole }
            : { thread_slug: ref.trim() },
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
      title={existing ? t(locale, 'access_grant') : t(locale, 'new_grant')}
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
              {confirmDelete ? t(locale, 'really_delete_q') : t(locale, 'delete')}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            {t(locale, 'cancel')}
          </Button>
          {!existing && (
            <Button type="submit" form="grant-form" disabled={busy}>
              {busy ? t(locale, 'saving') : t(locale, 'save')}
            </Button>
          )}
        </>
      }
    >
      <form id="grant-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'tier')}</label>
          <select
            value={tierId}
            onChange={(e) => setTierId(e.target.value)}
            disabled={existing}
            className={INPUT}
          >
            {tiers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'kind')}</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as GrantKind)}
            disabled={existing}
            className={INPUT}
          >
            {GRANT_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(locale, GRANT_KIND_KEYS[k])}
              </option>
            ))}
          </select>
        </div>
        {kind === 'fibre_seat' ? (
          <div>
            <label className="block text-sm font-medium mb-1">{t(locale, 'workspace_role')}</label>
            <select
              value={seatRole}
              onChange={(e) => setSeatRole(e.target.value as 'organiser' | 'admin')}
              disabled={existing}
              className={INPUT}
            >
              <option value="organiser">{t(locale, 'organiser')}</option>
              <option value="admin">{t(locale, 'admin')}</option>
            </select>
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40">
              {t(locale, 'billed_seat_warn_before')}{' '}
              <strong>{t(locale, 'billed_seat_strong')}</strong>{' '}
              {t(locale, 'billed_seat_warn_after')}
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">
              {kind === 'circle' ? t(locale, 'space_id') : t(locale, 'thread_slug')}
            </label>
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              disabled={existing}
              placeholder={kind === 'circle' ? t(locale, 'space_id_eg') : t(locale, 'thread_slug_eg')}
              className={INPUT}
            />
          </div>
        )}
        {kind === 'circle' && !circleTokenSet && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40">
            {t(locale, 'circle_token_warning')}
          </div>
        )}
        {existing && (
          <p className="text-xs text-ink-muted">{t(locale, 'grants_not_editable')}</p>
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
