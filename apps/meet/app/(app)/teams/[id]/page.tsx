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
import { ButtonLink } from '@/components/ui/button';
import { CopyLinkButton, OpenBookingLink } from '@/components/copy-link-button';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { TeamForm } from '../form';
import { AddMemberForm, RemoveMemberButton, PendingInviteRow } from './members';
import { VisibilityCard } from './visibility';
import { MEET_HOST } from '@/lib/public-host';

type Team = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  visibility: 'members_only' | 'org_wide';
  my_role: 'lead' | 'member' | null;
  members: {
    role: 'lead' | 'member';
    status: 'active' | 'invited';
    invite_token: string | null;
    invited_at: string | null;
    user: { id: string; email: string; full_name: string | null } | { id: string; email: string; full_name: string | null }[] | null;
  }[];
  meeting_types: {
    id: string;
    slug: string;
    name: string;
    duration_minutes: number;
    is_active: boolean;
  }[];
};

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await uiLocale();
  const { id } = await params;
  let team: Team;
  try {
    team = await apiFetch<Team>(`/api/v1/meet/teams/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    return (
      <PageContainer max="4xl">
        <Breadcrumb href="/teams" label={t(locale, 'teams_title')} />
        <ErrorBanner>{t(locale, 'couldnt_load_team')}</ErrorBanner>
      </PageContainer>
    );
  }

  const isLead = team.my_role === 'lead';

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/teams" label={t(locale, 'teams_title')} />
      <PageHeader title={team.name} description={team.description ?? undefined} />

      {isLead && (
        <section className="mt-10">
          <SectionLabel>{t(locale, 'edit')}</SectionLabel>
          <div className="mt-4">
            <TeamForm
              locale={locale}
              initial={{
                id: team.id,
                slug: team.slug,
                name: team.name,
                description: team.description,
                is_active: team.is_active,
              }}
            />
          </div>
        </section>
      )}

      <section className="mt-14">
        <SectionLabel>{t(locale, 'visibility_section')}</SectionLabel>
        <p className="mt-1 text-sm text-ink-subtle max-w-2xl">
          {t(locale, 'team_visibility_desc')}
        </p>
        <div className="mt-4 rounded-lg border border-line bg-surface-raised p-5">
          <VisibilityCard
            teamId={team.id}
            initial={team.visibility ?? 'members_only'}
            disabled={!isLead}
            locale={locale}
          />
        </div>
      </section>

      <section className="mt-14">
        <div className="flex items-center justify-between">
          <SectionLabel>{t(locale, 'members')}</SectionLabel>
        </div>
        <ListGroup>
          {team.members
            .filter((m) => m.status === 'active')
            .map((m, i) => {
              const u = Array.isArray(m.user) ? m.user[0] : m.user;
              if (!u) return null;
              return (
                <ListRow
                  key={`${u.id}-${i}`}
                  primary={u.full_name ?? u.email}
                  secondary={u.email}
                  meta={
                    <>
                      <span className="uppercase tracking-wider text-ink-muted">
                        {m.role === 'lead' ? t(locale, 'role_lead') : t(locale, 'role_member')}
                      </span>
                      {isLead && (
                        <RemoveMemberButton teamId={team.id} userId={u.id} locale={locale} />
                      )}
                    </>
                  }
                />
              );
            })}
        </ListGroup>
        {isLead && (
          <div className="mt-6">
            <AddMemberForm teamId={team.id} locale={locale} />
          </div>
        )}
      </section>

      {isLead &&
        team.members.some((m) => m.status === 'invited') && (
          <section className="mt-14">
            <SectionLabel>{t(locale, 'pending_invites')}</SectionLabel>
            <p className="mt-1 text-sm text-ink-subtle max-w-2xl">
              {t(locale, 'pending_invites_desc')}
            </p>
            <ul className="mt-4 rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
              {team.members
                .filter((m) => m.status === 'invited')
                .map((m, i) => {
                  const u = Array.isArray(m.user) ? m.user[0] : m.user;
                  if (!u || !m.invite_token) return null;
                  return (
                    <PendingInviteRow
                      key={`${u.id}-${i}`}
                      teamId={team.id}
                      userId={u.id}
                      email={u.email}
                      name={u.full_name}
                      role={m.role}
                      token={m.invite_token}
                      invitedAt={m.invited_at}
                      locale={locale}
                    />
                  );
                })}
            </ul>
          </section>
        )}

      <section className="mt-14">
        <div className="flex items-center justify-between">
          <SectionLabel>{t(locale, 'mt_title')}</SectionLabel>
          {isLead && (
            <ButtonLink href={`/meeting-types/new?team=${team.id}`}>
              {t(locale, 'new_mt_title')}
            </ButtonLink>
          )}
        </div>
        {team.meeting_types.length === 0 ? (
          <EmptyState>
            {t(locale, 'team_no_mts')}
          </EmptyState>
        ) : (
          <ListGroup>
            {team.meeting_types.map((mt) => {
              const bookingPath = `/${team.slug}/${mt.slug}`;
              return (
                <ListRow
                  key={mt.id}
                  href={`/meeting-types/${mt.id}`}
                  primary={mt.name}
                  secondary={`${MEET_HOST}${bookingPath}`}
                  meta={
                    <>
                      {!mt.is_active && (
                        <span className="uppercase tracking-wider text-ink-muted">
                          {t(locale, 'hidden')}
                        </span>
                      )}
                      <span>{mt.duration_minutes} min</span>
                    </>
                  }
                  trailing={
                    mt.is_active && (
                      <div className="flex items-center gap-1">
                        <CopyLinkButton
                          url={bookingPath}
                          label={t(locale, 'copy_booking_link')}
                          copiedLabel={t(locale, 'copied')}
                        />
                        <OpenBookingLink href={bookingPath} label={t(locale, 'open_booking_page')} />
                      </div>
                    )
                  }
                />
              );
            })}
          </ListGroup>
        )}
      </section>
    </PageContainer>
  );
}
