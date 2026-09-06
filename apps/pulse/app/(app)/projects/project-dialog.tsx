'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { saveProject, archiveProject } from './actions';
import { t, type Locale } from '@/lib/i18n-ui';
import { teamName, type InvolvedTeam, type Project } from './types';

const INPUT =
  'w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';

export function ProjectDialog({
  project,
  teams,
  locale,
  onClose,
}: {
  project: Project | null; // null = new
  teams: InvolvedTeam[];
  locale: Locale;
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
      setError(t(locale, 'name_required'));
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
      title={project ? t(locale, 'edit_project') : t(locale, 'new_project')}
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
              {confirmArchive ? t(locale, 'really_archive_q') : t(locale, 'archive')}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="project-form" disabled={busy}>
            {busy ? t(locale, 'saving') : t(locale, 'save')}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'name')}</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(locale, 'eg_incubator_cohort')}
            className={INPUT}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'team')}</label>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={INPUT}>
            <option value="">{t(locale, 'free_standing')}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.team_id}>
                {teamName(team.team, t(locale, 'unnamed_team'))}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-ink-muted">{t(locale, 'hubs_hint')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'notes')}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={t(locale, 'optional')}
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
