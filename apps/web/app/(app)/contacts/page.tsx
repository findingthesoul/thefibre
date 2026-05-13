import { Plus, Search } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { ButtonLink } from '@/components/ui/button';
import { PageContainer, PageHeader, EmptyState, ErrorBanner } from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';

type Person = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  country: string | null;
  created_at: string;
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  let items: Person[] = [];
  let error: string | null = null;
  try {
    const data = await apiFetch<{ items: Person[] }>(
      `/api/v1/persons?limit=100${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    items = data.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer>
      <PageHeader
        title="Contacts"
        actions={
          <ButtonLink href="/contacts/new" leading={<Plus size={14} strokeWidth={2.25} />}>
            Add person
          </ButtonLink>
        }
      />

      <form className="mt-6 relative" action="/contacts">
        <Search size={15} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search name or email…"
          className="w-full rounded-md border border-line bg-surface-raised pl-9 pr-3 py-2 text-sm placeholder:text-ink-muted focus:border-line-strong focus:outline-none"
        />
      </form>

      {error && <ErrorBanner>Couldn't load contacts: {error}</ErrorBanner>}

      {!error && items.length === 0 && (
        <EmptyState>
          No contacts yet.{' '}
          <a href="/contacts/new" className="underline">Add the first one</a>.
        </EmptyState>
      )}

      {items.length > 0 && (
        <ListGroup>
          {items.map((p) => (
            <ListRow
              key={p.id}
              href={`/contacts/${p.id}`}
              primary={`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—'}
              secondary={p.email ?? '—'}
              meta={p.country ?? ''}
            />
          ))}
        </ListGroup>
      )}
    </PageContainer>
  );
}
