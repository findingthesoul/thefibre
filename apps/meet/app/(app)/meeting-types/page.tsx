import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  SectionLabel,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';
import { ButtonLink } from '@/components/ui/button';

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
  let error: string | null = null;

  try {
    const [data, h] = await Promise.all([
      apiFetch<{ items: MeetingType[] }>('/api/v1/meet/meeting-types'),
      apiFetch<Host>('/api/v1/meet/me'),
    ]);
    items = data.items;
    host = h;
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
        {list.map((mt) => (
          <ListRow
            key={mt.id}
            href={`/meeting-types/${mt.id}`}
            primary={mt.name}
            secondary={`meet.thefibre.app/${prefix}/${mt.slug}`}
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
    );
  }

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Meeting types"
        description="What you offer to be booked for."
        actions={<ButtonLink href="/meeting-types/new">New meeting type</ButtonLink>}
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
