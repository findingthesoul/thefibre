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

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Meeting types"
        description="What you offer to be booked for."
        actions={<ButtonLink href="/meeting-types/new">New meeting type</ButtonLink>}
      />

      {error && <ErrorBanner>Couldn&apos;t load: {error}</ErrorBanner>}

      <section className="mt-10">
        <SectionLabel>Active and hidden</SectionLabel>
        {items.length === 0 ? (
          <EmptyState>No meeting types yet. Create your first one.</EmptyState>
        ) : (
          <ListGroup>
            {items.map((mt) => (
              <ListRow
                key={mt.id}
                href={`/meeting-types/${mt.id}`}
                primary={mt.name}
                secondary={
                  host
                    ? `meet.thefibre.app/${host.slug}/${mt.slug}`
                    : undefined
                }
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
