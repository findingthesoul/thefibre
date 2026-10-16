// A Meet booking's MANAGE token — what a guest's links carry to cancel, move,
// or see their own booking (security fix, 2026-10-16).
//
// THE HOLE IT CLOSES. Cancel, reschedule and the booking's public read needed
// only the booking id — which is also the calendar UID (meet-<id>@thefibre.app)
// inside every invitation and every downloaded .ics. Anyone an invitation
// reached (a forward, a shared or delegated calendar) could cancel the booking
// and read both email addresses. Now those need this token, which is never in
// an .ics, a UID, or anything else that travels with the calendar entry.
//
// HOW. token = base64url(HMAC-SHA256(K, `${bookingId}:${manage_salt}`)) with
// K = HMAC-SHA256(SSO_INTERNAL_SECRET, LABEL). Nothing secret is stored: the
// salt (meet_booking.manage_salt) alone grants nothing. The token can be
// derived again for every email a booking sends, so all its links stay valid
// (a hash-at-rest design would have to mint a new token per email and kill
// the earlier links). Revoking = a new salt.
//
// ⚠ COUPLING. Rotating SSO_INTERNAL_SECRET invalidates EVERY outstanding Meet
// manage link at once (also written in docs/system-handbook.md, secrets).
// Guests recover with "Email me a link to manage this booking", which sends a
// fresh link to the address on file. The LABEL is versioned so a future key
// change can verify v1 and v2 side by side for a while instead.

import { createHmac, timingSafeEqual } from 'node:crypto';

export const MANAGE_TOKEN_LABEL = 'meet-manage-v1';

function serverSecret(): string {
  const s = process.env.SSO_INTERNAL_SECRET;
  if (s) return s;
  // Local dev and unit tests only. On Fly the secret is always set (the SSO
  // and OAuth routes refuse without it); refusing here too keeps a missing
  // secret from silently minting tokens anyone could compute.
  if (process.env.FLY_APP_NAME) throw new Error('SSO_INTERNAL_SECRET is not set');
  return 'dev-only-meet-manage-secret';
}

function key(label = MANAGE_TOKEN_LABEL): Buffer {
  return createHmac('sha256', serverSecret()).update(label).digest();
}

/** The token a booking's links carry. */
export function manageToken(bookingId: string, salt: string): string {
  return createHmac('sha256', key()).update(`${bookingId}:${salt}`).digest('base64url');
}

/** Does `token` manage this booking? Constant-time; false for anything missing. */
export function isManageToken(bookingId: string, salt: string | null | undefined, token: string | null | undefined): boolean {
  if (!salt || !token) return false;
  const want = Buffer.from(manageToken(bookingId, salt));
  const got = Buffer.from(token);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** `?t=<token>` for a link, or '' when there is no token to add. */
export function manageQuery(token: string | null | undefined, joiner: '?' | '&' = '?'): string {
  return token ? `${joiner}t=${encodeURIComponent(token)}` : '';
}
