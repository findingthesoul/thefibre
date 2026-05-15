import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  EmptyState,
  ErrorBanner,
  SectionLabel,
} from '@/components/ui/page';

type Booking = {
  id: string;
  invitee_email: string;
  invitee_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  meeting_type: { name: string } | { name: string }[] | null;
};

function mtName(b: Booking): string {
  if (!b.meeting_type) return '';
  const mt = Array.isArray(b.meeting_type) ? b.meeting_type[0] : b.meeting_type;
  return mt?.name ?? '';
}

export default async function BookingsPage() {
  let items: Booking[] = [];
  let error: string | null = null;
  try {
    const data = await apiFetch<{ items: Booking[] }>('/api/v1/meet/bookings');
    items = data.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Bookings"
        description="What's on the books, in time order."
      />

      {error && <ErrorBanner>Couldn&apos;t load: {error}</ErrorBanner>}

      <section className="mt-10">
        <SectionLabel>Upcoming</SectionLabel>
        {items.length === 0 ? (
          <EmptyState>Nothing on the books.</EmptyState>
        ) : (
          <ol className="mt-4 border-l border-line pl-5 space-y-5">
            {items.map((b) => (
              <li key={b.id} className="relative">
                <span className="absolute -left-[22px] top-1.5 w-2 h-2 rounded-full bg-ink" />
                <div className="text-[10px] uppercase tracking-wider text-ink-muted">
                  {new Date(b.starts_at).toLocaleString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' · '}
                  {mtName(b)}
                </div>
                <div className="mt-0.5 text-sm">
                  {b.invitee_name}{' '}
                  <span className="text-ink-muted">({b.invitee_email})</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </PageContainer>
  );
}
