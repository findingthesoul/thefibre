import { Plus, Search } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { ButtonLink } from '@/components/ui/button';
import { PageContainer, PageHeader, EmptyState, ErrorBanner } from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';

type Organisation = {
  id: string;
  name: string;
  domain: string | null;
  country: string | null;
  sector: string | null;
  org_type: string | null;
  created_at: string;
};

export default async function OrganisationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  let items: Organisation[] = [];
  let error: string | null = null;
  try {
    const data = await apiFetch<{ items: Organisation[] }>(
      `/api/v1/organisations?limit=100${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    items = data.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer>
      <PageHeader
        title="Organisations"
        actions={
          <ButtonLink href="/organisations/new" leading={<Plus size={14} strokeWidth={2.25} />}>
            Add organisation
          </ButtonLink>
        }
      />

      <form className="mt-6 relative" action="/organisations">
        <Search size={15} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search name or domain…"
          className="w-full rounded-md border border-line bg-surface-raised pl-9 pr-3 py-2 text-sm placeholder:text-ink-muted focus:border-line-strong focus:outline-none"
        />
      </form>

      {error && <ErrorBanner>Couldn't load organisations: {error}</ErrorBanner>}

      {!error && items.length === 0 && (
        <EmptyState>
          No organisations yet.{' '}
          <a href="/organisations/new" className="underline">Add the first one</a>.
        </EmptyState>
      )}

      {items.length > 0 && (
        <ListGroup>
          {items.map((o) => (
            <ListRow
              key={o.id}
              href={`/organisations/${o.id}`}
              primary={o.name}
              secondary={o.domain ?? [o.sector, o.org_type].filter(Boolean).join(' · ') ?? '—'}
              meta={o.country ?? ''}
            />
          ))}
        </ListGroup>
      )}
    </PageContainer>
  );
}
