import { apiFetch } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { MeetProfileEdit, type MeetProfileRow } from './edit';

type Booking = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: 'confirmed' | 'cancelled' | 'pending_approval' | 'rescheduled';
  meet_url: string | null;
  alternative_location: string | null;
  meeting_type:
    | {
        name: string;
        slug: string;
        host:
          | { slug: string; user: { full_name: string | null } | { full_name: string | null }[] | null }
          | null;
      }
    | {
        name: string;
        slug: string;
        host:
          | { slug: string; user: { full_name: string | null } | { full_name: string | null }[] | null }
          | null;
      }[]
    | null;
};

type MeetData = {
  profile: MeetProfileRow | null;
  upcoming_bookings: Booking[];
  past_bookings: Booking[];
};

function getMt(b: Booking) {
  if (!b.meeting_type) return null;
  return Array.isArray(b.meeting_type) ? b.meeting_type[0] : b.meeting_type;
}
function getHostName(b: Booking): string | null {
  const mt = getMt(b);
  if (!mt?.host) return null;
  const u = Array.isArray(mt.host.user) ? mt.host.user[0] : mt.host.user;
  return u?.full_name ?? mt.host.slug ?? null;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export async function MeetTab({ personId }: { personId: string }) {
  let data: MeetData = { profile: null, upcoming_bookings: [], past_bookings: [] };
  try {
    data = await apiFetch<MeetData>(`/api/v1/persons/${personId}/meet`);
  } catch {
    // Non-fatal — page renders empty state.
  }

  const { profile, upcoming_bookings, past_bookings } = data;
  const total = upcoming_bookings.length + past_bookings.length;

  return (
    <>
      <div className="text-xs text-ink-subtle">
        What <span className="text-ink font-medium">Meet</span> knows
        about this person: meetings booked + the host&apos;s private notes.
        Identity (name, email) is owned by the platform.
      </div>

      {/* Meet profile (host notes, VIP/blocked, preferred tz) */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <SectionLabel>Meet profile</SectionLabel>
          <MeetProfileEdit personId={personId} initial={profile} />
        </div>
        <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <Label>Status</Label>
          <Value>
            <div className="flex flex-wrap gap-1.5">
              {profile?.vip && <Chip tone="emerald">VIP</Chip>}
              {profile?.blocked && <Chip tone="red">Blocked</Chip>}
              {!profile?.vip && !profile?.blocked && (
                <span className="text-ink-muted">—</span>
              )}
            </div>
          </Value>
          <Label>Preferred timezone</Label>
          <Value>{profile?.invitee_timezone ?? <Muted>—</Muted>}</Value>
          <Label>Host notes</Label>
          <Value>
            {profile?.host_notes ? (
              <p className="whitespace-pre-wrap">{profile.host_notes}</p>
            ) : (
              <Muted>None.</Muted>
            )}
          </Value>
          <Label>Total meetings</Label>
          <Value>{total === 0 ? <Muted>—</Muted> : total}</Value>
        </div>
      </section>

      {/* Upcoming */}
      <section className="mt-14">
        <SectionLabel>Upcoming meetings</SectionLabel>
        {upcoming_bookings.length === 0 ? (
          <div className="mt-4">
            <EmptyState>No upcoming meetings with this person.</EmptyState>
          </div>
        ) : (
          <ul className="mt-4 rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
            {upcoming_bookings.map((b) => (
              <BookingRow key={b.id} b={b} />
            ))}
          </ul>
        )}
      </section>

      {/* Past */}
      <section className="mt-14">
        <SectionLabel>Past meetings</SectionLabel>
        {past_bookings.length === 0 ? (
          <div className="mt-4">
            <EmptyState>No past meetings with this person.</EmptyState>
          </div>
        ) : (
          <ul className="mt-4 rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
            {past_bookings.map((b) => (
              <BookingRow key={b.id} b={b} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function BookingRow({ b }: { b: Booking }) {
  const mt = getMt(b);
  const hostName = getHostName(b);
  const cancelled = b.status === 'cancelled';
  const pending = b.status === 'pending_approval';
  return (
    <li className="px-5 py-4 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-medium">
            {mt?.name ?? 'Meeting'}
            {hostName && (
              <span className="text-ink-subtle font-normal"> · with {hostName}</span>
            )}
          </div>
          <div className="mt-1 text-xs text-ink-muted">{fmtDate(b.starts_at)}</div>
          {b.alternative_location && (
            <div className="mt-1 text-xs text-ink-muted">{b.alternative_location}</div>
          )}
        </div>
        <div className="shrink-0">
          <span
            className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border ${
              cancelled
                ? 'bg-red-50 text-red-700 border-red-200'
                : pending
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-ink text-surface-raised border-ink'
            }`}
          >
            {cancelled ? 'Cancelled' : pending ? 'Pending' : 'Confirmed'}
          </span>
        </div>
      </div>
    </li>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-ink-muted text-xs uppercase tracking-wider pt-0.5">
      {children}
    </div>
  );
}
function Value({ children }: { children: React.ReactNode }) {
  return <div className="text-ink-strong">{children}</div>;
}
function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-ink-muted">{children}</span>;
}
function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'emerald' | 'red';
}) {
  const cls =
    tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-red-50 text-red-700 border-red-200';
  return (
    <span
      className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border ${cls}`}
    >
      {children}
    </span>
  );
}
