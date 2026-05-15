import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  SectionLabel,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';

type Me = {
  user: { full_name: string | null; email: string };
  workspace: { id: string; name: string } | null;
};
type Host = { id: string; slug: string };
type MT = { id: string; slug: string; name: string; is_active: boolean };
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

export default async function MeetDashboard() {
  let me: Me | null = null;
  let host: Host | null = null;
  let mts: MT[] = [];
  let bookings: Booking[] = [];
  let error: string | null = null;

  try {
    [me, host] = await Promise.all([
      apiFetch<Me>('/api/v1/auth/me'),
      apiFetch<Host>('/api/v1/meet/me'),
    ]);
    const [a, b] = await Promise.all([
      apiFetch<{ items: MT[] }>('/api/v1/meet/meeting-types').catch(() => ({ items: [] })),
      apiFetch<{ items: Booking[] }>('/api/v1/meet/bookings').catch(() => ({ items: [] })),
    ]);
    mts = a.items;
    bookings = b.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  const firstName =
    me?.user.full_name?.split(/\s+/)[0] ?? me?.user.email?.split('@')[0] ?? '';
  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  const activeMts = mts.filter((m) => m.is_active);

  return (
    <PageContainer>
      <PageHeader title={`Welcome to Meet, ${firstName}`} description={today} />

      {error && <ErrorBanner>Couldn&apos;t load some data: {error}</ErrorBanner>}

      <section className="mt-10 grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          label="Booking URL"
          value={host ? `meet.thefibre.app/${host.slug}` : '—'}
          mono
          href="/settings"
        />
        <StatCard
          label="Active meeting types"
          value={String(activeMts.length)}
          href="/meeting-types"
        />
        <StatCard
          label="Upcoming bookings"
          value={String(bookings.length)}
        />
      </section>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-10">
        <section>
          <SectionLabel>Upcoming bookings</SectionLabel>
          {bookings.length === 0 ? (
            <EmptyState>Nothing on the books.</EmptyState>
          ) : (
            <ol className="mt-4 border-l border-line pl-5 space-y-4">
              {bookings.map((b) => (
                <li key={b.id} className="relative">
                  <span className="absolute -left-[22px] top-1.5 w-2 h-2 rounded-full bg-ink" />
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted">
                    {new Date(b.starts_at).toLocaleString(undefined, {
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

        <section>
          <div className="flex items-baseline justify-between">
            <SectionLabel>Your meeting types</SectionLabel>
            <Link
              href="/meeting-types"
              className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2"
            >
              Manage →
            </Link>
          </div>
          {activeMts.length === 0 ? (
            <EmptyState>
              No active meeting types.{' '}
              <Link href="/meeting-types/new" className="underline">
                Create one
              </Link>
              .
            </EmptyState>
          ) : (
            <ListGroup>
              {activeMts.map((mt) => (
                <ListRow
                  key={mt.id}
                  href={`/meeting-types/${mt.id}`}
                  primary={mt.name}
                  secondary={host ? `/${host.slug}/${mt.slug}` : undefined}
                />
              ))}
            </ListGroup>
          )}
        </section>
      </div>
    </PageContainer>
  );
}

function StatCard({
  label,
  value,
  href,
  mono,
}: {
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
}) {
  const inner = (
    <div className="rounded-lg border border-line bg-surface-raised p-4 h-full">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      <div
        className={`mt-2 ${mono ? 'font-mono text-sm' : 'text-2xl font-medium tracking-tight'}`}
      >
        {value}
      </div>
    </div>
  );
  return href ? (
    <Link
      href={href}
      className="block h-full hover:bg-surface-sunken transition-colors rounded-lg"
    >
      {inner}
    </Link>
  ) : (
    inner
  );
}
