// Joining a meeting from a list: which service it is, and whether the link is
// worth offering yet.
//
// Sjoerd, 2026-10-09: *"It would be nice to have the link (for zoom/teams/meet)
// in the overview for easy access."* The link already existed — inside the
// booking's details dialog, two taps away. On a phone, between meetings, two
// taps and a dialog is the difference between joining and fumbling.
//
// Both rules live here, as pure functions, because a screen that OFFERS a join
// link and a screen that decides whether joining is possible must agree. That
// is the same lesson as the publish switch (a settings page offered to open a
// page the server had just been told to hide) and the team apps gate.

/** The services we can name from a URL. `null` means a link we cannot place —
 *  a self-hosted room, a dial-in page, somebody's personal Whereby. */
export type MeetingProvider = 'zoom' | 'teams' | 'google' | null;

/**
 * Which service this meeting URL belongs to.
 *
 * Read from the HOST, never from the whole string: a meeting title or a query
 * parameter containing the word "zoom" must not rename somebody's Teams call,
 * and a substring match on the raw URL would do exactly that.
 */
export function meetingProvider(url: string | null | undefined): MeetingProvider {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null; // not a URL at all; the caller still shows a plain link
  }
  // endsWith on a dot-prefixed suffix, so `zoom.us` and `acme.zoom.us` match
  // while `notzoom.us` and `zoom.us.evil.com` do not.
  const is = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (is('zoom.us')) return 'zoom';
  if (is('teams.microsoft.com') || is('teams.live.com')) return 'teams';
  if (is('meet.google.com')) return 'google';
  return null;
}

/**
 * Is this booking one you could join right now?
 *
 * `now` is an ARGUMENT, not `new Date()` inside. A rule that reads the wall
 * clock is a rule that passes in UTC CI and fails at 01:00 in Amsterdam, which
 * this repo has already paid for once.
 *
 * Three noes, and each is a different kind of wrong link to offer:
 *  - no URL: nothing to join.
 *  - cancelled, or still awaiting the host's approval: the meeting is not
 *    happening, and the room may not exist. Offering it invites somebody to
 *    sit alone in an empty call.
 *  - already over: a finished meeting's link is a dead end, and on a list that
 *    shows past bookings it would be the most prominent thing on the row.
 *
 * Deliberately NOT gated on "has it started". People join early, hosts open
 * the room before the hour, and a button that refuses until the exact minute
 * is a button that is wrong whenever somebody is being punctual.
 */
export function canJoinMeeting(
  booking: { meet_url?: string | null; status?: string | null; ends_at?: string | null },
  now: Date,
): boolean {
  if (!booking.meet_url) return false;
  if (booking.status === 'cancelled' || booking.status === 'pending_approval') return false;
  if (booking.ends_at) {
    const ends = new Date(booking.ends_at);
    // An unparseable date is not a reason to hide a link somebody may need.
    if (!Number.isNaN(ends.getTime()) && ends.getTime() <= now.getTime()) return false;
  }
  return true;
}
