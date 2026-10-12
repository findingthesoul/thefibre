'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchSelect } from '@thefibre/shared/ui/search-select';
import { TeamCalendarGrantFields } from '@thefibre/shared/ui/team-calendar-grant';
import { teamCalendarGrantConfig } from '@thefibre/shared/team-calendar-grant';
import { teamCalendarLabels } from '@/lib/team-calendar-labels';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import { createGrant, deleteGrant } from './actions';
import { GRANT_KINDS, type Grant, type GrantKind, type TeamOption } from './types';
import type { Tier } from '../tiers/types';

const INPUT =
  'w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:opacity-50';

const GRANT_KIND_KEYS: Record<GrantKind, UiKey> = {
  circle: 'grant_kind_circle',
  thread: 'grant_kind_thread',
  team_calendar: 'grant_kind_team_calendar',
  fibre_seat: 'grant_kind_fibre_seat',
  google_user: 'grant_kind_google_user',
};

// The API has no PATCH for grants — an existing grant opens read-only with
// Delete; to change one, delete and re-create.
export function GrantDialog({
  grant,
  tiers,
  circleTokenSet,
  threadOptions = [],
  teamOptions = [],
  locale,
  onClose,
}: {
  grant: Grant | null; // null = new
  tiers: Tier[];
  circleTokenSet: boolean;
  /** The workspace's threads — a thread grant PICKS a slug, never types one. */
  threadOptions?: { slug: string; title: string }[];
  /** The workspace's teams, for a team-calendar grant. Empty hides the kind:
   *  a picker with nothing in it is a promise the form cannot keep. */
  teamOptions?: TeamOption[];
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
  // An EXISTING grant opens read-only, so these are seeded from it for the
  // summary line and then never edited (the API has no PATCH for grants).
  const [teamId, setTeamId] = useState(
    typeof grant?.config?.team_id === 'string' ? grant.config.team_id : '',
  );
  const [pct, setPct] = useState(
    grant?.config?.discount_pct === undefined || grant?.config?.discount_pct === null
      ? '100'
      : String(grant.config.discount_pct),
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
    if (
      kind !== 'fibre_seat' &&
      kind !== 'google_user' &&
      kind !== 'team_calendar' &&
      !ref.trim()
    ) {
      setError(kind === 'circle' ? t(locale, 'space_id_required') : t(locale, 'thread_slug_required'));
      return;
    }
    // THE SAME FUNCTION THE API VALIDATES WITH: a 0 is refused here, with the
    // reason, rather than sent and bounced; a blank percentage becomes 100.
    let teamConfig: Record<string, unknown> | null = null;
    if (kind === 'team_calendar') {
      const r = teamCalendarGrantConfig(teamId, pct);
      if (!r.ok) {
        setError(
          r.reason === 'team'
            ? t(locale, 'team_required')
            : r.reason === 'zero'
              ? t(locale, 'pct_zero_hint')
              : t(locale, 'pct_range_hint'),
        );
        return;
      }
      teamConfig = r.config as unknown as Record<string, unknown>;
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
            : kind === 'team_calendar'
              ? teamConfig!
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
            {GRANT_KINDS.filter(
              // No teams to pick from, and no existing grant of that kind to
              // show: don't offer what cannot be saved.
              (k) => k !== 'team_calendar' || teamOptions.length > 0 || grant?.kind === k,
            ).map((k) => (
              <option key={k} value={k}>
                {t(locale, GRANT_KIND_KEYS[k])}
              </option>
            ))}
          </select>
        </div>
        {kind === 'team_calendar' ? (
          <TeamCalendarGrantFields
            teams={teamOptions.map((x) => ({
              id: x.id,
              name: x.name,
              published: x.is_published,
            }))}
            teamId={teamId}
            onTeamId={setTeamId}
            pct={pct}
            onPct={setPct}
            labels={teamCalendarLabels(locale)}
            disabled={existing || busy}
          />
        ) : kind === 'fibre_seat' ? (
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
            {kind === 'thread' && threadOptions.length > 0 && !existing ? (
              <SearchSelect
                value={ref}
                onChange={setRef}
                options={[
                  ...threadOptions.map((x) => ({ value: x.slug, label: x.title, hint: x.slug })),
                  ...(ref && !threadOptions.some((x) => x.slug === ref)
                    ? [{ value: ref, label: ref }]
                    : []),
                ]}
                placeholder={t(locale, 'pick_thread_ph')}
                className="w-full"
              />
            ) : (
              <input
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                disabled={existing}
                placeholder={kind === 'circle' ? t(locale, 'space_id_eg') : t(locale, 'thread_slug_eg')}
                className={INPUT}
              />
            )}
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
