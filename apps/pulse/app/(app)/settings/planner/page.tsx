import { apiFetch } from '@/lib/api';
import { appUrl } from '@thefibre/shared';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { Breadcrumb, PageContainer, PageHeader } from '../page-chrome';
import { RhythmCard } from '../rhythm-card';
import { ReservationsCard } from '../reservations-card';
import { TeamsCard } from '../teams-card';
import { StagesCard } from '../stages-card';
import { OfferingsCard } from '../offerings-card';
import { LedgerCard } from '../ledger-card';
import { InvoicingCard } from '../invoicing-card';
import { HistoryCard } from '../history-card';
import type {
  Account,
  InvolvedTeam,
  Offering,
  PulseSettings,
  Rule,
  SnapshotMeta,
  Stage,
  WorkspaceTeam,
} from '../shared';

// The planner's assumptions layer — formerly the whole /settings page, now a
// hub card (/settings is Profile · Payments · Planner). The card components
// live one level up so their './actions' / './shared' imports (also used by
// the Teams page) stay put.

export const metadata = { title: 'Planner settings · Pulse' };

export default async function PlannerSettingsPage() {
  const locale = await uiLocale();
  let settings: PulseSettings = null;
  let rules: Rule[] = [];
  let teams: InvolvedTeam[] = [];
  let accounts: Account[] = [];
  let offerings: Offering[] = [];
  let workspaceTeams: WorkspaceTeam[] = [];
  let stages: Stage[] = [];
  let snapshots: SnapshotMeta[] = [];
  let restricted = false;

  const [sR, rR, tR, aR, oR, wtR, stR, snR] = await Promise.allSettled([
    apiFetch<{ settings: PulseSettings }>('/api/v1/pulse/settings'),
    // Workspace rules only — team/personal rules are managed from their own
    // cashflow tab (the + on the grid's Reservations row).
    apiFetch<{ items: Rule[] }>('/api/v1/pulse/reservation-rules?scope=workspace'),
    apiFetch<{ items: InvolvedTeam[] }>('/api/v1/pulse/involved-teams'),
    apiFetch<{ items: Account[] }>('/api/v1/pulse/accounts'),
    apiFetch<{ items: Offering[] }>('/api/v1/pulse/offerings'),
    apiFetch<{ items: WorkspaceTeam[] }>('/api/v1/teams'),
    apiFetch<{ items: Stage[]; pipeline_flow_id: string | null }>('/api/v1/pulse/stages'),
    // Stored projection overviews (History) — admin read, degrades to [].
    apiFetch<{ items: SnapshotMeta[] }>('/api/v1/pulse/snapshots'),
  ]);
  if (sR.status === 'fulfilled') settings = sR.value.settings;
  else restricted = true;
  if (rR.status === 'fulfilled') rules = rR.value.items;
  else restricted = true;
  if (tR.status === 'fulfilled') teams = tR.value.items;
  else restricted = true;
  if (aR.status === 'fulfilled') accounts = aR.value.items;
  if (oR.status === 'fulfilled') offerings = oR.value.items;
  if (wtR.status === 'fulfilled') workspaceTeams = wtR.value.items.filter((t) => t.is_active !== false);
  let pipelineFlowId: string | null = null;
  if (stR.status === 'fulfilled') {
    stages = stR.value.items;
    pipelineFlowId = stR.value.pipeline_flow_id;
  }
  if (snR.status === 'fulfilled') snapshots = snR.value.items;
  const flowUrl = pipelineFlowId
    ? `${appUrl('fibre-flow', process.env)}/flows/${pipelineFlowId}`
    : null;

  return (
    <PageContainer max="5xl">
      <Breadcrumb href="/settings" label={t(locale, 'settings')} />
      <PageHeader
        title={t(locale, 'planner')}
        description={t(locale, 'planner_blurb')}
      />

      {restricted && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t(locale, 'admin_only_notice')}
        </div>
      )}

      <div className="mt-8 space-y-6">
        <RhythmCard settings={settings} locale={locale} />
        <InvoicingCard settings={settings} locale={locale} />
        <LedgerCard settings={settings} locale={locale} />
        <HistoryCard settings={settings} snapshots={snapshots} locale={locale} />
        <ReservationsCard rules={rules} accounts={accounts} locale={locale} />
        <TeamsCard involved={teams} workspaceTeams={workspaceTeams} locale={locale} />
        <StagesCard stages={stages} flowUrl={flowUrl} locale={locale} />
        <OfferingsCard offerings={offerings} currency={settings?.currency ?? 'EUR'} locale={locale} />
      </div>
    </PageContainer>
  );
}
