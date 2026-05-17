'use client';

import Link from 'next/link';
import { CalendarClock, User, Video, MapPin, ExternalLink } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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

function fmt(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
function fmtTime(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function BookingDetailsDialog({
  booking,
  open,
  onClose,
}: {
  booking: BookingForDialog | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!booking) return null;
  const mt = getMt(booking);
  const team = getTeam(booking);
  const starts = new Date(booking.starts_at);
  const ends = new Date(booking.ends_at);
  const minutes = Math.round((ends.getTime() - starts.getTime()) / 60_000);
  const cancelled = booking.status === 'cancelled';
  const hostSlugForCancel = (team?.slug ?? mt?.slug)
    ? // The cancel route lives at /[hostSlug-or-teamSlug]/[mtSlug]/cancel/[bookingId].
      // We don't know the host slug from the booking projection, so we route
      // through the meeting-type slug only when the team is known.
      team?.slug ?? null
    : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>{booking.invitee_name}</span>
          <span
            className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 ${
              cancelled
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-ink text-surface-raised'
            }`}
          >
            {cancelled ? 'Cancelled' : 'Confirmed'}
          </span>
        </div>
      }
      description={booking.invitee_email}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {booking.meet_url && !cancelled && (
            <a
              href={booking.meet_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-ink-strong text-white px-3 py-1.5 text-sm font-medium hover:bg-ink"
            >
              Join meeting <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <Row Icon={CalendarClock} label="When">
          {fmt(starts)} — {fmtTime(ends)} ({minutes} min)
        </Row>
        <Row Icon={User} label="What">
          {mt?.name ?? '—'}
          {team && (
            <span className="text-ink-muted"> · Team {team.name}</span>
          )}
        </Row>
        {booking.meet_url && (
          <Row Icon={Video} label="Where">
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
          <Row Icon={MapPin} label="Location">
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
              Cancel this booking
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
