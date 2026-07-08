import { apiFetch } from '@/lib/api';
import { PipelineView } from './pipeline-view';
import { FALLBACK_STAGES } from './types';
import type {
  Commitment,
  InvolvedTeam,
  MemberOption,
  OfferingOption,
  OrgOption,
  PersonOption,
  ProjectOption,
  StageOption,
} from './types';

export const metadata = { title: 'Cashflow · Fibre Pulse' };

// Every picker degrades to empty on failure — the page still renders.
async function safeItems<T>(path: string): Promise<T[]> {
  try {
    const r = await apiFetch<{ items: T[] }>(path);
    return r.items ?? [];
  } catch {
    return [];
  }
}

// Platform user id of the signed-in user — matches members' user_id, so the
// dialog can preselect the owner. Degrades to null (API-default owner).
async function currentUserId(): Promise<string | null> {
  try {
    const r = await apiFetch<{ user: { id: string } }>('/api/v1/auth/me');
    return r.user?.id ?? null;
  } catch {
    return null;
  }
}

export default async function PipelinePage() {
  const [items, orgs, persons, teams, projects, offerings, members, stagesRaw, meId] =
    await Promise.all([
      safeItems<Commitment>('/api/v1/pulse/commitments'),
      safeItems<OrgOption>('/api/v1/organisations?limit=100'),
      safeItems<PersonOption>('/api/v1/persons?limit=100'),
      safeItems<InvolvedTeam>('/api/v1/pulse/involved-teams'),
      safeItems<ProjectOption>('/api/v1/pulse/projects'),
      safeItems<OfferingOption>('/api/v1/pulse/offerings'),
      safeItems<MemberOption>('/api/v1/members'),
      safeItems<StageOption>('/api/v1/pulse/stages'),
      currentUserId(),
    ]);

  const stages = stagesRaw.length > 0 ? stagesRaw : FALLBACK_STAGES;

  return (
    <div className="px-6 py-10 max-w-5xl">
      <PipelineView
        items={items}
        pickers={{ orgs, persons, teams, projects, offerings, members, stages }}
        currentUserId={meId}
      />
    </div>
  );
}
