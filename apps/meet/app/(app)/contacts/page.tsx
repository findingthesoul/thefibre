import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  ErrorBanner,
  EmptyState,
} from '@/components/ui/page';
import { ContactsSearch } from './search';
import { ContactRow, type Contact } from './contact-row';

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  let items: Contact[] = [];
  let error: string | null = null;
  try {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    const r = await apiFetch<{ items: Contact[] }>(`/api/v1/meet/contacts${qs}`);
    items = r.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Contacts"
        description="People Meet has a reason to know about — invitees on bookings, and members of your Meet teams. Identity is managed in The Fibre platform; Meet only surfaces the slice it justifies."
      />

      {error && <ErrorBanner>Couldn&apos;t load: {error}</ErrorBanner>}

      <div className="mt-8">
        <ContactsSearch initial={q ?? ''} />
      </div>

      <section className="mt-6">
        {items.length === 0 ? (
          <EmptyState>No-one has booked yet, and your teams have no members — so Meet has no contacts to show.</EmptyState>
        ) : (
          <ul className="rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
            {items.map((c) => (
              <ContactRow key={c.id} contact={c} />
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
