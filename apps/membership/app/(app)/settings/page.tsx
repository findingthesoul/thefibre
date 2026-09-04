import { ExternalLink } from 'lucide-react';
import { appUrl } from '@thefibre/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader } from './page-chrome';
import { JoinPageCard } from './join-page-card';
import { CircleCard } from './circle-card';
import { CurrencyCard } from './currency-card';
import { EmbedsCard } from './embeds-card';
import { workspaceCurrencies } from '@/lib/workspace-currency';

type MembershipSettings = {
  circle_community_url: string | null;
  circle_api_token_set: boolean;
  join_page: Record<string, unknown>;
};

type Me = {
  workspace: { id: string; slug: string; name: string } | null;
};

export default async function MembershipSettingsPage() {
  // Settings are admin-only on the API (403 for everyone else) — render the
  // page gracefully rather than erroring.
  let settings: MembershipSettings | null = null;
  let adminOnly = false;
  try {
    settings = await apiFetch<MembershipSettings>('/api/v1/membership/settings');
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) adminOnly = true;
    else throw e;
  }

  const me = await apiFetch<Me>('/api/v1/auth/me').catch(() => null);
  const workspaceSlug = me?.workspace?.slug ?? null;
  const currency = await workspaceCurrencies();

  const host = appUrl('membership', process.env);
  const publicUrl = workspaceSlug
    ? `${host}/${encodeURIComponent(workspaceSlug)}`
    : `${host}/<workspace-slug>`;
  const fibreSettingsUrl = `${appUrl('fibre-platform', process.env)}/settings`;

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Settings"
        description="The public join page, the Circle connection and website embeds."
      />

      {adminOnly ? (
        <p className="mt-8 rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm text-ink-subtle">
          Membership settings are for workspace admins only. Ask an admin if something here
          needs changing.
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          <JoinPageCard joinPage={settings?.join_page ?? {}} publicUrl={publicUrl} />
          <CurrencyCard
            defaultCurrency={currency.default_currency}
            currencies={currency.currencies}
          />
          <CircleCard
            communityUrl={settings?.circle_community_url ?? null}
            tokenSet={settings?.circle_api_token_set ?? false}
          />
          {workspaceSlug ? (
            <EmbedsCard host={host} workspaceSlug={workspaceSlug} />
          ) : (
            <p className="rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm text-ink-subtle">
              Embed snippets need the workspace slug — it could not be loaded right now.
            </p>
          )}
        </div>
      )}

      <a
        href={fibreSettingsUrl}
        className="mt-6 flex items-center justify-between rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm hover:bg-surface-sunken"
      >
        <span>
          <span className="font-medium">More settings in The Fibre</span>
          <span className="block text-xs text-ink-subtle">
            Profile, workspace, payments, apps and plan.
          </span>
        </span>
        <ExternalLink size={15} strokeWidth={1.75} className="text-ink-muted" />
      </a>
    </PageContainer>
  );
}
