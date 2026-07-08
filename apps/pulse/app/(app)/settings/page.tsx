import { apiFetch } from '@/lib/api';
import { appUrl } from '@thefibre/shared';
import { RhythmCard } from './rhythm-card';
import { ReservationsCard } from './reservations-card';
import { TeamsCard } from './teams-card';
import { StagesCard } from './stages-card';
import { OfferingsCard } from './offerings-card';
import { LedgerCard } from './ledger-card';
import type {
  Account,
  InvolvedTeam,
  Offering,
  PulseSettings,
  Rule,
  Stage,
  WorkspaceTeam,
} from './shared';

export const metadata = { title: 'Settings · Fibre Pulse' };

export default async function SettingsPage() {
  let settings: PulseSettings = null;
  let rules: Rule[] = [];
  let teams: InvolvedTeam[] = [];
  let accounts: Account[] = [];
  let offerings: Offering[] = [];
  let workspaceTeams: WorkspaceTeam[] = [];
  let stages: Stage[] = [];
  let restricted = false;

  const [sR, rR, tR, aR, oR, wtR, stR] = await Promise.allSettled([
    apiFetch<{ settings: PulseSettings }>('/api/v1/pulse/settings'),
    apiFetch<{ items: Rule[] }>('/api/v1/pulse/reservation-rules'),
    apiFetch<{ items: InvolvedTeam[] }>('/api/v1/pulse/involved-teams'),
    apiFetch<{ items: Account[] }>('/api/v1/pulse/accounts'),
    apiFetch<{ items: Offering[] }>('/api/v1/pulse/offerings'),
    apiFetch<{ items: WorkspaceTeam[] }>('/api/v1/teams'),
    apiFetch<{ items: Stage[]; pipeline_flow_id: string | null }>('/api/v1/pulse/stages'),
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
  const flowUrl = pipelineFlowId
    ? `${appUrl('fibre-flow', process.env)}/flows/${pipelineFlowId}`
    : null;

  return (
    <div className="px-6 py-10 max-w-5xl">
      <h1 className="text-[28px] font-semibold tracking-tight text-ink">Settings</h1>
      <p className="mt-1 text-sm text-ink-muted">
        The assumptions layer. Nothing domain-specific is hardcoded — rhythm, currency,
        reservations, involved teams and offerings are all configuration.
      </p>

      {restricted && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          These settings are visible to workspace admins only. If you expected to see them, ask an
          admin to widen your role.
        </div>
      )}

      <div className="mt-8 space-y-6">
        <RhythmCard settings={settings} />
        <LedgerCard settings={settings} />
        <ReservationsCard rules={rules} accounts={accounts} />
        <TeamsCard involved={teams} workspaceTeams={workspaceTeams} />
        <StagesCard stages={stages} flowUrl={flowUrl} />
        <OfferingsCard offerings={offerings} currency={settings?.currency ?? 'EUR'} />
      </div>
    </div>
  );
}
