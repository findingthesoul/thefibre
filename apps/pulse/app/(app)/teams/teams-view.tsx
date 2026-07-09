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
import type { InvolvedTeam, WorkspaceTeam } from './page';

export function TeamsView({
  teams,
  involved,
}: {
  teams: WorkspaceTeam[];
  involved: InvolvedTeam[];
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
        New team
      </Button>
      {creating && <NewTeamDialog onClose={() => setCreating(false)} />}
    </div>
  );

  if (teams.length === 0) {
    return (
      <>
        {newTeamButton}
        <div className="mt-4 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center">
          <p className="text-sm text-ink-muted">
            No teams in this workspace yet — create the first one; it joins the planner and gets
            its own cashflow tab.
          </p>
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
          .filter((t) => t.is_active !== false)
          .map((t) => {
            const isInvolved = involvedByTeam.has(t.id);
            return (
              <div key={t.id} className="px-5 py-3.5 flex items-center gap-4">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-sunken text-ink-subtle shrink-0">
                  <UsersRound size={16} strokeWidth={1.75} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink truncate">{t.name}</div>
                  <div className="text-xs text-ink-muted">
                    {t.member_count} member{t.member_count === 1 ? '' : 's'}
                    {t.description ? ` · ${t.description}` : ''}
                  </div>
                </div>
                {isInvolved && (
                  <Link
                    href={`/cashflow?team=${t.id}`}
                    className="text-xs text-ink-subtle underline underline-offset-2 hover:text-ink shrink-0"
                  >
                    Open cashflow
                  </Link>
                )}
                <Switch
                  checked={isInvolved}
                  disabled={busy === t.id}
                  onChange={(v) => toggle(t, v)}
                  label={isInvolved ? 'In the planner' : 'Not involved'}
                />
              </div>
            );
          })}
      </div>
    </div>
    </>
  );
}

function NewTeamDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
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
      title="New team"
      description="A Fibre platform team — usable in every app. It joins the planner right away (own cashflow tab, bank, reservations)."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="new-team-form" disabled={busy}>
            {busy ? 'Creating…' : 'Create team'}
          </Button>
        </>
      }
    >
      <form id="new-team-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Incubator Rotterdam"
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
