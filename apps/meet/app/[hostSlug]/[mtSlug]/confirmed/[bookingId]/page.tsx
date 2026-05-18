import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicFetch, PublicApiError } from '@/lib/public-api';

type Confirmation = {
  id: string;
  invitee_email: string;
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
    host: { slug: string; user: { full_name: string | null } | { full_name: string | null }[] | null } | null;
  } | null;
};

export default async function ConfirmedPage({
  params,
}: {
  params: Promise<{ hostSlug: string; mtSlug: string; bookingId: string }>;
}) {
  const { hostSlug, mtSlug, bookingId } = await params;
  let booking: Confirmation;
  try {
    booking = await publicFetch<Confirmation>(
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

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-12">
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="p-8 sm:p-10">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
              {booking.status === 'pending_approval' ? 'Request received' : 'Booking confirmed'}
            </div>
            <h1 className="mt-3 text-3xl font-medium tracking-tight">
              {booking.status === 'pending_approval'
                ? `Your request is in, ${booking.invitee_name.split(' ')[0]}.`
                : `You're booked, ${booking.invitee_name.split(' ')[0]}.`}
            </h1>
            {booking.status === 'pending_approval' && (
              <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
                {hostName ?? 'The host'} will review and confirm. You&apos;ll get
                an email either way — usually within a day.
              </p>
            )}

            <dl className="mt-8 space-y-5 text-sm">
              <Row label="What" value={mt?.name ?? '—'} />
              <Row
                label="When"
                value={starts.toLocaleString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              />
              <Row
                label="Duration"
                value={mt ? `${mt.duration_minutes} minutes` : '—'}
              />
              {hostName && <Row label="With" value={hostName} />}
              {booking.alternative_location && (
                <Row label="Where" value={booking.alternative_location} />
              )}
            </dl>

            <div className="mt-8 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 leading-relaxed">
              A confirmation email is on its way to{' '}
              <span className="font-medium">{booking.invitee_email}</span>.
              {booking.payment_status === 'paid' &&
                booking.stripe_invoice_url && (
                  <>
                    {' '}A VAT invoice has been emailed too, and is also
                    available here:{' '}
                    <a
                      href={booking.stripe_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline underline-offset-2 hover:text-neutral-900"
                    >
                      View invoice (PDF) ↗
                    </a>
                    .
                  </>
                )}
              {booking.payment_status === 'paid' &&
                !booking.stripe_invoice_url && (
                  <>
                    {' '}A receipt has been emailed too. (The host's
                    Stripe account doesn&apos;t have automatic invoicing
                    enabled yet — ask them if you need a VAT invoice.)
                  </>
                )}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href={`/${hostSlug}/${mtSlug}?reschedule=${bookingId}`}
                className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
              >
                Reschedule
              </Link>
              <Link
                href={`/${hostSlug}/${mtSlug}/cancel/${bookingId}`}
                className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </Link>
            </div>
          </div>

          <div className="border-t border-neutral-200 bg-neutral-50/50 px-8 sm:px-10 py-4">
            <Link
              href={`/${hostSlug}`}
              className="text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-4"
            >
              ← Back to {hostName ?? 'the booking page'}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-4">
      <dt className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1">
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}
