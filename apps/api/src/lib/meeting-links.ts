// Minting a real meeting in the organiser's OWN account.
//
// Sjoerd, 2026-10-01, after picking Zoom on a thread session and finding
// nothing in his Zoom account: *"There are settings in the profile, the same
// as in meet... please use a single point of truth"*.
//
// He was right twice over. The connections ARE already a single point of
// truth — `lib/connections.ts`, the one place a person's Google and Zoom
// credentials and personal room live. Thread simply never asked it for
// anything except the personal room, so `meeting_provider: 'zoom'` was a
// LABEL: it set a name and an icon and left the organiser to paste a link.
// Meet, meanwhile, has created real meetings since v0.59.0.
//
// This is the second half of that: one function that, given a person and a
// provider, produces a real join URL from the account they connected.
//
// WHY IT LIVES HERE AND NOT IN EITHER APP
// ---------------------------------------------------------------------------
// Meet's `zoomMeetingFor` in routes/meet.ts did all of this already, and
// exactly one line of it was Meet-specific (resolving a Meet host id to a
// user id). Copying the other twenty into Thread would have made a second
// implementation of "create a Zoom meeting", including the alternative-hosts
// retry, which is the kind of thing that gets fixed in one copy. So the
// behaviour moved here whole — co-host retry included — and Meet calls it
// with the user id it already resolves.
//
// WHAT IT DELIBERATELY DOES NOT DO
// ---------------------------------------------------------------------------
// It never invents a link, and it never silently succeeds. A provider that is
// not configured on this deployment, or an account the person has not
// connected, returns a REASON — so the caller can say "connect Zoom in
// Settings first" instead of saving an engagement whose join link is blank
// and discovering it on the day.

import {
  createZoomMeeting,
  isZoomConfigured,
  ZoomAlternativeHostsError,
} from './zoom/client.js';
import { zoomAccessTokenForUser } from './zoom/host.js';
import { createTeamsMeeting, isTeamsConfigured } from './teams/client.js';
import { teamsAccessTokenForUser } from './teams/host.js';
import { userGoogleToken } from './connections.js';
import { createEvent } from './google/client.js';

/** Providers that can mint a link. `personal_room` and `custom` cannot: a
 *  personal room is already a fixed URL read straight from the profile, and a
 *  custom link is by definition the organiser's own. (`teams` joined the
 *  mintable set when the Microsoft connection landed — a work or school
 *  account connected through Settings, same as Zoom.) */
export type MintableProvider = 'zoom' | 'google_meet' | 'teams';

export type MintResult =
  /** `id` is the PROVIDER's own id for the meeting, when it has one. Meet
   *  stores Zoom's as `zoom_meeting_id` and needs it later to reschedule or
   *  cancel the meeting — dropping it here would leave a booking that can be
   *  moved in The Fibre and never moves in Zoom. */
  | { ok: true; url: string; id?: string }
  | { ok: false; reason: 'not_configured' | 'not_connected' | 'failed' };

export function isMintable(provider: string | null | undefined): provider is MintableProvider {
  return provider === 'zoom' || provider === 'google_meet' || provider === 'teams';
}

export async function createMeetingLink(args: {
  /** The person whose account hosts it — organiser for a thread session,
   *  host for a booking. */
  userId: string;
  provider: MintableProvider;
  topic: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  agenda?: string | null;
  /** Zoom only: co-hosts in the same Zoom organisation. */
  coHostEmails?: string[];
  /** Google only: the address the event is created for. A thread session has
   *  no single invitee, so the organiser's own address is used and the
   *  session lands on their calendar — which is where they wanted it. */
  organiserEmail?: string | null;
}): Promise<MintResult> {
  const durationMinutes = Math.max(
    1,
    Math.round((args.endsAt.getTime() - args.startsAt.getTime()) / 60_000),
  );

  if (args.provider === 'zoom') {
    if (!isZoomConfigured()) return { ok: false, reason: 'not_configured' };
    const token = await zoomAccessTokenForUser(args.userId);
    if (!token) return { ok: false, reason: 'not_connected' };

    const base = {
      topic: args.topic,
      startsAtIso: args.startsAt.toISOString(),
      durationMinutes,
      timezone: args.timezone,
      agenda: args.agenda ?? null,
    };
    try {
      const m = await createZoomMeeting(
        token,
        args.coHostEmails?.length ? { ...base, alternativeHosts: args.coHostEmails } : base,
      );
      return { ok: true, url: m.joinUrl, id: m.meetingId };
    } catch (e) {
      // A co-host outside the host's Zoom organisation makes Zoom reject the
      // whole call. Retry without them rather than losing the meeting — they
      // still receive the join link (Suite's behaviour, kept since v0.59.0).
      if (e instanceof ZoomAlternativeHostsError) {
        try {
          const m = await createZoomMeeting(token, base);
          return { ok: true, url: m.joinUrl, id: m.meetingId };
        } catch (e2) {
          console.error('[meeting-links] zoom retry without co-hosts failed', e2);
          return { ok: false, reason: 'failed' };
        }
      }
      console.error('[meeting-links] zoom create failed', e);
      return { ok: false, reason: 'failed' };
    }
  }

  if (args.provider === 'teams') {
    if (!isTeamsConfigured()) return { ok: false, reason: 'not_configured' };
    const token = await teamsAccessTokenForUser(args.userId);
    if (!token) return { ok: false, reason: 'not_connected' };
    try {
      // Instants, not wall clock: Graph takes UTC and there is no timezone
      // field, so `args.timezone` has nothing to apply to (see
      // teams/client.ts teamsInstant). Co-hosts are not passed either: a Graph
      // online meeting is a join link, not an invitation.
      const m = await createTeamsMeeting(token, {
        topic: args.topic,
        startsAt: args.startsAt,
        endsAt: args.endsAt,
      });
      return { ok: true, url: m.joinUrl, id: m.meetingId };
    } catch (e) {
      console.error('[meeting-links] teams create failed', e);
      return { ok: false, reason: 'failed' };
    }
  }

  // Google Meet. A Meet link cannot be minted on its own — it is a property
  // of a calendar event — so this creates one on the organiser's primary
  // calendar and reads the link off it.
  const refresh = await userGoogleToken(args.userId);
  if (!refresh) return { ok: false, reason: 'not_connected' };
  if (!args.organiserEmail) return { ok: false, reason: 'not_connected' };
  try {
    const r = await createEvent(refresh, {
      calendarId: 'primary',
      summary: args.topic,
      description: args.agenda ?? null,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      attendeeEmail: args.organiserEmail,
      withMeet: true,
    });
    if (!r.meetUrl) {
      // The event exists and carries no conferencing. Google does this when
      // the account's policy forbids Meet creation; treat it as a failure
      // rather than returning a bare calendar URL nobody can join.
      console.error('[meeting-links] google event created without a Meet link');
      return { ok: false, reason: 'failed' };
    }
    return { ok: true, url: r.meetUrl, id: r.eventId };
  } catch (e) {
    console.error('[meeting-links] google meet create failed', e);
    return { ok: false, reason: 'failed' };
  }
}
