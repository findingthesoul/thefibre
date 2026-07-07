import { apiFetch } from '@/lib/api';

export const metadata = { title: 'Teams & projects · Fibre Pulse' };

type InvolvedTeam = {
  id: string;
  team_id: string;
  team: { id: string; name: string } | { id: string; name: string }[] | null;
};

type Project = {
  id: string;
  name: string;
  team_id: string | null;
  notes: string | null;
};

function teamName(t: InvolvedTeam['team']): string {
  const one = Array.isArray(t) ? t[0] : t;
  return one?.name ?? 'Unnamed team';
}

export default async function ProjectsPage() {
  let teams: InvolvedTeam[] = [];
  let projects: Project[] = [];
  try {
    const [tR, pR] = await Promise.all([
      apiFetch<{ items: InvolvedTeam[] }>('/api/v1/pulse/involved-teams'),
      apiFetch<{ items: Project[] }>('/api/v1/pulse/projects'),
    ]);
    teams = tR.items;
    projects = pR.items;
  } catch {
    /* empty state below */
  }

  const byTeam = new Map<string | null, Project[]>();
  for (const p of projects) {
    const list = byTeam.get(p.team_id) ?? [];
    list.push(p);
    byTeam.set(p.team_id, list);
  }

  return (
    <div className="px-6 py-10 max-w-5xl">
      <h1 className="text-[28px] font-semibold tracking-tight text-ink">Teams & projects</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Hubs and incubators are Fibre teams; projects run under them. Which teams take part is
        set in Settings.
      </p>

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
              <ProjectList items={byTeam.get(t.team_id) ?? []} />
            </div>
          ))}
          {(byTeam.get(null) ?? []).length > 0 && (
            <div className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
              <div className="px-5 py-3 border-b border-line text-sm font-semibold tracking-tight text-ink-subtle">
                Free-standing projects
              </div>
              <ProjectList items={byTeam.get(null) ?? []} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectList({ items }: { items: Project[] }) {
  if (!items.length) {
    return <div className="px-5 py-3 text-sm text-ink-muted">No projects yet.</div>;
  }
  return (
    <div className="divide-y divide-line/60">
      {items.map((p) => (
        <div key={p.id} className="px-5 py-3">
          <div className="text-sm text-ink">{p.name}</div>
          {p.notes && <div className="text-xs text-ink-muted mt-0.5">{p.notes}</div>}
        </div>
      ))}
    </div>
  );
}
