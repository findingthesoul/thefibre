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
async function currentUserId(): Promise<string | null> {
  try {
    const r = await apiFetch<{ user: { id: string } }>('/api/v1/auth/me');
    return r.user?.id ?? null;
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
      },
      vatTariffs: tariffs,
    };
  } catch {
    return {
      period: { granularity: 'fortnight', anchor_date: null },
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

  // Me / Team / Workspace scope (Sjoerd 2026-07-08: "cashflow per team...
  // or per person or per workspace"). URL params win; a bare URL falls back
  // to the remembered cookie ('me' | 'team:<id>' | 'workspace').
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

  const [items, orgs, persons, teams, allTeams, projects, offerings, members, stagesRaw, meId, projection, budgetLines, accounts] =
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
      fetchProjection(rhythm.granularity, scope, scopeTeamId),
      // Admins only — degrades to an empty list (the grid skips the rows).
      safeItems<BudgetLine>('/api/v1/pulse/budget-lines'),
      // Admins only — the FINANCIAL POSITION section expands into editable
      // per-account balance rows; non-admins just don't get the rows.
      safeItems<PulseAccount>('/api/v1/pulse/accounts'),
    ]);

  const stages = stagesRaw.length > 0 ? stagesRaw : FALLBACK_STAGES;

  // Workspace is only visible to those who have access — the projection is
  // the admin+ read, so its failure marks a non-admin: hide the Workspace
  // segment and default a workspace-scoped view down to Me.
  const canWorkspace = projection !== null;
  if (scope === 'workspace' && !canWorkspace) scope = 'me';

  // Scope the commitments + budget lines server-side (Me = owned by the
  // caller; Team = tagged with that team). Workspace = everything RLS gives.
  let shownItems = items;
  let shownBudget = budgetLines;
  if (scope === 'me' && meId) {
    shownItems = items.filter((cm) => cm.owner_user_id === meId);
    shownBudget = budgetLines.filter((bl) => bl.owner_user_id === meId);
  } else if (scope === 'team' && scopeTeamId) {
    shownItems = items.filter((cm) => cm.team_id === scopeTeamId);
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
