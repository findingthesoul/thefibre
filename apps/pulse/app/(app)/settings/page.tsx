import { apiFetch } from '@/lib/api';
import { RhythmCard } from './rhythm-card';
import { ReservationsCard } from './reservations-card';
import { TeamsCard } from './teams-card';
import { OfferingsCard } from './offerings-card';
import type {
  Account,
  InvolvedTeam,
  Offering,
  PulseSettings,
  Rule,
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
  let restricted = false;

  const [sR, rR, tR, aR, oR, wtR] = await Promise.allSettled([
    apiFetch<{ settings: PulseSettings }>('/api/v1/pulse/settings'),
    apiFetch<{ items: Rule[] }>('/api/v1/pulse/reservation-rules'),
    apiFetch<{ items: InvolvedTeam[] }>('/api/v1/pulse/involved-teams'),
    apiFetch<{ items: Account[] }>('/api/v1/pulse/accounts'),
    apiFetch<{ items: Offering[] }>('/api/v1/pulse/offerings'),
    apiFetch<{ items: WorkspaceTeam[] }>('/api/v1/teams'),
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
        <ReservationsCard rules={rules} accounts={accounts} />
        <TeamsCard involved={teams} workspaceTeams={workspaceTeams} />
        <OfferingsCard offerings={offerings} currency={settings?.currency ?? 'EUR'} />
      </div>
    </div>
  );
}
