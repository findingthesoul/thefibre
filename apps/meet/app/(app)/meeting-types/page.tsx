import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  SectionLabel,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';
import { CopyLinkButton, OpenBookingLink } from '@/components/copy-link-button';
import { NewMeetingTypeMenu } from './new-menu';

type Team = { id: string; name: string; my_role: 'lead' | 'member' };

type MeetingType = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  conferencing_provider: string;
  is_active: boolean;
  team_id: string | null;
  team:
    | { id: string; name: string; slug: string }
    | { id: string; name: string; slug: string }[]
    | null;
};

type Host = { slug: string };

export default async function MeetingTypesPage() {
  let items: MeetingType[] = [];
  let host: Host | null = null;
  let teams: Team[] = [];
  let error: string | null = null;

  try {
    const [data, h, t] = await Promise.all([
      apiFetch<{ items: MeetingType[] }>('/api/v1/meet/meeting-types'),
      apiFetch<Host>('/api/v1/meet/me'),
      apiFetch<{ items: Team[] }>('/api/v1/meet/teams').catch(() => ({ items: [] })),
    ]);
    items = data.items;
    host = h;
    teams = t.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  const personal = items.filter((m) => !m.team_id);
  const byTeam = new Map<string, { name: string; slug: string; items: MeetingType[] }>();
  for (const mt of items) {
    if (!mt.team_id) continue;
    const t = Array.isArray(mt.team) ? mt.team[0] : mt.team;
    if (!t) continue;
    const bucket = byTeam.get(t.id) ?? { name: t.name, slug: t.slug, items: [] };
    bucket.items.push(mt);
    byTeam.set(t.id, bucket);
  }

  function renderList(prefix: string, list: MeetingType[]) {
    return (
      <ListGroup>
        {list.map((mt) => {
          // The public booking path. We store it as a path (not absolute
          // URL) so the icon buttons resolve it against window.location.
          const bookingPath = `/${prefix}/${mt.slug}`;
          return (
            <ListRow
              key={mt.id}
              href={`/meeting-types/${mt.id}`}
              primary={mt.name}
              secondary={`meet.thefibre.app${bookingPath}`}
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
              trailing={
                mt.is_active && (
                  <div className="flex items-center gap-1">
                    <CopyLinkButton url={bookingPath} label="Copy booking link" />
                    <OpenBookingLink href={bookingPath} />
                  </div>
                )
              }
            />
          );
        })}
      </ListGroup>
    );
  }

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Meeting types"
        description="What you offer to be booked for."
        actions={<NewMeetingTypeMenu teams={teams} />}
      />

      {error && <ErrorBanner>Couldn&apos;t load: {error}</ErrorBanner>}

      <section className="mt-10">
        <SectionLabel>Personal</SectionLabel>
        {personal.length === 0 ? (
          <EmptyState>No personal meeting types yet.</EmptyState>
        ) : (
          host && renderList(host.slug, personal)
        )}
      </section>

      {Array.from(byTeam.entries()).map(([id, bucket]) => (
        <section key={id} className="mt-14">
          <SectionLabel>{bucket.name}</SectionLabel>
          {renderList(bucket.slug, bucket.items)}
        </section>
      ))}
    </PageContainer>
  );
}
