import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import { CancelForm } from './form';
import { formatWhenInZone } from '@thefibre/shared';
import { publicT, toLocale, INTL_LOCALES } from '@/lib/i18n-public';
import { When } from '@/components/when';

type Booking = {
  locale?: string | null;
  id: string;
  invitee_email: string;
  invitee_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  meeting_type: {
    name: string;
    duration_minutes: number;
    host: {
      slug: string;
      timezone?: string | null;
      user: { full_name: string | null } | { full_name: string | null }[] | null;
    } | null;
  } | null;
};

export default async function CancelPage({
  params,
}: {
  params: Promise<{ hostSlug: string; mtSlug: string; bookingId: string }>;
}) {
  const { hostSlug, bookingId } = await params;
  let booking: Booking;
  try {
    booking = await publicFetch<Booking>(
      `/api/v1/meet/public/bookings/${encodeURIComponent(bookingId)}`,
    );
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    throw e;
  }

  const mt = booking.meeting_type;
  const hostUser = mt?.host
    ? Array.isArray(mt.host.user)
      ? mt.host.user[0]
      : mt.host.user
    : null;
  const hostName = hostUser?.full_name ?? mt?.host?.slug ?? null;
  const starts = new Date(booking.starts_at);
  const alreadyCancelled = booking.status === 'cancelled';
  const L = toLocale(booking.locale);
  const hostZone = mt?.host?.timezone ?? 'UTC';
  const whenInHostZone = formatWhenInZone(starts, hostZone, INTL_LOCALES[L]);

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-xl px-6 py-20">
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
          {alreadyCancelled
            ? publicT(L, 'booking_cancelled_eyebrow')
            : publicT(L, 'cancel_booking_eyebrow')}
        </div>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">
          {alreadyCancelled
            ? publicT(L, 'already_cancelled')
            : publicT(L, 'cancel_this_booking')}
        </h1>

        <dl className="mt-10 space-y-5 text-sm">
          <Row label={publicT(L, 'row_what')} value={mt?.name ?? '—'} />
          {/* THE BUG, 2026-10-01: this read `starts.toLocaleString(locale, …)`
              with no `timeZone`, which on a server means the SERVER's zone —
              UTC. The page that exists to make somebody certain before they
              cancel was showing a time two hours out, unlabelled, while the
              booking page, the emails, Google and Zoom all said the real one.
              Exactly the fault the confirmation page had a week earlier, in
              the one renderer that never got the fix. Now the same pair as
              there: the host's zone on the server, the reader's own once the
              browser has one, and the zone NAMED either way. */}
          <Row
            label={publicT(L, 'row_when')}
            value={<When iso={booking.starts_at} fallback={whenInHostZone} />}
          />
          {hostName && <Row label={publicT(L, 'row_with')} value={hostName} />}
        </dl>

        {!alreadyCancelled && (
          <div className="mt-10">
            <CancelForm bookingId={bookingId} hostSlug={hostSlug} L={L} />
          </div>
        )}

        <div className="mt-10">
          <Link
            href={`/${hostSlug}`}
            className="text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-4"
          >
            {publicT(L, 'back_to_booking_page', {
              name: hostName ?? publicT(L, 'the_booking_page'),
            })}
          </Link>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-4">
      <dt className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1">
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}
