'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, User, Video, MapPin, ExternalLink, Check, X } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { approveBooking, rejectBooking } from './booking-actions';

// Minimum shape every caller (Dashboard, Bookings list, Contact popup)
// can satisfy. Each surface fetches a slightly different projection,
// but they all carry these basics.
export type BookingForDialog = {
  id: string;
  invitee_email: string;
  invitee_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  meet_url?: string | null;
  alternative_location?: string | null;
  meeting_type:
    | {
        name: string;
        slug?: string;
        team?:
          | { name: string; slug: string }
          | { name: string; slug: string }[]
          | null;
      }
    | {
        name: string;
        slug?: string;
        team?:
          | { name: string; slug: string }
          | { name: string; slug: string }[]
          | null;
      }[]
    | null;
};

function getMt(b: BookingForDialog) {
  if (!b.meeting_type) return null;
  return Array.isArray(b.meeting_type) ? b.meeting_type[0] : b.meeting_type;
}
function getTeam(b: BookingForDialog) {
  const mt = getMt(b);
  if (!mt?.team) return null;
  return Array.isArray(mt.team) ? mt.team[0] : mt.team;
}

function fmt(d: Date, locale: Locale) {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
function fmtTime(d: Date, locale: Locale) {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function BookingDetailsDialog({
  booking,
  open,
  onClose,
  locale,
}: {
  booking: BookingForDialog | null;
  open: boolean;
  onClose: () => void;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (!booking) return null;
  const mt = getMt(booking);
  const team = getTeam(booking);
  const starts = new Date(booking.starts_at);
  const ends = new Date(booking.ends_at);
  const minutes = Math.round((ends.getTime() - starts.getTime()) / 60_000);
  const cancelled = booking.status === 'cancelled';
  const pendingApproval = booking.status === 'pending_approval';
  const hostSlugForCancel = (team?.slug ?? mt?.slug)
    ? // The cancel route lives at /[hostSlug-or-teamSlug]/[mtSlug]/cancel/[bookingId].
      // We don't know the host slug from the booking projection, so we route
      // through the meeting-type slug only when the team is known.
      team?.slug ?? null
    : null;

  function handleApprove() {
    setErr(null);
    startTransition(async () => {
      const r = await approveBooking(booking!.id);
      if (r.error) setErr(r.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }
  function handleReject() {
    if (!confirm(t(locale, 'reject_confirm'))) return;
    setErr(null);
    startTransition(async () => {
      const r = await rejectBooking(booking!.id);
      if (r.error) setErr(r.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  const statusLabel = pendingApproval
    ? t(locale, 'status_pending_approval')
    : cancelled
      ? t(locale, 'status_cancelled')
      : t(locale, 'status_confirmed');
  const statusClass = pendingApproval
    ? 'bg-amber-50 text-amber-800 border border-amber-200'
    : cancelled
      ? 'bg-red-50 text-red-700 border border-red-200'
      : 'bg-ink text-surface-raised';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>{booking.invitee_name}</span>
          <span className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 ${statusClass}`}>
            {statusLabel}
          </span>
        </div>
      }
      description={booking.invitee_email}
      size="md"
      footer={
        <>
          {err && <span className="text-xs text-red-700 mr-auto">{err}</span>}
          <Button variant="ghost" onClick={onClose}>{t(locale, 'close')}</Button>
          {pendingApproval && (
            <>
              <button
                type="button"
                onClick={handleReject}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-sunken disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> {t(locale, 'reject')}
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 text-white px-3 py-1.5 text-sm font-medium hover:bg-emerald-800 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> {pending ? t(locale, 'approving') : t(locale, 'approve')}
              </button>
            </>
          )}
          {booking.meet_url && !cancelled && !pendingApproval && (
            <a
              href={booking.meet_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-ink-strong text-white px-3 py-1.5 text-sm font-medium hover:bg-ink"
            >
              {t(locale, 'join_meeting')} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <Row Icon={CalendarClock} label={t(locale, 'when')}>
          {fmt(starts, locale)} — {fmtTime(ends, locale)} ({minutes} min)
        </Row>
        <Row Icon={User} label={t(locale, 'what')}>
          {mt?.name ?? '—'}
          {team && (
            <span className="text-ink-muted"> · {t(locale, 'team_dot', { name: team.name })}</span>
          )}
        </Row>
        {booking.meet_url && (
          <Row Icon={Video} label={t(locale, 'where')}>
            <a
              href={booking.meet_url}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-ink"
            >
              {booking.meet_url}
            </a>
          </Row>
        )}
        {booking.alternative_location && (
          <Row Icon={MapPin} label={t(locale, 'location')}>
            {booking.alternative_location}
          </Row>
        )}

        {hostSlugForCancel && !cancelled && mt && (
          <div className="pt-2 border-t border-line">
            <Link
              href={`/${hostSlugForCancel}/${mt.slug}/cancel/${booking.id}`}
              className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2"
              target="_blank"
            >
              {t(locale, 'cancel_booking')}
            </Link>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function Row({
  Icon,
  label,
  children,
}: {
  Icon: typeof CalendarClock;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[24px_1fr] gap-3 items-start">
      <Icon className="h-4 w-4 text-ink-muted mt-0.5" strokeWidth={1.5} />
      <div>
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">
          {label}
        </div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}
