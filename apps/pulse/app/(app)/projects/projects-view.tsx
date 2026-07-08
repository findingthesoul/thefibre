'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectDialog } from './project-dialog';
import { teamName, type InvolvedTeam, type Project } from './types';

export function ProjectsView({ teams, projects }: { teams: InvolvedTeam[]; projects: Project[] }) {
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
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">Teams & projects</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Hubs and incubators are Fibre teams; projects run under them. Which teams take part is
            set in Settings.
          </p>
        </div>
        <Button leading={<Plus size={16} strokeWidth={2} />} onClick={() => setCreating(true)}>
          New project
        </Button>
      </div>

      {teams.length === 0 && projects.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center">
          <p className="text-sm text-ink-muted">
            No teams involved yet. Pick the teams that act as hubs or incubators in Settings —
            projects and their pipelines roll up here.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {teams.map((t) => (
            <div key={t.id} className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
              <div className="px-5 py-3 border-b border-line text-sm font-semibold tracking-tight">
                {teamName(t.team)}
              </div>
              <ProjectList items={byTeam.get(t.team_id) ?? []} onEdit={setEditing} />
            </div>
          ))}
          {(byTeam.get(null) ?? []).length > 0 && (
            <div className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
              <div className="px-5 py-3 border-b border-line text-sm font-semibold tracking-tight text-ink-subtle">
                Free-standing projects
              </div>
              <ProjectList items={byTeam.get(null) ?? []} onEdit={setEditing} />
            </div>
          )}
        </div>
      )}

      {creating && <ProjectDialog project={null} teams={teams} onClose={() => setCreating(false)} />}
      {editing && <ProjectDialog project={editing} teams={teams} onClose={() => setEditing(null)} />}
    </>
  );
}

function ProjectList({ items, onEdit }: { items: Project[]; onEdit: (p: Project) => void }) {
  if (!items.length) {
    return <div className="px-5 py-3 text-sm text-ink-muted">No projects yet.</div>;
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
