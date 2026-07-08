import { cookies } from 'next/headers';
import { apiFetch } from '@/lib/api';
import { COOKIE_CASHFLOW_VIEW } from '@/lib/prefs-shared';
import { PipelineView } from './pipeline-view';
import { FALLBACK_STAGES } from './types';
import type {
  BudgetLine,
  Commitment,
  InvolvedTeam,
  MemberOption,
  OfferingOption,
  OrgOption,
  PeriodSettings,
  PersonOption,
  Projection,
  ProjectOption,
  StageOption,
  TeamOption,
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

// The by-period board needs the workspace rhythm. Non-admins can't read the
// settings endpoint — fall back to fortnights anchored on today (the same
// default the API's projection uses).
async function periodSettings(): Promise<PeriodSettings> {
  try {
    const r = await apiFetch<{
      settings: { default_granularity?: string; period_anchor_date?: string | null } | null;
    }>('/api/v1/pulse/settings');
    const g = r.settings?.default_granularity;
    return {
      granularity: g === 'week' || g === 'month' ? g : 'fortnight',
      anchor_date: r.settings?.period_anchor_date ?? null,
    };
  } catch {
    return { granularity: 'fortnight', anchor_date: null };
  }
}

// Admin-only read — non-admins (and RLS misses) get null and the grid hides
// the FINANCIAL POSITION / RESERVES / END POSITION rows. Granularity is
// pinned to the grid's rhythm so the period columns line up exactly.
async function fetchProjection(granularity: PeriodSettings['granularity']): Promise<Projection | null> {
  try {
    return await apiFetch<Projection>(`/api/v1/pulse/projection?granularity=${granularity}`);
  } catch {
    return null;
  }
}

export default async function PipelinePage() {
  // The rhythm comes first — the projection fetch pins its granularity.
  const rhythm = await periodSettings();
  const [items, orgs, persons, teams, allTeams, projects, offerings, members, stagesRaw, meId, projection, budgetLines] =
    await Promise.all([
      safeItems<Commitment>('/api/v1/pulse/commitments'),
      safeItems<OrgOption>('/api/v1/organisations?limit=100'),
      safeItems<PersonOption>('/api/v1/persons?limit=100'),
      safeItems<InvolvedTeam>('/api/v1/pulse/involved-teams'),
      safeItems<TeamOption>('/api/v1/teams'),
      safeItems<ProjectOption>('/api/v1/pulse/projects'),
      safeItems<OfferingOption>('/api/v1/pulse/offerings'),
      safeItems<MemberOption>('/api/v1/members'),
      safeItems<StageOption>('/api/v1/pulse/stages'),
      currentUserId(),
      fetchProjection(rhythm.granularity),
      // Admins only — degrades to an empty list (the grid skips the rows).
      safeItems<BudgetLine>('/api/v1/pulse/budget-lines'),
    ]);

  const stages = stagesRaw.length > 0 ? stagesRaw : FALLBACK_STAGES;

  const viewCookie = (await cookies()).get(COOKIE_CASHFLOW_VIEW)?.value;
  const initialView: 'counterparty' | 'period' =
    viewCookie === 'counterparty' ? 'counterparty' : 'period';

  return (
    <div className="px-6 py-10">
      <PipelineView
        initialView={initialView}
        items={items}
        pickers={{ orgs, persons, teams, allTeams, projects, offerings, members, stages }}
        currentUserId={meId}
        periodSettings={rhythm}
        projection={projection}
        budgetLines={budgetLines}
      />
    </div>
  );
}
