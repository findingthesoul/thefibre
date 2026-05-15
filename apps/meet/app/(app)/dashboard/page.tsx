import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  ErrorBanner,
} from '@/components/ui/page';
import { QuickLinkRow, type QuickLink } from './quick-link';

type Me = {
  user: { full_name: string | null; email: string };
};
type Host = { id: string; slug: string };
type MT = {
  id: string;
  slug: string;
  name: string;
  duration_minutes: number;
  is_active: boolean;
  team_id: string | null;
  team:
    | { id: string; name: string; slug: string }
    | { id: string; name: string; slug: string }[]
    | null;
};
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

function teamOf(mt: MT): { name: string; slug: string } | null {
  if (!mt.team) return null;
  return Array.isArray(mt.team) ? (mt.team[0] ?? null) : mt.team;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
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
  const today = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const baseUrl =
    process.env.NEXT_PUBLIC_MEET_URL ?? 'https://meet.thefibre.app';
  const quickLinks: QuickLink[] = mts
    .filter((m) => m.is_active)
    .slice(0, 3)
    .map((m) => {
      const team = teamOf(m);
      const path = team
        ? `/${team.slug}/${m.slug}`
        : host
          ? `/${host.slug}/${m.slug}`
          : '';
      return {
        id: m.id,
        name: m.name,
        team: team?.name ?? null,
        durationMinutes: m.duration_minutes,
        path,
        url: path ? `${baseUrl}${path}` : '',
      };
    });

  const todayBookings = bookings.filter((b) => isToday(b.starts_at));
  const nextUp = bookings.filter((b) => !isToday(b.starts_at)).slice(0, 5);

  return (
    <PageContainer max="4xl">
      <PageHeader title={`Welcome, ${firstName}`} description={today} />

      {error && <ErrorBanner>Couldn&apos;t load some data: {error}</ErrorBanner>}

      <section className="mt-10">
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          Quick links
        </div>
        <p className="mt-1 text-sm text-ink-subtle">
          Your active meeting types — copy and share.
        </p>

        {quickLinks.length === 0 ? (
          <div className="mt-4 rounded-lg border border-line bg-surface-raised p-6 text-sm text-ink-subtle">
            No active meeting types yet.{' '}
            <Link href="/meeting-types/new" className="underline">
              Create one
            </Link>
            .
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
            {quickLinks.map((q) => (
              <QuickLinkRow key={q.id} link={q} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        <section>
          <div className="flex items-baseline justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              Today
            </div>
            {bookings.length > 0 && (
              <Link
                href="/bookings"
                className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2"
              >
                View all
              </Link>
            )}
          </div>
          {todayBookings.length === 0 ? (
            <div className="mt-4 rounded-lg border border-line bg-surface-raised p-6 text-sm text-ink-subtle">
              Nothing on the calendar today.
            </div>
          ) : (
            <ul className="mt-4 rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
              {todayBookings.map((b) => (
                <BookingRow key={b.id} booking={b} />
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="flex items-baseline justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              Next up{' '}
              <span className="text-ink-muted lowercase">({nextUp.length})</span>
            </div>
            {bookings.length > 0 && (
              <Link
                href="/bookings"
                className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2"
              >
                View all
              </Link>
            )}
          </div>
          {nextUp.length === 0 ? (
            <div className="mt-4 rounded-lg border border-line bg-surface-raised p-6 text-sm text-ink-subtle">
              No upcoming bookings.
            </div>
          ) : (
            <ul className="mt-4 rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
              {nextUp.map((b) => (
                <BookingRow key={b.id} booking={b} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageContainer>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  const starts = new Date(booking.starts_at);
  const ends = new Date(booking.ends_at);
  const dateStr = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(starts);
  const timeStr = `${new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(starts)}–${new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(ends)}`;
  return (
    <li className="px-5 py-4 text-sm">
      <div className="font-medium">
        {booking.invitee_name}
        <span className="text-ink-subtle font-normal">
          {' · '}
          {mtName(booking)}
        </span>
      </div>
      <div className="mt-1 text-xs text-ink-muted">
        {dateStr} · {timeStr}
      </div>
    </li>
  );
}
