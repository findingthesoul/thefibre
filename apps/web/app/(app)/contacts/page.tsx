import { Plus, Search } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { ButtonLink } from '@/components/ui/button';
import { PageContainer, PageHeader, EmptyState, ErrorBanner } from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';

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
  const locale = await uiLocale();

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
        title={t(locale, 'nav_contacts')}
        actions={
          <ButtonLink href="/contacts/new" leading={<Plus size={14} strokeWidth={2.25} />}>
            {t(locale, 'add_person')}
          </ButtonLink>
        }
      />

      <form className="mt-6 relative" action="/contacts">
        <Search size={15} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder={t(locale, 'search_name_email')}
          className="w-full rounded-md border border-line bg-surface-raised pl-9 pr-3 py-2 text-sm placeholder:text-ink-muted focus:border-line-strong focus:outline-none"
        />
      </form>

      {error && <ErrorBanner>{t(locale, 'contacts_load_failed')} {error}</ErrorBanner>}

      {!error && items.length === 0 && (
        <EmptyState>
          {t(locale, 'no_contacts_yet')}{' '}
          <a href="/contacts/new" className="underline">{t(locale, 'add_first_one')}</a>.
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
