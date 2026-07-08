'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { addInvolvedTeam, removeInvolvedTeam } from './actions';
import { ERROR_CLS, INPUT_CLS, one, type InvolvedTeam, type WorkspaceTeam } from './shared';

export function TeamsCard({
  involved,
  workspaceTeams,
}: {
  involved: InvolvedTeam[];
  workspaceTeams: WorkspaceTeam[];
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
        <span className="text-sm font-semibold tracking-tight">Teams involved</span>
        <Button
          size="sm"
          variant="secondary"
          leading={<Plus size={14} strokeWidth={2} />}
          onClick={() => setAdding(true)}
        >
          Add team
        </Button>
      </div>
      {involved.length === 0 ? (
        <div className="px-5 py-4 text-sm text-ink-muted">
          No teams take part in the planner yet. Involved teams act as hubs / incubators — their
          projects and pipelines roll up on the Teams &amp; projects page.
        </div>
      ) : (
        <div className="divide-y divide-line/60">
          {involved.map((t) => {
            const team = one(t.team);
            return (
              <div key={t.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <span className="text-sm text-ink">{team?.name ?? 'Unnamed team'}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(t.id)}
                  disabled={busyId === t.id}
                >
                  {busyId === t.id ? 'Removing…' : 'Remove'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <div className="px-5 py-3 border-t border-line/60 text-xs text-ink-muted">
        Removing a team only takes it out of the planner — the team itself is untouched.
      </div>
      {rowError && (
        <div className="px-5 pb-3">
          <div className={ERROR_CLS}>{rowError}</div>
        </div>
      )}
      {adding && <AddTeamDialog available={available} onClose={() => setAdding(false)} />}
    </section>
  );
}

function AddTeamDialog({
  available,
  onClose,
}: {
  available: WorkspaceTeam[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [teamId, setTeamId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!teamId) {
      setError('Pick a team to add.');
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
      title="Add team"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-team-form" disabled={busy || available.length === 0}>
            {busy ? 'Adding…' : 'Add team'}
          </Button>
        </>
      }
    >
      <form id="add-team-form" onSubmit={submit} className="space-y-4">
        {available.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Every workspace team is already involved in the planner.
          </p>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">Team</label>
            <select
              autoFocus
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className={INPUT_CLS}
            >
              <option value="">Choose a team…</option>
              {available.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {typeof t.member_count === 'number'
                    ? ` (${t.member_count} member${t.member_count === 1 ? '' : 's'})`
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
