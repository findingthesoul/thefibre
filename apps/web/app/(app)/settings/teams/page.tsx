import { canManageWorkspace } from '@thefibre/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, Breadcrumb, PageHeader, ErrorBanner } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { TeamsClient, type TeamRow, type GrantableApp } from './teams-client';

type Me = {
  user: { id: string; is_super_admin?: boolean };
  /** Role in the ACTIVE workspace — what decides who may manage it. */
  workspace_role?: string | null;
  memberships: { app: { slug: string } | { slug: string }[] | null; role: string }[];
};

export default async function TeamsSettingsPage() {
  const locale = await uiLocale();
  let me: Me | null = null;
  let teams: TeamRow[] = [];
  let grantable: GrantableApp[] = [];
  let canEditGrants = false;
  let error: string | null = null;

  try {
    me = await apiFetch<Me>('/api/v1/auth/me');
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  const isWorkspaceAdmin = canManageWorkspace(me);

  // Same door as Settings → Members: deciding who may open what is an admin
  // act. The API refuses regardless; this only saves the trip — and now says
  // so, instead of redirecting to the page the link was clicked from, which
  // looked exactly like a dead link.
  if (me && !isWorkspaceAdmin) {
    return (
      <PageContainer max="4xl">
        <PageHeader title="Teams" description="Managing the workspace is for its admins." />
        <p className="mt-6 text-sm text-ink-subtle">
          Your account can use this workspace but not change its teams. An admin of this
          workspace can give you that, or make the change for you.
        </p>
      </PageContainer>
    );
  }

  try {
    const r = await apiFetch<{
      items: TeamRow[];
      grantable: GrantableApp[];
      can_edit_grants: boolean;
      // `with_automatic=1` opts IN to Everyone and Admins. This page hid them
      // until 2026-10-09, which meant the apps a NEW person gets could only be
      // changed by a script — the thing they exist to express was unreachable.
    }>('/api/v1/teams?with_automatic=1');
    teams = r.items;
    grantable = r.grantable ?? [];
    canEditGrants = !!r.can_edit_grants;
  } catch (e) {
    if (!error) error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label={t(locale, 'nav_settings')} />
      <PageHeader title={t(locale, 'teams_title')} description={t(locale, 'teams_blurb')} />

      {error && (
        <ErrorBanner>
          {t(locale, 'teams_load_failed')} {error}
        </ErrorBanner>
      )}

      {!error && (
        <TeamsClient
          teams={teams}
          grantable={grantable}
          canEditGrants={canEditGrants}
          locale={locale}
        />
      )}
    </PageContainer>
  );
}
