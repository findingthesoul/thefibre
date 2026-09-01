import { apiFetch } from '@/lib/api';
import { TeamsView } from './teams-view';

export const metadata = { title: 'Teams · Pulse' };

// Teams live under People (the Thread pattern — Sjoerd 2026-07-09). Teams
// themselves are a platform primitive (created/membered in Meet for now);
// Pulse shows them and manages which ones take part in the planner.
export type WorkspaceTeam = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  is_active: boolean;
  member_count: number;
};

export type InvolvedTeam = {
  id: string;
  team_id: string;
  team: { id: string; name: string } | { id: string; name: string }[] | null;
};

export default async function TeamsPage() {
  let teams: WorkspaceTeam[] = [];
  let involved: InvolvedTeam[] = [];
  try {
    const [tR, iR] = await Promise.all([
      apiFetch<{ items: WorkspaceTeam[] }>('/api/v1/teams'),
      apiFetch<{ items: InvolvedTeam[] }>('/api/v1/pulse/involved-teams'),
    ]);
    teams = tR.items;
    involved = iR.items;
  } catch {
    /* empty state below */
  }

  return (
    <div className="px-6 py-10 max-w-5xl">
      <h1 className="text-[28px] font-semibold tracking-tight text-ink">Teams</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Teams are a Fibre platform primitive — one team, every app. Toggle which ones take part
        in the planner (they act as hubs/incubators, get their own cashflow scope and hold
        projects).
      </p>
      <TeamsView teams={teams} involved={involved} />
    </div>
  );
}
