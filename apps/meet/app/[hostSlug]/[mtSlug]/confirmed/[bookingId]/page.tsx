import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import { ManageLinkRequest } from '../../manage-link-request';
import { formatWhenInZone } from '@thefibre/shared';
import { publicT, toLocale, INTL_LOCALES } from '@/lib/i18n-public';
import { When } from '@/components/when';

type Confirmation = {
  locale?: string | null;
  id: string;
  invitee_email?: string;
  /** Whether this page holds the booking's manage token (`?t=`). */
  can_manage?: boolean;
  invitee_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  conferencing_provider: string | null;
  alternative_location: string | null;
  payment_status: string | null;
  stripe_invoice_url: string | null;
  meeting_type: {
    name: string;
    duration_minutes: number;
    host: {
      slug: string;
      timezone: string | null;
      user: { full_name: string | null } | { full_name: string | null }[] | null;
    } | null;
  } | null;
};

export default async function ConfirmedPage({
  params,
  searchParams,
}: {
  params: Promise<{ hostSlug: string; mtSlug: string; bookingId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { hostSlug, mtSlug, bookingId } = await params;
  // The manage token from the guest's own email or booking (security fix,
  // 2026-10-16). Without it the page shows the booking, no addresses, and
  // offers a fresh link instead of Cancel / Reschedule.
  const { t: token = '' } = await searchParams;
  const tq = token ? `t=${encodeURIComponent(token)}` : '';
  let booking: Confirmation;
  try {
    booking = await publicFetch<Confirmation>(
      `/api/v1/meet/public/bookings/${encodeURIComponent(bookingId)}${tq ? `?${tq}` : ''}`,
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
  // Server-side fallback: the HOST's zone, named. The browser replaces it
  // with the reader's own — see ./when.tsx for why this is not one string.
  const hostZone = mt?.host?.timezone ?? 'UTC';

  const L = toLocale(booking.locale);
  const whenInHostZone = formatWhenInZone(starts, hostZone, INTL_LOCALES[L]);
  // A request nobody answered. It had no calendar event and its time has
  // been given back, so this page must not offer to add it to a calendar or
  // claim the booking stands — it used to say "you're booked" (the else of a
  // two-way branch) for a meeting that was never going to happen.
  const expired = booking.status === 'expired';
  const firstName = booking.invitee_name.split(' ')[0] ?? '';

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-12">
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="p-8 sm:p-10">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
              {expired
                ? publicT(L, 'request_expired_eyebrow')
                : booking.status === 'pending_approval'
                  ? publicT(L, 'request_received')
                  : publicT(L, 'booking_confirmed')}
            </div>
            <h1 className="mt-3 text-3xl font-medium tracking-tight">
              {expired
                ? publicT(L, 'request_expired_title', { first: firstName })
                : booking.status === 'pending_approval'
                  ? publicT(L, 'request_is_in', { first: firstName })
                  : publicT(L, 'youre_booked', { first: firstName })}
            </h1>
            {booking.status === 'pending_approval' && (
              <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
                {publicT(L, 'will_review', {
                  host: hostName ?? publicT(L, 'the_host'),
                })}
              </p>
            )}
            {expired && (
              <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
                {publicT(L, 'request_expired_body', {
                  host: hostName ?? publicT(L, 'the_host'),
                })}
              </p>
            )}

            <dl className="mt-8 space-y-5 text-sm">
              <Row label={publicT(L, 'row_what')} value={mt?.name ?? '—'} />
              <Row
                label={publicT(L, 'row_when')}
                value={<When iso={booking.starts_at} fallback={whenInHostZone} />}
              />
              <Row
                label={publicT(L, 'row_duration')}
                value={
                  mt
                    ? publicT(L, 'minutes_long', { n: String(mt.duration_minutes) })
                    : '—'
                }
              />
              {hostName && <Row label={publicT(L, 'row_with')} value={hostName} />}
              {booking.alternative_location && (
                <Row label={publicT(L, 'row_where')} value={booking.alternative_location} />
              )}
            </dl>

            {/* The guest's own information — their address, their receipt or
                invoice. Only for the holder of the manage token: without it
                the box would be empty, and on a paid booking would even say
                "no invoice" because the invoice link is withheld. */}
            {booking.can_manage && (
            <div className="mt-8 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 leading-relaxed">
              {booking.invitee_email && (
                <>
                  {publicT(L, 'email_on_its_way')}{' '}
                  <span className="font-medium">{booking.invitee_email}</span>.
                </>
              )}
              {booking.payment_status === 'paid' &&
                booking.stripe_invoice_url && (
                  <>
                    {' '}{publicT(L, 'vat_invoice_emailed')}{' '}
                    <a
                      href={booking.stripe_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline underline-offset-2 hover:text-neutral-900"
                    >
                      {publicT(L, 'view_invoice_pdf')}
                    </a>
                    .
                  </>
                )}
              {booking.payment_status === 'paid' &&
                !booking.stripe_invoice_url && (
                  <>
                    {' '}{publicT(L, 'receipt_emailed_no_invoice')}
                  </>
                )}
              {(booking.payment_status === 'invoice_pending' ||
                booking.payment_status === 'invoice_sent') && (
                <>
                  {' '}{publicT(L, 'chose_invoice', {
                    host: hostName ?? publicT(L, 'your_host'),
                  })}
                </>
              )}
            </div>
            )}

            {!booking.can_manage ? (
              <div className="mt-8">
                <ManageLinkRequest bookingId={bookingId} L={L} />
              </div>
            ) : (
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              {booking.status !== 'cancelled' && !expired && (
                <a
                  href={`/${hostSlug}/${mtSlug}/confirmed/${bookingId}/calendar.ics?${tq}`}
                  className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                >
                  {publicT(L, 'add_to_calendar')}
                </a>
              )}
              {/* On an expired request this is the ask-again link — the API
                  revives the same booking rather than starting a second one,
                  so the label is the only thing that changes. */}
              <Link
                href={`/${hostSlug}/${mtSlug}?reschedule=${bookingId}&${tq}`}
                className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
              >
                {expired ? publicT(L, 'pick_new_time') : publicT(L, 'reschedule')}
              </Link>
              {/* Nothing to cancel: an expired request is already over, and
                  offering it reads as though the meeting still stands. */}
              {!expired && (
                <Link
                  href={`/${hostSlug}/${mtSlug}/cancel/${bookingId}?${tq}`}
                  className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  {publicT(L, 'cancel')}
                </Link>
              )}
            </div>
            )}
          </div>

          <div className="border-t border-neutral-200 bg-neutral-50/50 px-8 sm:px-10 py-4">
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
