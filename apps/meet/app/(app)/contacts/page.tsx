import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  ErrorBanner,
  EmptyState,
} from '@/components/ui/page';
import { ContactsSearch } from './search';

type Contact = {
  email: string;
  name: string | null;
  domain: string | null;
  last_booked_at: string;
  bookings: number;
};

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
        description="People who've booked with anyone in your workspace."
      />

      {error && <ErrorBanner>Couldn&apos;t load: {error}</ErrorBanner>}

      <div className="mt-8">
        <ContactsSearch initial={q ?? ''} />
      </div>

      <section className="mt-6">
        {items.length === 0 ? (
          <EmptyState>No bookings to surface contacts from yet.</EmptyState>
        ) : (
          <ul className="rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
            {items.map((c) => (
              <li
                key={c.email}
                className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-4 px-5 py-4 text-sm"
              >
                <div className="font-medium truncate">{c.name ?? '—'}</div>
                <div className="text-ink-subtle truncate">{c.email}</div>
                <div className="text-xs text-ink-muted truncate">
                  {c.domain ?? '—'}
                </div>
                <div className="text-xs text-ink-muted whitespace-nowrap">
                  {new Date(c.last_booked_at).toLocaleDateString(undefined, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
