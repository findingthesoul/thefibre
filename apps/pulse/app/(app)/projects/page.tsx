import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { ProjectsView } from './projects-view';
import type { InvolvedTeam, Project } from './types';

export const metadata = { title: 'Teams & projects · Pulse' };

export default async function ProjectsPage() {
  const locale = await uiLocale();
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

  return (
    <div className="px-6 py-10 max-w-5xl">
      <ProjectsView teams={teams} projects={projects} locale={locale} />
    </div>
  );
}
