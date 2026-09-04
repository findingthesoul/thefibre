import { Breadcrumb, PageContainer, PageHeader } from '../page-chrome';
import { CircleCard } from '../circle-card';
import { SeatPolicyCard } from '../seat-policy-card';
import { loadSettings } from '../shared';

// The integrations LIST (Sjoerd, 2026-09-05: "a list of integrations with
// only one now") — the Memberful-style catalogue the proposal §3.6 names
// as the roadmap. Each access-grant kind that lands gets a row here;
// Circle.so is row one.

export default async function IntegrationsSettings() {
  const { settings, adminOnly } = await loadSettings();

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Integrations"
        description="The tools membership unlocks for members. Access grants (per tier) decide who gets in; integrations hold the connection."
      />
      <div className="mt-8 space-y-6">
        {adminOnly ? (
          <p className="rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm text-ink-subtle">
            Workspace admins only.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-line bg-surface-sunken px-5 py-3">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-medium text-ink">Circle.so</span>
                <span className="text-xs text-ink-muted">community platform</span>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  settings?.circle_api_token_set
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'border border-line text-ink-muted'
                }`}
              >
                {settings?.circle_api_token_set ? 'Connected' : 'Not connected'}
              </span>
            </div>
            <div className="!mt-0 rounded-b-lg border border-line">
              <CircleCard
                communityUrl={settings?.circle_community_url ?? null}
                tokenSet={settings?.circle_api_token_set ?? false}
              />
            </div>
            <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-line bg-surface-sunken px-5 py-3">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-medium text-ink">The Fibre</span>
                <span className="text-xs text-ink-muted">workspace seats — built in</span>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
                Always connected
              </span>
            </div>
            <div className="!mt-0 rounded-b-lg border border-line">
              <SeatPolicyCard
                mode={(settings as { fibre_seat_mode?: 'auto' | 'approve' } | null)?.fibre_seat_mode ?? 'approve'}
                allowBilled={(settings as { allow_billed_seats?: boolean } | null)?.allow_billed_seats ?? false}
              />
            </div>
            <p className="text-xs text-ink-muted">
              More integrations land here as they're built — Discord, Discourse, email tools.
              Each one becomes available as an access grant on your tiers' products.
            </p>
          </>
        )}
      </div>
    </PageContainer>
  );
}
