'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectDialog } from './project-dialog';
import { t, type Locale } from '@/lib/i18n-ui';
import { teamName, type InvolvedTeam, type Project } from './types';

export function ProjectsView({
  teams,
  projects,
  locale,
}: {
  teams: InvolvedTeam[];
  projects: Project[];
  locale: Locale;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const byTeam = new Map<string | null, Project[]>();
  for (const p of projects) {
    const list = byTeam.get(p.team_id) ?? [];
    list.push(p);
    byTeam.set(p.team_id, list);
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">
            {t(locale, 'projects')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{t(locale, 'projects_page_blurb')}</p>
        </div>
        <Button leading={<Plus size={16} strokeWidth={2} />} onClick={() => setCreating(true)}>
          {t(locale, 'new_project')}
        </Button>
      </div>

      {teams.length === 0 && projects.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center">
          <p className="text-sm text-ink-muted">{t(locale, 'no_teams_projects_empty')}</p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {teams.map((team) => (
            <div key={team.id} className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
              <div className="px-5 py-3 border-b border-line text-sm font-semibold tracking-tight">
                {teamName(team.team, t(locale, 'unnamed_team'))}
              </div>
              <ProjectList items={byTeam.get(team.team_id) ?? []} locale={locale} onEdit={setEditing} />
            </div>
          ))}
          {(byTeam.get(null) ?? []).length > 0 && (
            <div className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
              <div className="px-5 py-3 border-b border-line text-sm font-semibold tracking-tight text-ink-subtle">
                {t(locale, 'free_standing_projects')}
              </div>
              <ProjectList items={byTeam.get(null) ?? []} locale={locale} onEdit={setEditing} />
            </div>
          )}
        </div>
      )}

      {creating && (
        <ProjectDialog project={null} teams={teams} locale={locale} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <ProjectDialog project={editing} teams={teams} locale={locale} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function ProjectList({
  items,
  locale,
  onEdit,
}: {
  items: Project[];
  locale: Locale;
  onEdit: (p: Project) => void;
}) {
  if (!items.length) {
    return <div className="px-5 py-3 text-sm text-ink-muted">{t(locale, 'no_projects_yet')}</div>;
  }
  return (
    <div className="divide-y divide-line/60">
      {items.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onEdit(p)}
          className="w-full text-left px-5 py-3 hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50"
        >
          <div className="text-sm text-ink">{p.name}</div>
          {p.notes && <div className="text-xs text-ink-muted mt-0.5">{p.notes}</div>}
        </button>
      ))}
    </div>
  );
}
