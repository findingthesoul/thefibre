'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UsersRound } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { addInvolvedTeam, createTeam, removeInvolvedTeam } from '../settings/actions';
import { t, type Locale } from '@/lib/i18n-ui';
import type { InvolvedTeam, WorkspaceTeam } from './page';

export function TeamsView({
  teams,
  involved,
  locale,
}: {
  teams: WorkspaceTeam[];
  involved: InvolvedTeam[];
  locale: Locale;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const involvedByTeam = new Map(involved.map((i) => [i.team_id, i.id]));

  async function toggle(team: WorkspaceTeam, on: boolean) {
    setBusy(team.id);
    setError(null);
    const res = on
      ? await addInvolvedTeam(team.id)
      : await removeInvolvedTeam(involvedByTeam.get(team.id)!);
    setBusy(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  const newTeamButton = (
    <div className="mt-4 flex justify-end">
      <Button leading={<Plus size={15} strokeWidth={2} />} onClick={() => setCreating(true)}>
        {t(locale, 'new_team')}
      </Button>
      {creating && <NewTeamDialog locale={locale} onClose={() => setCreating(false)} />}
    </div>
  );

  if (teams.length === 0) {
    return (
      <>
        {newTeamButton}
        <div className="mt-4 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center">
          <p className="text-sm text-ink-muted">{t(locale, 'no_teams_yet')}</p>
        </div>
      </>
    );
  }

  return (
    <>
    {newTeamButton}
    <div className="mt-4 rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
      {error && (
        <div className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="divide-y divide-line/60">
        {teams
          .filter((team) => team.is_active !== false)
          .map((team) => {
            const isInvolved = involvedByTeam.has(team.id);
            return (
              <div key={team.id} className="px-5 py-3.5 flex items-center gap-4">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-sunken text-ink-subtle shrink-0">
                  <UsersRound size={16} strokeWidth={1.75} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink truncate">{team.name}</div>
                  <div className="text-xs text-ink-muted">
                    {team.member_count === 1
                      ? t(locale, 'member_count_one')
                      : t(locale, 'member_count_many', { n: team.member_count })}
                    {team.description ? ` · ${team.description}` : ''}
                  </div>
                </div>
                {isInvolved && (
                  <Link
                    href={`/cashflow?team=${team.id}`}
                    className="text-xs text-ink-subtle underline underline-offset-2 hover:text-ink shrink-0"
                  >
                    {t(locale, 'open_cashflow')}
                  </Link>
                )}
                <Switch
                  checked={isInvolved}
                  disabled={busy === team.id}
                  onChange={(v) => toggle(team, v)}
                  label={isInvolved ? t(locale, 'in_planner') : t(locale, 'not_involved')}
                />
              </div>
            );
          })}
      </div>
    </div>
    </>
  );
}

function NewTeamDialog({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!name.trim()) {
      setError(t(locale, 'name_required'));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createTeam(name.trim());
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
      title={t(locale, 'new_team')}
      description={t(locale, 'new_team_desc')}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="new-team-form" disabled={busy}>
            {busy ? t(locale, 'creating') : t(locale, 'create_team')}
          </Button>
        </>
      }
    >
      <form id="new-team-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'name')}</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(locale, 'eg_incubator_rotterdam')}
            className="h-9 w-full rounded-md border border-line px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
          />
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
