// Zoom user-managed OAuth + the two meeting calls Meet needs.
//
// Ported from Soul Suite (src/lib/zoom/client.ts) — the shape held up in
// production for a year, so this is a faithful port with Fibre's env
// conventions: credentials from process.env, redirect URI derived from
// PUBLIC_API_URL the same way googleRedirectUri() does it.
//
// Access tokens live ~1h. Zoom ROTATES the refresh token on every exchange,
// so whoever calls refreshAccessToken MUST persist the returned refresh
// token — see lib/zoom/host.ts, which is the only sanctioned caller.
//
// Granular scopes the Marketplace app must request:
//   meeting:write:meeting, meeting:update:meeting, meeting:delete:meeting,
//   user:read:user

import { utcToZonedParts } from '../availability/timezone.js';
import { publicApiUrl } from '../public-url.js';

export interface ZoomTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export function zoomRedirectUri(): string {
  return `${publicApiUrl()}/api/v1/meet/zoom/auth-callback`;
}

export function isZoomConfigured(): boolean {
  return !!(process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
}

function creds(): { id: string; secret: string } {
  const id = process.env.ZOOM_CLIENT_ID;
  const secret = process.env.ZOOM_CLIENT_SECRET;
  if (!id || !secret) throw new Error('ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET not configured');
  return { id, secret };
}

function basicAuthHeader(): string {
  const { id, secret } = creds();
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
}

export function zoomAuthorizeUrl(state: string): string {
  const { id } = creds();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: id,
    redirect_uri: zoomRedirectUri(),
    state,
  });
  return `https://zoom.us/oauth/authorize?${params.toString()}`;
}

async function tokenCall(body: URLSearchParams, what: string): Promise<ZoomTokens> {
  const res = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) throw new Error(`Zoom ${what} failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresInSeconds: json.expires_in,
  };
}

export function exchangeCodeForTokens(code: string): Promise<ZoomTokens> {
  return tokenCall(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: zoomRedirectUri(),
    }),
    'token exchange',
  );
}

export function refreshAccessToken(refreshToken: string): Promise<ZoomTokens> {
  return tokenCall(
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    'token refresh',
  );
}

export async function fetchZoomUser(
  accessToken: string,
): Promise<{ id: string; email: string }> {
  const res = await fetch('https://api.zoom.us/v2/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Zoom user fetch failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { id: string; email: string };
  return { id: json.id, email: json.email };
}

export interface CreateZoomMeetingArgs {
  topic: string;
  startsAtIso: string;
  durationMinutes: number;
  timezone: string;
  agenda?: string | null;
  /** Co-hosts in the SAME Zoom account. Cross-org emails make Zoom reject the
   *  whole create call, so callers retry without them — see the typed error. */
  alternativeHosts?: string[];
}

export interface CreatedZoomMeeting {
  meetingId: string;
  joinUrl: string;
  passcode: string | null;
}

export class ZoomAlternativeHostsError extends Error {
  constructor(public readonly underlying: string) {
    super(`Zoom rejected alternative_hosts: ${underlying}`);
    this.name = 'ZoomAlternativeHostsError';
  }
}

/**
 * The start time as Zoom actually wants it, given that we also send a
 * `timezone`.
 *
 * Zoom accepts two forms, and the pairing matters:
 *   "2026-10-12T11:30:00Z"   — GMT. `timezone` is then ignored.
 *   "2026-10-12T13:30:00"    — LOCAL wall clock, read in `timezone`.
 *
 * We sent `startsAt.toISOString()` — "2026-10-12T11:30:00.000Z", the GMT form
 * complete with milliseconds — AND a `timezone` of Europe/Amsterdam. Zoom read
 * the 11:30 as Amsterdam wall clock, so every meeting it created or moved was
 * off by the zone's offset. Found on 2026-10-01 by Sjoerd looking at the Zoom
 * detail page after a staging reschedule: our row, Google Calendar and the
 * emails all said 13:30 Amsterdam, and Zoom alone said 11:30.
 *
 * Pre-existing and never seen, because Zoom was inert until the Marketplace
 * app existed — the create was wrong from the first line of this file and
 * nothing had ever read a real Zoom meeting back.
 *
 * The fix is to stop sending the ambiguous combination rather than to guess
 * which half Zoom will honour. We send the LOCAL form with no zone suffix and
 * no milliseconds, which is the documented partner of `timezone` and leaves
 * nothing to interpret.
 */
export function zoomLocalStart(startsAtIso: string, timeZone: string): string {
  const p = utcToZonedParts(Date.parse(startsAtIso), timeZone);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}:00`;
}

export async function createZoomMeeting(
  accessToken: string,
  args: CreateZoomMeetingArgs,
): Promise<CreatedZoomMeeting> {
  const altHosts =
    args.alternativeHosts && args.alternativeHosts.length > 0
      ? args.alternativeHosts.join(';')
      : undefined;
  const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: args.topic,
      type: 2, // scheduled
      start_time: zoomLocalStart(args.startsAtIso, args.timezone),
      duration: args.durationMinutes,
      timezone: args.timezone,
      agenda: args.agenda ?? undefined,
      settings: {
        join_before_host: true,
        waiting_room: false,
        ...(altHosts ? { alternative_hosts: altHosts } : {}),
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    // 400 + "not exist in this account" — a listed co-host is cross-org.
    if (altHosts && res.status === 400 && /alternative|not exist|not belong|account/i.test(text)) {
      throw new ZoomAlternativeHostsError(text);
    }
    throw new Error(`Zoom meeting creation failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { id: number; join_url: string; password?: string };
  return {
    meetingId: String(json.id),
    joinUrl: json.join_url,
    passcode: json.password ?? null,
  };
}

export async function updateZoomMeeting(
  accessToken: string,
  meetingId: string,
  args: { startsAtIso: string; durationMinutes: number; timezone: string },
): Promise<void> {
  const res = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      start_time: zoomLocalStart(args.startsAtIso, args.timezone),
      duration: args.durationMinutes,
      timezone: args.timezone,
    }),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Zoom meeting update failed: ${res.status} ${await res.text()}`);
  }
}

export async function deleteZoomMeeting(accessToken: string, meetingId: string): Promise<void> {
  const res = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Zoom meeting delete failed: ${res.status} ${await res.text()}`);
  }
}
