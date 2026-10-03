// Microsoft Teams: user-managed OAuth (Entra ID) + the Graph calls Meet and
// Thread need to put a real Teams meeting in a person's OWN account.
//
// Shaped after lib/zoom/client.ts, which is the template, with the places
// Microsoft differs written down here rather than discovered later. Checked
// against Microsoft's own documentation on 2026-10-03:
//
//   - MULTI-TENANT app registration, so the endpoints use the `organizations`
//     tenant segment: any work or school account, no personal Microsoft
//     accounts. That is not a choice we could widen: creating an online
//     meeting through /me is documented as "Delegated (personal Microsoft
//     account): Not supported."
//     https://learn.microsoft.com/en-us/graph/api/application-post-onlinemeetings
//   - Authorization code flow, client secret in the POST BODY (Microsoft also
//     accepts HTTP Basic; Zoom requires it. We use the body).
//     https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
//   - Microsoft returns a NEW refresh token on every refresh ("Replace the old
//     refresh token with this newly acquired refresh token") — only when
//     `offline_access` was requested. So, exactly as for Zoom, whoever calls
//     refreshAccessToken MUST persist the returned token: lib/teams/host.ts is
//     the only sanctioned caller.
//   - `scope` is optional on the token legs, but we always send it: it names
//     the resource (Graph) the token is wanted for, and a refresh with a scope
//     list equal to the consented one is explicitly allowed.
//
// SCOPES. offline_access (refresh token), User.Read (/me, to learn who
// connected), OnlineMeetings.ReadWrite (create/update/delete the meeting).
// All three are user-consentable: no tenant admin has to approve, which is the
// reason this is the delegated flow and not an application permission (which
// would need a per-tenant application access policy set up by each customer).

import { publicApiUrl } from '../public-url.js';

export const TEAMS_SCOPES = 'offline_access OnlineMeetings.ReadWrite User.Read';

const AUTHORITY = 'https://login.microsoftonline.com/organizations/oauth2/v2.0';
const GRAPH = 'https://graph.microsoft.com/v1.0';

export interface TeamsTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

/** A failure from the token endpoint, carrying Microsoft's `error` code so the
 *  caller decides on the code and not on a regex over prose. */
export class TeamsTokenError extends Error {
  constructor(
    public readonly code: string,
    what: string,
    status: number,
    body: string,
  ) {
    super(`Teams ${what} failed: ${status} ${code} ${body}`);
    this.name = 'TeamsTokenError';
  }
}

export function teamsRedirectUri(): string {
  return `${publicApiUrl()}/api/v1/meet/teams/auth-callback`;
}

export function isTeamsConfigured(): boolean {
  return !!(process.env.TEAMS_CLIENT_ID && process.env.TEAMS_CLIENT_SECRET);
}

function creds(): { id: string; secret: string } {
  const id = process.env.TEAMS_CLIENT_ID;
  const secret = process.env.TEAMS_CLIENT_SECRET;
  if (!id || !secret) throw new Error('TEAMS_CLIENT_ID / TEAMS_CLIENT_SECRET not configured');
  return { id, secret };
}

export function teamsAuthorizeUrl(state: string): string {
  const { id } = creds();
  const params = new URLSearchParams({
    client_id: id,
    response_type: 'code',
    redirect_uri: teamsRedirectUri(),
    response_mode: 'query',
    scope: TEAMS_SCOPES,
    // A person with a personal and a work Microsoft login in the same browser
    // must be able to pick the work one; without this Microsoft signs in
    // whichever session it finds, and a personal one cannot create meetings.
    prompt: 'select_account',
    state,
  });
  return `${AUTHORITY}/authorize?${params.toString()}`;
}

async function tokenCall(extra: Record<string, string>, what: string): Promise<TeamsTokens> {
  const { id, secret } = creds();
  const res = await fetch(`${AUTHORITY}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      scope: TEAMS_SCOPES,
      ...extra,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    let code = 'unknown';
    try {
      const j = JSON.parse(text) as { error?: unknown };
      if (typeof j.error === 'string') code = j.error;
    } catch {
      /* not JSON — keep 'unknown'; the body is in the message */
    }
    throw new TeamsTokenError(code, what, res.status, text);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  // No refresh token means offline_access was not granted. A connection that
  // cannot be refreshed would die in an hour, silently — refuse it up front.
  if (!json.refresh_token) {
    throw new Error('Teams token response carried no refresh_token (offline_access not granted)');
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresInSeconds: json.expires_in,
  };
}

export function exchangeCodeForTokens(code: string): Promise<TeamsTokens> {
  return tokenCall(
    { grant_type: 'authorization_code', code, redirect_uri: teamsRedirectUri() },
    'token exchange',
  );
}

export function refreshAccessToken(refreshToken: string): Promise<TeamsTokens> {
  return tokenCall({ grant_type: 'refresh_token', refresh_token: refreshToken }, 'token refresh');
}

/** Who connected. `id` is Graph's object id for the user; `email` is `mail`,
 *  falling back to the UPN (which is what accounts without a mailbox have). */
export async function fetchTeamsUser(
  accessToken: string,
): Promise<{ id: string; email: string | null; displayName: string | null }> {
  const res = await fetch(`${GRAPH}/me?$select=id,mail,userPrincipalName,displayName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Teams user fetch failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as {
    id: string;
    mail?: string | null;
    userPrincipalName?: string | null;
    displayName?: string | null;
  };
  return {
    id: json.id,
    email: json.mail || json.userPrincipalName || null,
    displayName: json.displayName ?? null,
  };
}

/**
 * An instant as Graph wants it: UTC, `Z`, no milliseconds.
 *
 * Microsoft documents startDateTime/endDateTime as DateTime values "in UTC"
 * and its own examples send ISO 8601 with an offset. Unlike Zoom there is no
 * companion `timezone` field here at all, so there is nothing to disagree
 * with. That is the whole point of sending `Z`: the Zoom client was two hours
 * wrong for months (zoom/client.ts, zoomLocalStart) by mixing a UTC string
 * with a timezone name. The only way to repeat that here is to send local
 * wall-clock digits without an offset, so this function never does; the exact
 * output is pinned in teams.test.ts.
 */
export function teamsInstant(d: Date | string): string {
  const t = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(t.getTime())) throw new Error(`Teams: invalid date ${String(d)}`);
  return t.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export interface CreateTeamsMeetingArgs {
  topic: string;
  startsAt: Date | string;
  endsAt: Date | string;
}

export interface CreatedTeamsMeeting {
  meetingId: string;
  joinUrl: string;
}

export async function createTeamsMeeting(
  accessToken: string,
  args: CreateTeamsMeetingArgs,
): Promise<CreatedTeamsMeeting> {
  const res = await fetch(`${GRAPH}/me/onlineMeetings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDateTime: teamsInstant(args.startsAt),
      endDateTime: teamsInstant(args.endsAt),
      subject: args.topic,
    }),
  });
  if (!res.ok) throw new Error(`Teams meeting creation failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { id?: string; joinWebUrl?: string };
  // Never hand back a meeting nobody can join.
  if (!json.id || !json.joinWebUrl) {
    throw new Error('Teams meeting creation returned no id / joinWebUrl');
  }
  return { meetingId: json.id, joinUrl: json.joinWebUrl };
}

// UPDATE and DELETE are both documented as supported for the delegated
// (work or school) case with the same OnlineMeetings.ReadWrite scope, so both
// exist here (checked 2026-10-03):
//   PATCH  /me/onlineMeetings/{id}  — 200 OK + the updated meeting.
//          https://learn.microsoft.com/en-us/graph/api/onlinemeeting-update
//          Start/end are updatable ("startDateTime", "endDateTime", "subject"
//          are all in the property table) with ONE rule that is easy to miss:
//          "Adjusting the start or end date/time of an online meeting always
//          requires both startDateTime and endDateTime in the request body."
//          So a move sends both, never one.
//   DELETE /me/onlineMeetings/{id}  — 204 No Content.
//          https://learn.microsoft.com/en-us/graph/api/onlinemeeting-delete
//
// NOT documented, deliberately not implemented: anything about attendees /
// invitations (a Graph onlineMeeting is a join link, not a calendar event, so
// nobody is invited by it — the callers already email the link), and reading
// a meeting back by join URL. If a later need arises, read the page first.

export async function updateTeamsMeeting(
  accessToken: string,
  meetingId: string,
  args: { startsAt: Date | string; endsAt: Date | string; topic?: string },
): Promise<void> {
  const res = await fetch(`${GRAPH}/me/onlineMeetings/${encodeURIComponent(meetingId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDateTime: teamsInstant(args.startsAt),
      endDateTime: teamsInstant(args.endsAt),
      ...(args.topic ? { subject: args.topic } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Teams meeting update failed: ${res.status} ${await res.text()}`);
}

export async function deleteTeamsMeeting(accessToken: string, meetingId: string): Promise<void> {
  const res = await fetch(`${GRAPH}/me/onlineMeetings/${encodeURIComponent(meetingId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // 404 = already gone, which is what the caller wanted.
  if (!res.ok && res.status !== 404) {
    throw new Error(`Teams meeting delete failed: ${res.status} ${await res.text()}`);
  }
}
