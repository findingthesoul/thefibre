'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { addInvolvedTeam, removeInvolvedTeam } from './actions';
import { t, type Locale } from '@/lib/i18n-ui';
import { ERROR_CLS, INPUT_CLS, one, type InvolvedTeam, type WorkspaceTeam } from './shared';

export function TeamsCard({
  involved,
  workspaceTeams,
  locale,
}: {
  involved: InvolvedTeam[];
  workspaceTeams: WorkspaceTeam[];
  locale: Locale;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const involvedTeamIds = new Set(involved.map((t) => t.team_id));
  const available = workspaceTeams.filter((t) => !involvedTeamIds.has(t.id));

  async function remove(id: string) {
    setBusyId(id);
    setRowError(null);
    const res = await removeInvolvedTeam(id);
    setBusyId(null);
    if (res.error) {
      setRowError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight">{t(locale, 'teams_involved')}</span>
        <Button
          size="sm"
          variant="secondary"
          leading={<Plus size={14} strokeWidth={2} />}
          onClick={() => setAdding(true)}
        >
          {t(locale, 'add_team')}
        </Button>
      </div>
      {involved.length === 0 ? (
        <div className="px-5 py-4 text-sm text-ink-muted">{t(locale, 'no_involved_teams')}</div>
      ) : (
        <div className="divide-y divide-line/60">
          {involved.map((row) => {
            const team = one(row.team);
            return (
              <div key={row.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <span className="text-sm text-ink">{team?.name ?? t(locale, 'unnamed_team')}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(row.id)}
                  disabled={busyId === row.id}
                >
                  {busyId === row.id ? t(locale, 'removing') : t(locale, 'remove')}
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <div className="px-5 py-3 border-t border-line/60 text-xs text-ink-muted">
        {t(locale, 'remove_team_note')}
      </div>
      {rowError && (
        <div className="px-5 pb-3">
          <div className={ERROR_CLS}>{rowError}</div>
        </div>
      )}
      {adding && (
        <AddTeamDialog available={available} locale={locale} onClose={() => setAdding(false)} />
      )}
    </section>
  );
}

function AddTeamDialog({
  available,
  locale,
  onClose,
}: {
  available: WorkspaceTeam[];
  locale: Locale;
  onClose: () => void;
}) {
  const router = useRouter();
  const [teamId, setTeamId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!teamId) {
      setError(t(locale, 'pick_team_error'));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await addInvolvedTeam(teamId);
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(locale, 'add_team')}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="add-team-form" disabled={busy || available.length === 0}>
            {busy ? t(locale, 'adding') : t(locale, 'add_team')}
          </Button>
        </>
      }
    >
      <form id="add-team-form" onSubmit={submit} className="space-y-4">
        {available.length === 0 ? (
          <p className="text-sm text-ink-muted">{t(locale, 'all_teams_involved')}</p>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">{t(locale, 'team')}</label>
            <select
              autoFocus
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className={INPUT_CLS}
            >
              <option value="">{t(locale, 'choose_team_ph')}</option>
              {available.map((wt) => (
                <option key={wt.id} value={wt.id}>
                  {wt.name}
                  {typeof wt.member_count === 'number'
                    ? ` (${
                        wt.member_count === 1
                          ? t(locale, 'member_count_one')
                          : t(locale, 'member_count_many', { n: wt.member_count })
                      })`
                    : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        {error && <div className={ERROR_CLS}>{error}</div>}
      </form>
    </Dialog>
  );
}
