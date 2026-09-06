import { apiFetch } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
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

function fmtDate(iso: string, locale: Locale) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export async function MeetTab({ personId, locale }: { personId: string; locale: Locale }) {
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
      <div className="text-xs text-ink-subtle">{t(locale, 'meet_tab_blurb')}</div>

      {/* Meet profile (host notes, VIP/blocked, preferred tz) */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <SectionLabel>{t(locale, 'meet_profile')}</SectionLabel>
          <MeetProfileEdit personId={personId} initial={profile} locale={locale} />
        </div>
        <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <Label>{t(locale, 'status')}</Label>
          <Value>
            <div className="flex flex-wrap gap-1.5">
              {profile?.vip && <Chip tone="emerald">VIP</Chip>}
              {profile?.blocked && <Chip tone="red">{t(locale, 'blocked')}</Chip>}
              {!profile?.vip && !profile?.blocked && (
                <span className="text-ink-muted">—</span>
              )}
            </div>
          </Value>
          <Label>{t(locale, 'preferred_timezone')}</Label>
          <Value>{profile?.invitee_timezone ?? <Muted>—</Muted>}</Value>
          <Label>{t(locale, 'host_notes')}</Label>
          <Value>
            {profile?.host_notes ? (
              <p className="whitespace-pre-wrap">{profile.host_notes}</p>
            ) : (
              <Muted>{t(locale, 'none')}</Muted>
            )}
          </Value>
          <Label>{t(locale, 'total_meetings')}</Label>
          <Value>{total === 0 ? <Muted>—</Muted> : total}</Value>
        </div>
      </section>

      {/* Upcoming */}
      <section className="mt-14">
        <SectionLabel>{t(locale, 'upcoming_meetings')}</SectionLabel>
        {upcoming_bookings.length === 0 ? (
          <div className="mt-4">
            <EmptyState>{t(locale, 'no_upcoming_meetings')}</EmptyState>
          </div>
        ) : (
          <ul className="mt-4 rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
            {upcoming_bookings.map((b) => (
              <BookingRow key={b.id} b={b} locale={locale} />
            ))}
          </ul>
        )}
      </section>

      {/* Past */}
      <section className="mt-14">
        <SectionLabel>{t(locale, 'past_meetings')}</SectionLabel>
        {past_bookings.length === 0 ? (
          <div className="mt-4">
            <EmptyState>{t(locale, 'no_past_meetings')}</EmptyState>
          </div>
        ) : (
          <ul className="mt-4 rounded-lg border border-line bg-surface-raised divide-y divide-line overflow-hidden">
            {past_bookings.map((b) => (
              <BookingRow key={b.id} b={b} locale={locale} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function BookingRow({ b, locale }: { b: Booking; locale: Locale }) {
  const mt = getMt(b);
  const hostName = getHostName(b);
  const cancelled = b.status === 'cancelled';
  const pending = b.status === 'pending_approval';
  return (
    <li className="px-5 py-4 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-medium">
            {mt?.name ?? t(locale, 'meeting')}
            {hostName && (
              <span className="text-ink-subtle font-normal"> · {t(locale, 'with')} {hostName}</span>
            )}
          </div>
          <div className="mt-1 text-xs text-ink-muted">{fmtDate(b.starts_at, locale)}</div>
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
            {cancelled
              ? t(locale, 'cancelled')
              : pending
                ? t(locale, 'pending')
                : t(locale, 'confirmed')}
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
