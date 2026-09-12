// Google Calendar integration. Builds OAuth2 clients from stored refresh
// tokens; exposes freebusy + event creation against the host's primary
// calendar. Heavy lifting via googleapis (handles token refresh internally).

import { google, type calendar_v3 } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

function clientCreds() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured');
  }
  return { id, secret };
}

/** Where Google POSTs back after the user consents. Must match the URI
 * registered in Google Cloud Console exactly. */
export function googleRedirectUri(): string {
  const apiBase = process.env.PUBLIC_API_URL ?? 'https://thefibre-api.fly.dev';
  return `${apiBase}/api/v1/meet/google/auth-callback`;
}

/** Build the consent URL the user is redirected to. `state` carries the
 * signed user identifier so the callback can authenticate without a JWT. */
export function buildAuthUrl(state: string): string {
  const { id, secret } = clientCreds();
  const client = new google.auth.OAuth2({
    clientId: id,
    clientSecret: secret,
    redirectUri: googleRedirectUri(),
  });
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // ensures Google returns a refresh_token even on re-consent
    scope: SCOPES,
    state,
    include_granted_scopes: true,
  });
}

/** Exchange the authorization code from the callback for tokens. */
export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  email: string | null;
}> {
  const { id, secret } = clientCreds();
  const client = new google.auth.OAuth2({
    clientId: id,
    clientSecret: secret,
    redirectUri: googleRedirectUri(),
  });
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  let email: string | null = null;
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const me = await oauth2.userinfo.get();
    email = me.data.email ?? null;
  } catch {
    // Not fatal — email is for display only.
  }
  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh_token. The user must re-consent (force prompt=consent).',
    );
  }
  return {
    accessToken: tokens.access_token ?? '',
    refreshToken: tokens.refresh_token,
    email,
  };
}

function clientForRefresh(refreshToken: string) {
  const { id, secret } = clientCreds();
  const client = new google.auth.OAuth2({ clientId: id, clientSecret: secret });
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export function calendarFor(refreshToken: string): calendar_v3.Calendar {
  return google.calendar({ version: 'v3', auth: clientForRefresh(refreshToken) });
}

/** List every calendar the host can access (owned, subscribed, shared).
 *  We later filter what's bookable via meet_calendar.role on our side; Google
 *  shouldn't pre-filter or the user will be missing options. */
export async function listCalendars(refreshToken: string) {
  const cal = calendarFor(refreshToken);
  const r = await cal.calendarList.list({ minAccessRole: 'reader' });
  return (r.data.items ?? []).map((c) => ({
    id: c.id ?? '',
    summary: c.summary ?? '',
    primary: !!c.primary,
    accessRole: c.accessRole ?? null,
  }));
}

/** Busy intervals across the given calendars in the given window. */
export async function freeBusy(
  refreshToken: string,
  calendarIds: string[],
  from: Date,
  to: Date,
): Promise<{ start: Date; end: Date }[]> {
  if (calendarIds.length === 0) return [];
  const cal = calendarFor(refreshToken);
  const r = await cal.freebusy.query({
    requestBody: {
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      items: calendarIds.map((id) => ({ id })),
    },
  });
  const out: { start: Date; end: Date }[] = [];
  const cals = r.data.calendars ?? {};
  for (const cid of Object.keys(cals)) {
    const busy = cals[cid]?.busy ?? [];
    for (const b of busy) {
      if (!b.start || !b.end) continue;
      out.push({ start: new Date(b.start), end: new Date(b.end) });
    }
  }
  return out;
}

/**
 * The events on a person's own calendars in a window, with their attendees.
 *
 * `freeBusy` above deliberately returns intervals and nothing else, because
 * booking only needs to know when somebody is busy. This needs the opposite:
 * who is in the room. Both scopes are already granted (`calendar.readonly`),
 * so this adds no consent step.
 *
 * Only calendars the person OWNS. A subscribed team calendar or a colleague's
 * shared one would drag other people's meetings into "who are you seeing
 * today", which is both wrong and a quiet way to surface somebody else's day.
 *
 * `singleEvents` expands recurrences, so a weekly one-to-one appears as
 * today's instance with today's attendee list rather than as a rule that has
 * to be interpreted. Cancelled instances are dropped by the same flag.
 */
export type AgendaEvent = {
  id: string;
  summary: string;
  start: Date;
  end: Date;
  /** True for an all-day entry, which has a date and no time. */
  allDay: boolean;
  location: string | null;
  attendees: { email: string; name: string | null; self: boolean; organiser: boolean }[];
};

export async function listEvents(
  refreshToken: string,
  from: Date,
  to: Date,
  max = 50,
): Promise<AgendaEvent[]> {
  const cal = calendarFor(refreshToken);
  const list = await cal.calendarList.list({ minAccessRole: 'owner' });
  const ids = (list.data.items ?? []).map((c) => c.id).filter(Boolean) as string[];

  const perCalendar = await Promise.all(
    ids.map(async (id) => {
      try {
        const r = await cal.events.list({
          calendarId: id,
          timeMin: from.toISOString(),
          timeMax: to.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: max,
        });
        return r.data.items ?? [];
      } catch {
        // One calendar failing must not cost the whole agenda. A calendar can
        // disappear between the list call and the read.
        return [];
      }
    }),
  );

  const out: AgendaEvent[] = [];
  for (const item of perCalendar.flat()) {
    const startRaw = item.start?.dateTime ?? item.start?.date;
    const endRaw = item.end?.dateTime ?? item.end?.date;
    if (!startRaw || !endRaw || !item.id) continue;
    out.push({
      id: item.id,
      summary: item.summary ?? '',
      start: new Date(startRaw),
      end: new Date(endRaw),
      allDay: !item.start?.dateTime,
      location: item.location ?? null,
      attendees: (item.attendees ?? [])
        .filter((a) => a.email && !a.resource)
        .map((a) => ({
          email: a.email!,
          name: a.displayName ?? null,
          self: !!a.self,
          organiser: !!a.organizer,
        })),
    });
  }

  // Merged across calendars, so the ordering Google gave per calendar is gone.
  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out.slice(0, max);
}

export type CreateEventInput = {
  calendarId: string;
  summary: string;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  attendeeEmail: string;
  attendeeName?: string | null;
  /** Additional attendees beyond the invitee — used for collective bookings
   * where every team member is on the same calendar event. */
  extraAttendees?: { email: string; name?: string | null }[];
  /** When true, creates a Google Meet conferencing entry on the event. */
  withMeet?: boolean;
  /** Free-form location string (in_person flow). */
  location?: string | null;
};

export async function createEvent(
  refreshToken: string,
  input: CreateEventInput,
): Promise<{ eventId: string; meetUrl: string | null }> {
  const cal = calendarFor(refreshToken);
  const attendee: calendar_v3.Schema$EventAttendee = { email: input.attendeeEmail };
  if (input.attendeeName) attendee.displayName = input.attendeeName;
  const attendees: calendar_v3.Schema$EventAttendee[] = [attendee];
  for (const ex of input.extraAttendees ?? []) {
    const a: calendar_v3.Schema$EventAttendee = { email: ex.email };
    if (ex.name) a.displayName = ex.name;
    attendees.push(a);
  }
  const requestBody: calendar_v3.Schema$Event = {
    summary: input.summary,
    start: { dateTime: input.startsAt.toISOString() },
    end: { dateTime: input.endsAt.toISOString() },
    attendees,
  };
  if (input.description) requestBody.description = input.description;
  if (input.location) requestBody.location = input.location;
  if (input.withMeet) {
    requestBody.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }
  // sendUpdates: 'none' — Fibre Meet sends its own branded confirmation
  // email; we don't want Google to also email the invitee. The attendee
  // still appears on the host's calendar event so they see who's coming.
  const r = await cal.events.insert({
    calendarId: input.calendarId,
    conferenceDataVersion: input.withMeet ? 1 : 0,
    sendUpdates: 'none',
    requestBody,
  });
  const meetUrl =
    r.data.hangoutLink ??
    r.data.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')
      ?.uri ??
    null;
  return { eventId: r.data.id ?? '', meetUrl };
}

export async function deleteEvent(
  refreshToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const cal = calendarFor(refreshToken);
  // Same reasoning as createEvent — Fibre Meet sends its own cancellation
  // email pair; Google would otherwise email the invitee a second time.
  await cal.events.delete({ calendarId, eventId, sendUpdates: 'none' });
}

/** Move an existing event (reschedule). Only the fields we pass change;
 *  attendees, conference data and the Meet link stay as they are — which is
 *  the point: the invitee keeps the same join URL across a reschedule.
 *  sendUpdates:'none' for the same reason as createEvent — Meet sends its
 *  own branded mail. */
export async function patchEvent(
  refreshToken: string,
  calendarId: string,
  eventId: string,
  patch: { startsAt?: Date; endsAt?: Date; location?: string | null; summary?: string },
): Promise<void> {
  const cal = calendarFor(refreshToken);
  const requestBody: calendar_v3.Schema$Event = {};
  if (patch.startsAt) requestBody.start = { dateTime: patch.startsAt.toISOString() };
  if (patch.endsAt) requestBody.end = { dateTime: patch.endsAt.toISOString() };
  if (patch.location !== undefined && patch.location !== null) requestBody.location = patch.location;
  if (patch.summary) requestBody.summary = patch.summary;
  await cal.events.patch({ calendarId, eventId, sendUpdates: 'none', requestBody });
}
