import { cookies } from 'next/headers';
import { apiFetch } from '@/lib/api';
import {
  COOKIE_CASHFLOW_FIT,
  COOKIE_CASHFLOW_SCOPE,
  COOKIE_CASHFLOW_VIEW,
} from '@/lib/prefs-shared';
import { PipelineView } from './pipeline-view';
import { DEFAULT_VAT_TARIFFS, FALLBACK_STAGES } from './types';
import type {
  VatTariff,
  BudgetLine,
  CashflowScope,
  Commitment,
  InvolvedTeam,
  MemberOption,
  OfferingOption,
  OrgOption,
  PeriodSettings,
  PersonOption,
  Projection,
  ProjectOption,
  PulseAccount,
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
async function currentUserId(): Promise<{ id: string; workspaceName: string | null } | null> {
  try {
    const r = await apiFetch<{ user: { id: string }; workspace: { name: string } | null }>(
      '/api/v1/auth/me',
    );
    return r.user?.id
      ? { id: r.user.id, workspaceName: r.workspace?.name ?? null }
      : null;
  } catch {
    return null;
  }
}

// The by-period board needs the workspace rhythm; the opportunity dialog
// needs the VAT tariff list from the same settings row. Non-admins can't
// read the settings endpoint — fall back to fortnights anchored on today
// (the same default the API's projection uses) and the seeded VAT defaults.
async function periodSettings(): Promise<{ period: PeriodSettings; vatTariffs: VatTariff[] }> {
  try {
    const r = await apiFetch<{
      settings: {
        default_granularity?: string;
        period_anchor_date?: string | null;
        horizon_months?: number | null;
        focus_weekday?: number | null;
        vat_tariffs?: VatTariff[] | null;
      } | null;
    }>('/api/v1/pulse/settings');
    const g = r.settings?.default_granularity;
    const tariffs = Array.isArray(r.settings?.vat_tariffs)
      ? r.settings!.vat_tariffs!.filter((t) => t && typeof t.pct === 'number')
      : DEFAULT_VAT_TARIFFS;
    return {
      period: {
        granularity: g === 'week' || g === 'month' ? g : 'fortnight',
        anchor_date: r.settings?.period_anchor_date ?? null,
        horizon_months: r.settings?.horizon_months ?? 12,
        focus_weekday: r.settings?.focus_weekday ?? null,
      },
      vatTariffs: tariffs,
    };
  } catch {
    return {
      period: {
        granularity: 'fortnight',
        anchor_date: null,
        horizon_months: 12,
        focus_weekday: null,
      },
      vatTariffs: DEFAULT_VAT_TARIFFS,
    };
  }
}

// Admin-only read — non-admins (and RLS misses) get null and the grid hides
// the FINANCIAL POSITION / RESERVES / END POSITION rows. Granularity is
// pinned to the grid's rhythm so the period columns line up exactly; the
// Me/Team scope narrows the flows (&owner=me / &team_id=).
async function fetchProjection(
  granularity: PeriodSettings['granularity'],
  scope: CashflowScope,
  scopeTeamId: string | null,
): Promise<Projection | null> {
  try {
    let qs = `granularity=${granularity}`;
    if (scope === 'me') qs += '&owner=me';
    else if (scope === 'team' && scopeTeamId) qs += `&team_id=${scopeTeamId}`;
    return await apiFetch<Projection>(`/api/v1/pulse/projection?${qs}`);
  } catch {
    return null;
  }
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; scope?: string; team?: string }>;
}) {
  // The rhythm comes first — the projection fetch pins its granularity.
  // ?show=week|fortnight|month|quarter overrides the display rhythm
  // (Sjoerd 2026-07-08: "Add a show (per week, per month, per quarter)").
  const { period: rhythm, vatTariffs } = await periodSettings();
  const { show, scope: scopeParam, team: teamParam } = await searchParams;
  if (show === 'week' || show === 'fortnight' || show === 'month' || show === 'quarter') {
    rhythm.granularity = show;
  }

  // Me / Team / Workspace scope, now a TAB system (Sjoerd 2026-07-09: "a TAB
  // system: Me is always there... a tab for each team you are part of...
  // Workspace only if you are SUPER ADMIN"). URL params win; a bare URL
  // falls back to the remembered cookie ('me' | 'team:<id>' | 'workspace').
  const cookieStore = await cookies();
  const scopeCookie = cookieStore.get(COOKIE_CASHFLOW_SCOPE)?.value;

  let scope: CashflowScope = 'workspace';
  let scopeTeamId: string | null = null;
  if (scopeParam === 'me') {
    scope = 'me';
  } else if (teamParam) {
    scope = 'team';
    scopeTeamId = teamParam;
  } else if (scopeParam === undefined && scopeCookie === 'me') {
    scope = 'me';
  } else if (scopeParam === undefined && scopeCookie?.startsWith('team:')) {
    scope = 'team';
    scopeTeamId = scopeCookie.slice('team:'.length) || null;
    if (!scopeTeamId) scope = 'workspace';
  }

  // Each tab anchors on its OWN accounts (workspace banks, a team's virtual
  // bank, personal ones) — the scope rides the accounts query.
  const accountsQs =
    scope === 'me'
      ? '?owner=me'
      : scope === 'team' && scopeTeamId
        ? `?team_id=${scopeTeamId}`
        : '?scope=workspace';

  // Tabs are SEPARATE cashflows — the API partitions commitments server-side
  // (an item BELONGS to the cashflow it was created in): Me = my personal
  // items, team = that team's, workspace = personal=false AND no team.
  const commitmentsQs =
    scope === 'me'
      ? '?mine=1'
      : scope === 'team' && scopeTeamId
        ? `?team_id=${scopeTeamId}`
        : '?scope=workspace';

  const [items, orgs, persons, teams, allTeams, projects, offerings, members, stagesRaw, me, projection, workspaceProbe, budgetLines, accounts] =
    await Promise.all([
      safeItems<Commitment>(`/api/v1/pulse/commitments${commitmentsQs}`),
      safeItems<OrgOption>('/api/v1/organisations?limit=100'),
      safeItems<PersonOption>('/api/v1/persons?limit=100'),
      safeItems<InvolvedTeam>('/api/v1/pulse/involved-teams'),
      safeItems<TeamOption>('/api/v1/teams'),
      safeItems<ProjectOption>('/api/v1/pulse/projects'),
      safeItems<OfferingOption>('/api/v1/pulse/offerings'),
      safeItems<MemberOption>('/api/v1/members'),
      safeItems<StageOption>('/api/v1/pulse/stages'),
      currentUserId(),
      fetchProjection(rhythm.granularity, scope, scopeTeamId),
      // The Workspace tab renders only when the WORKSPACE projection read
      // succeeds (admin+) — same probe the old entry chooser used. When the
      // active scope IS workspace the main fetch doubles as the probe.
      scope === 'workspace'
        ? Promise.resolve(null)
        : fetchProjection(rhythm.granularity, 'workspace', null),
      // Admins only — degrades to an empty list (the grid skips the rows).
      safeItems<BudgetLine>('/api/v1/pulse/budget-lines'),
      // Scoped to the active tab — the BANK section shows THIS cashflow's
      // accounts (and a create prompt when there are none yet).
      safeItems<PulseAccount>(`/api/v1/pulse/accounts${accountsQs}`),
    ]);

  const stages = stagesRaw.length > 0 ? stagesRaw : FALLBACK_STAGES;

  // Workspace is only visible to those who have access — the workspace
  // projection is the admin+ read, so its failure marks a non-admin: hide
  // the Workspace tab and default a workspace-scoped view down to Me.
  const canWorkspace = scope === 'workspace' ? projection !== null : workspaceProbe !== null;

  // Commitments arrive ALREADY partitioned by the API (the ?mine/?team_id/
  // ?scope query above) — no client-side scope filtering. The one edge: a
  // non-admin deep-linking the Workspace tab got the workspace fetch but
  // lands on Me — refetch the personal cashflow so the list matches the tab.
  let shownItems = items;
  if (scope === 'workspace' && !canWorkspace) {
    scope = 'me';
    shownItems = await safeItems<Commitment>('/api/v1/pulse/commitments?mine=1');
  }

  // Budget lines still arrive workspace-wide — narrow them to the tab here
  // (Me = owned by the caller; Team = tagged with that team).
  let shownBudget = budgetLines;
  const meId = me?.id ?? null;
  if (scope === 'me' && meId) {
    shownBudget = budgetLines.filter((bl) => bl.owner_user_id === meId);
  } else if (scope === 'team' && scopeTeamId) {
    shownBudget = budgetLines.filter((bl) => bl.team_id === scopeTeamId);
  }

  const viewCookie = cookieStore.get(COOKIE_CASHFLOW_VIEW)?.value;
  const initialView: 'counterparty' | 'period' =
    viewCookie === 'counterparty' ? 'counterparty' : 'period';
  const initialFit: 'on' | 'off' =
    cookieStore.get(COOKIE_CASHFLOW_FIT)?.value === 'on' ? 'on' : 'off';

  return (
    <div className="px-6 py-10">
      <PipelineView
        initialView={initialView}
        initialFit={initialFit}
        items={shownItems}
        pickers={{ orgs, persons, teams, allTeams, projects, offerings, members, stages, vatTariffs }}
        currentUserId={meId}
        workspaceName={me?.workspaceName ?? null}
        periodSettings={rhythm}
        projection={projection}
        budgetLines={shownBudget}
        accounts={accounts}
        scope={scope}
        scopeTeamId={scopeTeamId}
        canWorkspace={canWorkspace}
      />
    </div>
  );
}
