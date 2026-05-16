import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  ErrorBanner,
  EmptyState,
} from '@/components/ui/page';
import { ContactsSearch } from './search';

type Contact = {
  id: string;
  email: string | null;
  name: string | null;
  domain: string | null;
  is_user: boolean;
  is_team_member: boolean;
  meet_bookings: number;
  meet_last_booked_at: string | null;
  source: Array<'booking' | 'team'>;
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
              <li
                key={c.id}
                className="grid grid-cols-[1fr_1fr_auto_auto_auto] items-center gap-4 px-5 py-4 text-sm"
              >
                <div className="font-medium truncate flex items-center gap-2">
                  {c.name ?? '—'}
                  {c.is_team_member && (
                    <span className="text-[9px] uppercase tracking-wider text-ink-muted border border-line rounded px-1 py-0.5">
                      Team
                    </span>
                  )}
                  {c.source.includes('booking') && (
                    <span className="text-[9px] uppercase tracking-wider text-ink-muted border border-line rounded px-1 py-0.5">
                      Booked
                    </span>
                  )}
                </div>
                <div className="text-ink-subtle truncate">{c.email ?? '—'}</div>
                <div className="text-xs text-ink-muted truncate">
                  {c.domain ?? '—'}
                </div>
                <div className="text-xs text-ink-muted whitespace-nowrap">
                  {c.meet_bookings > 0 ? `${c.meet_bookings} booking${c.meet_bookings === 1 ? '' : 's'}` : '—'}
                </div>
                <div className="text-xs text-ink-muted whitespace-nowrap">
                  {c.meet_last_booked_at
                    ? new Date(c.meet_last_booked_at).toLocaleDateString(undefined, {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })
                    : '—'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
