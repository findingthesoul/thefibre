import { redirect, notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, Breadcrumb, PageHeader, ErrorBanner } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { TeamDetailClient, type TeamDetail, type TeamMember } from './team-client';
import type { GrantableApp } from '../teams-client';

type Me = {
  user: { id: string; is_super_admin?: boolean };
  memberships: { app: { slug: string } | { slug: string }[] | null; role: string }[];
};

type WorkspaceMember = { user_id: string; full_name: string | null; email: string };

type TeamDetailResponse = {
  team: TeamDetail;
  members: TeamMember[];
  apps: { app_id: string; slug: string | null; name: string | null; lead_is_app_admin: boolean }[];
  grantable: GrantableApp[];
  can_edit_grants: boolean;
};

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await uiLocale();

  let me: Me | null = null;
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
  if (me && !(explicitAdmin || me.user.is_super_admin)) redirect('/settings');

  let detail: TeamDetailResponse | null = null;
  let workspaceMembers: WorkspaceMember[] = [];

  try {
    const [teamRes, membersRes] = await Promise.all([
      apiFetch<TeamDetailResponse>(`/api/v1/teams/${id}`),
      apiFetch<{ items: WorkspaceMember[] }>('/api/v1/members'),
    ]);
    detail = teamRes;
    workspaceMembers = membersRes.items;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    if (!error) error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings/teams" label={t(locale, 'teams_title')} />

      {error && (
        <ErrorBanner>
          {t(locale, 'teams_load_failed')} {error}
        </ErrorBanner>
      )}

      {detail && (
        <>
          <PageHeader
            title={detail.team.name}
            description={detail.team.description ?? undefined}
          />
          <TeamDetailClient
            team={detail.team}
            members={detail.members}
            apps={detail.apps
              .filter((a): a is typeof a & { slug: string } => !!a.slug)
              .map((a) => ({ slug: a.slug, lead_is_app_admin: a.lead_is_app_admin }))}
            grantable={detail.grantable ?? []}
            canEditGrants={!!detail.can_edit_grants}
            workspaceMembers={workspaceMembers}
            locale={locale}
          />
        </>
      )}
    </PageContainer>
  );
}
