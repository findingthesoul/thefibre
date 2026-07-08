'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { saveProject, archiveProject } from './actions';
import { teamName, type InvolvedTeam, type Project } from './types';

const INPUT =
  'w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';

export function ProjectDialog({
  project,
  teams,
  onClose,
}: {
  project: Project | null; // null = new
  teams: InvolvedTeam[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(project?.name ?? '');
  const [teamId, setTeamId] = useState(project?.team_id ?? '');
  const [notes, setNotes] = useState(project?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await saveProject({
      id: project?.id ?? null,
      name: name.trim(),
      team_id: teamId || null,
      notes: notes.trim() || null,
    });
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    onClose();
    router.refresh();
  }

  async function handleArchive() {
    if (!project) return;
    if (!confirmArchive) {
      setConfirmArchive(true);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await archiveProject(project.id);
    if (res.error) {
      setError(res.error);
      setBusy(false);
      setConfirmArchive(false);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={project ? 'Edit project' : 'New project'}
      footer={
        <>
          {project && (
            <Button
              type="button"
              variant="danger"
              className="mr-auto"
              disabled={busy}
              onClick={handleArchive}
            >
              {confirmArchive ? 'Really archive?' : 'Archive'}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="project-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Incubator cohort 3"
            className={INPUT}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Team</label>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={INPUT}>
            <option value="">Free-standing</option>
            {teams.map((t) => (
              <option key={t.id} value={t.team_id}>
                {teamName(t.team)}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-ink-muted">
            Hubs and incubators are Fibre teams; pick which take part in Settings.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional"
            className={INPUT}
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
