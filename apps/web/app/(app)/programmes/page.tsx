import Link from 'next/link';
import { Plus } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { ButtonLink } from '@/components/ui/button';
import { PageContainer, PageHeader, EmptyState, ErrorBanner } from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';

type Programme = {
  id: string;
  title: string;
  format: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  app: { slug: string; name: string } | null;
};

const FORMAT_LABEL: Record<string, string> = {
  meeting: 'Meeting',
  event: 'Event',
  journey: 'Journey',
  self_paced: 'Self-paced',
  blended: 'Blended',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
};

export default async function ProgrammesPage() {
  let items: Programme[] = [];
  let error: string | null = null;
  try {
    const data = await apiFetch<{ items: Programme[] }>('/api/v1/programs');
    items = data.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer>
      <PageHeader
        title="Programmes"
        description="Events, journeys, meetings, courses. Each programme belongs to the app that delivers it."
        actions={
          <ButtonLink href="/programmes/new" leading={<Plus size={14} strokeWidth={2.25} />}>
            New programme
          </ButtonLink>
        }
      />

      {error && <ErrorBanner>Couldn't load programmes: {error}</ErrorBanner>}

      {!error && items.length === 0 && (
        <EmptyState>
          No programmes yet.{' '}
          <Link href="/programmes/new" className="underline">Create the first one</Link>.
        </EmptyState>
      )}

      {items.length > 0 && (
        <ListGroup>
          {items.map((p) => {
            const dates = formatDateRange(p.starts_on, p.ends_on);
            return (
              <ListRow
                key={p.id}
                href={`/programmes/${p.id}`}
                primary={p.title}
                secondary={
                  [FORMAT_LABEL[p.format] ?? p.format, p.app?.name, dates]
                    .filter(Boolean)
                    .join(' · ') || '—'
                }
                meta={STATUS_LABEL[p.status] ?? p.status}
              />
            );
          })}
        </ListGroup>
      )}
    </PageContainer>
  );
}

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (s: string) =>
    new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `from ${fmt(start)}`;
  if (end) return `until ${fmt(end!)}`;
  return null;
}
