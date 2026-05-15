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
import { TeamForm } from '../form';
import { AddMemberForm, RemoveMemberButton, PendingInviteRow } from './members';

type Team = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
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
  const { id } = await params;
  let team: Team;
  try {
    team = await apiFetch<Team>(`/api/v1/meet/teams/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    return (
      <PageContainer max="4xl">
        <Breadcrumb href="/teams" label="Teams" />
        <ErrorBanner>Couldn&apos;t load the team.</ErrorBanner>
      </PageContainer>
    );
  }

  const isLead = team.my_role === 'lead';

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/teams" label="Teams" />
      <PageHeader title={team.name} description={team.description ?? undefined} />

      {isLead && (
        <section className="mt-10">
          <SectionLabel>Edit</SectionLabel>
          <div className="mt-4">
            <TeamForm
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
        <div className="flex items-center justify-between">
          <SectionLabel>Members</SectionLabel>
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
                        {m.role}
                      </span>
                      {isLead && (
                        <RemoveMemberButton teamId={team.id} userId={u.id} />
                      )}
                    </>
                  }
                />
              );
            })}
        </ListGroup>
        {isLead && (
          <div className="mt-6">
            <AddMemberForm teamId={team.id} />
          </div>
        )}
      </section>

      {isLead &&
        team.members.some((m) => m.status === 'invited') && (
          <section className="mt-14">
            <SectionLabel>Pending invites</SectionLabel>
            <p className="mt-1 text-sm text-ink-subtle max-w-2xl">
              These invitees haven&apos;t accepted yet. They&apos;ll start receiving
              bookings only after they accept. Copy the link if the email
              didn&apos;t land.
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
                    />
                  );
                })}
            </ul>
          </section>
        )}

      <section className="mt-14">
        <div className="flex items-center justify-between">
          <SectionLabel>Meeting types</SectionLabel>
          {isLead && (
            <ButtonLink href={`/meeting-types/new?team=${team.id}`}>
              New meeting type
            </ButtonLink>
          )}
        </div>
        {team.meeting_types.length === 0 ? (
          <EmptyState>
            No meeting types for this team yet.
          </EmptyState>
        ) : (
          <ListGroup>
            {team.meeting_types.map((mt) => (
              <ListRow
                key={mt.id}
                href={`/meeting-types/${mt.id}`}
                primary={mt.name}
                secondary={`meet.thefibre.app/${team.slug}/${mt.slug}`}
                meta={
                  <>
                    {!mt.is_active && (
                      <span className="uppercase tracking-wider text-ink-muted">
                        Hidden
                      </span>
                    )}
                    <span>{mt.duration_minutes} min</span>
                  </>
                }
              />
            ))}
          </ListGroup>
        )}
      </section>
    </PageContainer>
  );
}
