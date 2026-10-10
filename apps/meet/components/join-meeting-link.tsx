'use client';

// The Join button that sits ON a booking row.
//
// Sjoerd, 2026-10-09: *"It would be nice to have the link (for zoom/teams/meet)
// in the overview for easy access."* The link already existed inside the
// booking's details dialog — two taps and a dialog away, which on a phone
// between meetings is the difference between joining and fumbling.
//
// ---------------------------------------------------------------------------
// It lives inside a row that opens a dialog when clicked
// ---------------------------------------------------------------------------
// `ClickableBookingRow` puts an onClick on the whole row. A plain <a> nested
// in it fires BOTH: the meeting opens in a new tab AND the details dialog
// opens behind it, so the person comes back from their call to a dialog they
// never asked for. `stopPropagation` is therefore not a detail — it is the
// reason this is a component rather than three lines of JSX.
//
// ---------------------------------------------------------------------------
// Sized for a thumb
// ---------------------------------------------------------------------------
// Sjoerd uses Meet on his phone, and this button sits next to small status
// chips. `min-h-[44px]` on small screens is the usual iOS target; the row's
// own chips are decorative and can stay small, but a thing you TAP while
// walking cannot.

import { ExternalLink } from 'lucide-react';
import { meetingProvider, canJoinMeeting } from '@thefibre/shared';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';

const LABEL: Record<string, UiKey> = {
  zoom: 'join_zoom',
  teams: 'join_teams',
  google: 'join_google_meet',
};

export function JoinMeetingLink({
  booking,
  locale,
  now = new Date(),
  className = '',
}: {
  booking: { meet_url?: string | null; status?: string | null; ends_at?: string | null };
  locale: Locale;
  /** Injected so a test can pin it; a rule that reads the wall clock is one
   *  that passes in CI and fails at 01:00 here. */
  now?: Date;
  className?: string;
}) {
  if (!canJoinMeeting(booking, now)) return null;

  const provider = meetingProvider(booking.meet_url);
  // Named where we can place it, so a glance says which app will open. A link
  // we cannot place still gets a button — it just does not guess at a name.
  const label = t(locale, provider ? LABEL[provider]! : 'join_short');

  return (
    <a
      href={booking.meet_url!}
      target="_blank"
      rel="noreferrer noopener"
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      className={`inline-flex min-h-[44px] sm:min-h-0 items-center gap-1.5 rounded-md bg-ink-strong px-3 py-1.5 text-xs font-medium text-surface-raised hover:bg-ink ${className}`}
    >
      {label}
      <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
    </a>
  );
}
