import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, Breadcrumb, PageHeader, ErrorBanner } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { TeamsClient, type TeamRow, type GrantableApp } from './teams-client';

type Me = {
  user: { id: string; is_super_admin?: boolean };
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

  const explicitAdmin =
    me?.memberships?.some((m) => {
      const app = Array.isArray(m.app) ? m.app[0] : m.app;
      return app?.slug === 'fibre-platform' && m.role === 'admin';
    }) ?? false;
  const isWorkspaceAdmin = explicitAdmin || !!me?.user.is_super_admin;

  // Same door as Settings → Members: deciding who may open what is an admin
  // act. The API refuses regardless; this only saves the trip.
  if (me && !isWorkspaceAdmin) redirect('/settings');

  try {
    const r = await apiFetch<{
      items: TeamRow[];
      grantable: GrantableApp[];
      can_edit_grants: boolean;
    }>('/api/v1/teams');
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
