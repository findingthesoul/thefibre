// When a booking request stops waiting.
//
// A request awaiting the host's approval holds its slot (v1.111.0, Sjoerd's
// "hold yes"). That is only tolerable if it lets go by itself: a host who
// never answers would otherwise park somebody else's calendar indefinitely,
// and the invitee would never learn that nothing was going to happen.
//
// Sjoerd's rule, 2026-10-06 ("expire ok"): the EARLIER of 48 hours after the
// request and the meeting's own start time. Both halves matter. A request
// made three weeks out expires in two days, so the slot comes back while it
// is still useful to somebody. A request made for tomorrow morning expires
// tomorrow morning — never after its own meeting, which is the case the
// 48-hour rule alone gets wrong and which is the more common one, because
// people book soon.

export const REQUEST_EXPIRY_HOURS = 48;

/**
 * The moment a pending request becomes `expired`.
 *
 * Pure, and takes both times as arguments rather than reading the clock —
 * the clock is the caller's business, and a function that reads it cannot be
 * tested at the boundaries that matter.
 */
export function requestExpiryDeadline(createdAt: Date, startsAt: Date): Date {
  const fortyEightHours = new Date(
    createdAt.getTime() + REQUEST_EXPIRY_HOURS * 60 * 60 * 1000,
  );
  return fortyEightHours.getTime() <= startsAt.getTime() ? fortyEightHours : startsAt;
}

/** Has this request run out of time, as of `now`? */
export function requestHasExpired(createdAt: Date, startsAt: Date, now: Date): boolean {
  return now.getTime() >= requestExpiryDeadline(createdAt, startsAt).getTime();
}
