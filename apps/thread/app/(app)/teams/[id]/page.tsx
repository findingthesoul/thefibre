import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
  SectionLabel,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { AddMemberRow, RemoveMemberButton } from './members';
import { TeamSettings } from './team-settings';
import { RemoveOfferButton } from './offered';
import { THREAD_HOST } from '@/lib/public-host';

type TeamMember = {
  user_id: string;
  role: 'lead' | 'member';
  status: string;
  full_name: string | null;
  email: string;
};

type TeamDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  payout_destination?: 'workspace' | 'lead';
  members: TeamMember[];
};

type WorkspaceMember = {
  user_id: string;
  full_name: string | null;
  email: string;
  workspace_role: string;
};

const ROLE_STYLES: Record<string, string> = {
  lead: 'bg-sky-50 text-sky-700 ring-sky-200',
  member: 'bg-surface-sunken text-ink-subtle ring-line',
};

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await uiLocale();
  const { id } = await params;

  let team: TeamDetail;
  try {
    team = await apiFetch<TeamDetail>(`/api/v1/thread/teams/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    return (
      <PageContainer max="4xl">
        <Breadcrumb href="/teams" label={t(locale, 'teams')} />
        <ErrorBanner>{t(locale, 'couldnt_load_team')}</ErrorBanner>
      </PageContainer>
    );
  }

  const workspaceMembers = await apiFetch<{ items: WorkspaceMember[] }>(
    '/api/v1/thread/workspace-members',
  ).catch(() => ({ items: [] as WorkspaceMember[] }));

  // Threads other teams have offered to this one (multi-team). Absent on a
  // failed read: the section simply does not show.
  const offered = await apiFetch<{
    items: { thread_id: string; title: string | null; starts_on: string | null; owner_team: string | null }[];
    can_remove: boolean;
  }>(`/api/v1/thread/teams/${team.id}/offered`).catch(() => null);

  const memberIds = new Set(team.members.map((m) => m.user_id));
  const candidates = workspaceMembers.items.filter((w) => !memberIds.has(w.user_id));

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/teams" label={t(locale, 'teams')} />
      <PageHeader
        title={team.name}
        description={
          <>
            {THREAD_HOST}/{team.slug}
            {team.description ? <> · {team.description}</> : null}
          </>
        }
      />

      <section className="mt-10">
        <SectionLabel>{t(locale, 'members')}</SectionLabel>
        {team.members.length === 0 ? (
          <EmptyState>{t(locale, 'no_members_yet')}</EmptyState>
        ) : (
          <ListGroup>
            {team.members.map((m) => (
              <ListRow
                key={m.user_id}
                primary={m.full_name ?? m.email}
                secondary={m.email}
                meta={
                  <>
                    {m.status && m.status !== 'active' && (
                      <span className="uppercase tracking-wider text-ink-muted">
                        {m.status}
                      </span>
                    )}
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ring-1 ${
                        ROLE_STYLES[m.role] ?? ROLE_STYLES.member
                      }`}
                    >
                      {m.role === 'lead' ? t(locale, 'role_lead') : t(locale, 'role_member')}
                    </span>
                  </>
                }
                trailing={
                  <RemoveMemberButton
                    locale={locale}
                    teamId={team.id}
                    userId={m.user_id}
                    name={m.full_name ?? m.email}
                  />
                }
              />
            ))}
          </ListGroup>
        )}

        <div className="mt-6">
          <AddMemberRow locale={locale} teamId={team.id} candidates={candidates} />
        </div>
      </section>

      {offered && offered.items.length > 0 && (
        <section className="mt-10">
          <SectionLabel>{t(locale, 'offered_to_team_title')}</SectionLabel>
          <p className="mb-3 text-sm text-ink-muted">{t(locale, 'offered_to_team_desc')}</p>
          <ListGroup>
            {offered.items.map((o) => (
              <ListRow
                key={o.thread_id}
                primary={o.title ?? '—'}
                secondary={o.owner_team ? t(locale, 'offered_by', { team: o.owner_team }) : undefined}
                trailing={
                  offered.can_remove ? (
                    <RemoveOfferButton locale={locale} teamId={team.id} threadId={o.thread_id} title={o.title ?? '—'} />
                  ) : undefined
                }
              />
            ))}
          </ListGroup>
        </section>
      )}

      <TeamSettings
        locale={locale}
        teamId={team.id}
        description={team.description}
        payoutDestination={team.payout_destination ?? 'workspace'}
        leadName={
          team.members.find((m) => m.role === 'lead')?.full_name ??
          team.members.find((m) => m.role === 'lead')?.email ??
          null
        }
      />
    </PageContainer>
  );
}
