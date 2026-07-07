import { apiFetch } from '@/lib/api';

export const metadata = { title: 'Settings · Fibre Pulse' };

type Settings = {
  currency: string;
  default_granularity: string;
  period_anchor_date: string | null;
  fiscal_year_start_month: number;
  horizon_months: number;
} | null;

type Rule = {
  id: string;
  label: string;
  percentage: number;
  basis: string;
  included: boolean;
};

type InvolvedTeam = {
  id: string;
  team: { id: string; name: string } | { id: string; name: string }[] | null;
};

export default async function SettingsPage() {
  let settings: Settings = null;
  let rules: Rule[] = [];
  let teams: InvolvedTeam[] = [];
  try {
    const [sR, rR, tR] = await Promise.all([
      apiFetch<{ settings: Settings }>('/api/v1/pulse/settings'),
      apiFetch<{ items: Rule[] }>('/api/v1/pulse/reservation-rules'),
      apiFetch<{ items: InvolvedTeam[] }>('/api/v1/pulse/involved-teams'),
    ]);
    settings = sR.settings;
    rules = rR.items;
    teams = tR.items;
  } catch {
    /* defaults below */
  }

  return (
    <div className="px-6 py-10 max-w-5xl">
      <h1 className="text-[28px] font-semibold tracking-tight text-ink">Settings</h1>
      <p className="mt-1 text-sm text-ink-muted">
        The assumptions layer. Nothing domain-specific is hardcoded — rhythm, currency,
        reservations and involved teams are all configuration.
      </p>

      <div className="mt-8 space-y-6">
        <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
          <div className="px-5 py-3 border-b border-line text-sm font-semibold tracking-tight">
            Time rhythm & currency
          </div>
          <dl className="px-5 py-4 grid gap-3 sm:grid-cols-2 text-sm">
            <SettingRow label="Currency" value={settings?.currency ?? 'EUR (default)'} />
            <SettingRow
              label="Granularity"
              value={settings?.default_granularity ?? 'fortnight (default)'}
            />
            <SettingRow
              label="Period anchor"
              value={settings?.period_anchor_date ?? 'today (not set)'}
            />
            <SettingRow
              label="Projection horizon"
              value={`${settings?.horizon_months ?? 12} months`}
            />
          </dl>
        </section>

        <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
          <div className="px-5 py-3 border-b border-line text-sm font-semibold tracking-tight">
            Reservations
          </div>
          {rules.length === 0 ? (
            <div className="px-5 py-4 text-sm text-ink-muted">
              No reservation rules yet. Solidarity Fund, VAT reserve, buffer — all user-defined
              percentage rules; none are built in.
            </div>
          ) : (
            <div className="divide-y divide-line/60">
              {rules.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center gap-4">
                  <div
                    className={`flex-1 text-sm ${r.included ? 'text-ink' : 'text-ink-muted line-through'}`}
                  >
                    {r.label}
                  </div>
                  <span className="text-xs text-ink-muted">{r.basis.replace('_', ' ')}</span>
                  <span className="text-sm font-medium w-14 text-right">
                    {Number(r.percentage)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
          <div className="px-5 py-3 border-b border-line text-sm font-semibold tracking-tight">
            Teams involved
          </div>
          {teams.length === 0 ? (
            <div className="px-5 py-4 text-sm text-ink-muted">
              No teams take part in the planner yet. Involved teams act as hubs / incubators —
              their projects and pipelines roll up on the Teams & projects page.
            </div>
          ) : (
            <div className="divide-y divide-line/60">
              {teams.map((t) => {
                const one = Array.isArray(t.team) ? t.team[0] : t.team;
                return (
                  <div key={t.id} className="px-5 py-3 text-sm text-ink">
                    {one?.name ?? 'Unnamed team'}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-xs text-ink-muted">
          Editing these lands in the next release; the importer seeds them from your current
          spreadsheet.
        </p>
      </div>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-ink mt-0.5">{value}</dd>
    </div>
  );
}
