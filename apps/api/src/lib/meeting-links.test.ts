import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Sjoerd, 2026-10-01, having picked Zoom on a thread session: "the other app
// (zoom account) said the thread did not use zoom" — then: "There are
// settings in the profile, the same as in meet... please use a single point
// of truth".
//
// Both true. `meeting_provider: 'zoom'` on a thread session was a LABEL: it
// set a name and an icon and expected the organiser to paste their own link.
// Meet had created real Zoom meetings since v0.59.0 from the same stored
// connection. One app asked the profile; the other only named it.

const createZoomMeeting = vi.fn();
const zoomAccessTokenForUser = vi.fn();
const isZoomConfigured = vi.fn(() => true);
const userGoogleToken = vi.fn();
const createEvent = vi.fn();
const createTeamsMeeting = vi.fn();
const teamsAccessTokenForUser = vi.fn();
const isTeamsConfigured = vi.fn(() => true);

class FakeAltHostsError extends Error {}

vi.mock('./zoom/client.js', () => ({
  createZoomMeeting: (...a: unknown[]) => createZoomMeeting(...a),
  isZoomConfigured: () => isZoomConfigured(),
  ZoomAlternativeHostsError: FakeAltHostsError,
}));
vi.mock('./zoom/host.js', () => ({
  zoomAccessTokenForUser: (...a: unknown[]) => zoomAccessTokenForUser(...a),
}));
vi.mock('./teams/client.js', () => ({
  createTeamsMeeting: (...a: unknown[]) => createTeamsMeeting(...a),
  isTeamsConfigured: () => isTeamsConfigured(),
}));
vi.mock('./teams/host.js', () => ({
  teamsAccessTokenForUser: (...a: unknown[]) => teamsAccessTokenForUser(...a),
}));
vi.mock('./connections.js', () => ({
  userGoogleToken: (...a: unknown[]) => userGoogleToken(...a),
}));
vi.mock('./google/client.js', () => ({
  createEvent: (...a: unknown[]) => createEvent(...a),
}));

const { createMeetingLink, isMintable } = await import('./meeting-links.js');

const WHEN = {
  topic: 'Opening session',
  startsAt: new Date('2026-11-03T10:00:00Z'),
  endsAt: new Date('2026-11-03T11:30:00Z'),
  timezone: 'Europe/Amsterdam',
};

beforeEach(() => {
  vi.clearAllMocks();
  isZoomConfigured.mockReturnValue(true);
  isTeamsConfigured.mockReturnValue(true);
});

describe('which providers can mint at all', () => {
  it('zoom, google meet and teams can', () => {
    expect(isMintable('zoom')).toBe(true);
    expect(isMintable('google_meet')).toBe(true);
    // Deliberately changed when the Microsoft connection landed: this used to
    // assert Teams was NOT mintable because it had no integration here.
    expect(isMintable('teams')).toBe(true);
  });

  it('the others cannot, and that is not a gap', () => {
    // A personal room IS already a fixed URL read from the profile; a custom
    // link is the organiser's own by definition. Minting for these would mean
    // inventing something.
    for (const p of ['personal_room', 'custom', null, undefined, '']) {
      expect(isMintable(p)).toBe(false);
    }
  });
});

describe('zoom', () => {
  it('creates the meeting in the connected account and returns the join URL', async () => {
    zoomAccessTokenForUser.mockResolvedValue('tok');
    createZoomMeeting.mockResolvedValue({ meetingId: '99', joinUrl: 'https://zoom.us/j/99' });

    const r = await createMeetingLink({ userId: 'u1', provider: 'zoom', ...WHEN });

    expect(r).toEqual({ ok: true, url: 'https://zoom.us/j/99', id: '99' });
  });

  it('returns the provider id, which a reschedule and a cancellation need', async () => {
    // Meet stores this as zoom_meeting_id and reads it back to move or delete
    // the meeting. An early draft of the shared helper dropped it, which
    // would have let a booking be rescheduled in The Fibre while Zoom kept
    // the original time — and nothing would have errored.
    zoomAccessTokenForUser.mockResolvedValue('tok');
    createZoomMeeting.mockResolvedValue({ meetingId: 'abc', joinUrl: 'https://zoom.us/j/abc' });

    const r = await createMeetingLink({ userId: 'u1', provider: 'zoom', ...WHEN });

    expect(r.ok && r.id).toBe('abc');
  });

  it('computes the duration from the two ends, in minutes', async () => {
    zoomAccessTokenForUser.mockResolvedValue('tok');
    createZoomMeeting.mockResolvedValue({ meetingId: '1', joinUrl: 'u' });

    await createMeetingLink({ userId: 'u1', provider: 'zoom', ...WHEN });

    expect(createZoomMeeting.mock.calls[0]![1]).toMatchObject({ durationMinutes: 90 });
  });

  it('says NOT CONFIGURED when the platform has no Zoom app', async () => {
    // Which is the state of production as of 2026-10-01: no ZOOM_CLIENT_ID.
    // Distinguished from "you have not connected" because the remedy is
    // somebody else's and the organiser can only be told, not asked.
    isZoomConfigured.mockReturnValue(false);

    const r = await createMeetingLink({ userId: 'u1', provider: 'zoom', ...WHEN });

    expect(r).toEqual({ ok: false, reason: 'not_configured' });
    expect(zoomAccessTokenForUser).not.toHaveBeenCalled();
  });

  it('says NOT CONNECTED when this person has not linked Zoom', async () => {
    zoomAccessTokenForUser.mockResolvedValue(null);

    const r = await createMeetingLink({ userId: 'u1', provider: 'zoom', ...WHEN });

    expect(r).toEqual({ ok: false, reason: 'not_connected' });
  });

  it('retries without co-hosts rather than losing the meeting', async () => {
    // Zoom rejects the whole call when a co-host is outside the host's
    // organisation. Suite's behaviour, carried since v0.59.0, and the reason
    // the retry moved into the shared helper rather than staying in Meet.
    zoomAccessTokenForUser.mockResolvedValue('tok');
    createZoomMeeting
      .mockRejectedValueOnce(new FakeAltHostsError('outside the org'))
      .mockResolvedValueOnce({ meetingId: '7', joinUrl: 'https://zoom.us/j/7' });

    const r = await createMeetingLink({
      userId: 'u1',
      provider: 'zoom',
      coHostEmails: ['someone@elsewhere.test'],
      ...WHEN,
    });

    expect(r).toEqual({ ok: true, url: 'https://zoom.us/j/7', id: '7' });
    expect(createZoomMeeting).toHaveBeenCalledTimes(2);
    expect(createZoomMeeting.mock.calls[1]![1]).not.toHaveProperty('alternativeHosts');
  });

  it('a different Zoom error is a failure, not a silent empty link', async () => {
    zoomAccessTokenForUser.mockResolvedValue('tok');
    createZoomMeeting.mockRejectedValue(new Error('429'));

    const r = await createMeetingLink({ userId: 'u1', provider: 'zoom', ...WHEN });

    expect(r).toEqual({ ok: false, reason: 'failed' });
  });
});

describe('teams', () => {
  it('creates the meeting in the connected account and returns the join URL and id', async () => {
    teamsAccessTokenForUser.mockResolvedValue('tok');
    createTeamsMeeting.mockResolvedValue({ meetingId: 'MSpk', joinUrl: 'https://teams.microsoft.com/l/meetup-join/x' });

    const r = await createMeetingLink({ userId: 'u1', provider: 'teams', ...WHEN });

    expect(r).toEqual({ ok: true, url: 'https://teams.microsoft.com/l/meetup-join/x', id: 'MSpk' });
    expect(teamsAccessTokenForUser).toHaveBeenCalledWith('u1');
  });

  it('hands the two INSTANTS over, not a start and a duration in a zone', async () => {
    teamsAccessTokenForUser.mockResolvedValue('tok');
    createTeamsMeeting.mockResolvedValue({ meetingId: '1', joinUrl: 'u' });

    await createMeetingLink({ userId: 'u1', provider: 'teams', ...WHEN });

    expect(createTeamsMeeting.mock.calls[0]![1]).toEqual({
      topic: 'Opening session',
      startsAt: WHEN.startsAt,
      endsAt: WHEN.endsAt,
    });
  });

  it('says NOT CONFIGURED when the platform has no Microsoft app', async () => {
    isTeamsConfigured.mockReturnValue(false);

    const r = await createMeetingLink({ userId: 'u1', provider: 'teams', ...WHEN });

    expect(r).toEqual({ ok: false, reason: 'not_configured' });
    expect(teamsAccessTokenForUser).not.toHaveBeenCalled();
  });

  it('says NOT CONNECTED when this person has not linked Microsoft', async () => {
    teamsAccessTokenForUser.mockResolvedValue(null);

    const r = await createMeetingLink({ userId: 'u1', provider: 'teams', ...WHEN });

    expect(r).toEqual({ ok: false, reason: 'not_connected' });
    expect(createTeamsMeeting).not.toHaveBeenCalled();
  });

  it('a Graph error is a failure, not a silent empty link', async () => {
    teamsAccessTokenForUser.mockResolvedValue('tok');
    createTeamsMeeting.mockRejectedValue(new Error('403'));

    const r = await createMeetingLink({ userId: 'u1', provider: 'teams', ...WHEN });

    expect(r).toEqual({ ok: false, reason: 'failed' });
  });

  it('never touches the zoom or google paths', async () => {
    teamsAccessTokenForUser.mockResolvedValue('tok');
    createTeamsMeeting.mockResolvedValue({ meetingId: '1', joinUrl: 'u' });

    await createMeetingLink({ userId: 'u1', provider: 'teams', ...WHEN });

    expect(createZoomMeeting).not.toHaveBeenCalled();
    expect(createEvent).not.toHaveBeenCalled();
    expect(userGoogleToken).not.toHaveBeenCalled();
  });
});

describe('google meet', () => {
  it('creates a calendar event and returns the Meet link off it', async () => {
    userGoogleToken.mockResolvedValue('refresh');
    createEvent.mockResolvedValue({ eventId: 'ev1', meetUrl: 'https://meet.google.com/abc-def' });

    const r = await createMeetingLink({
      userId: 'u1',
      provider: 'google_meet',
      organiserEmail: 'organiser@example.test',
      ...WHEN,
    });

    expect(r).toEqual({ ok: true, url: 'https://meet.google.com/abc-def', id: 'ev1' });
    expect(createEvent.mock.calls[0]![1]).toMatchObject({ withMeet: true, calendarId: 'primary' });
  });

  it('an event with no conferencing is a failure, not a calendar URL', async () => {
    // Google creates the event and omits the conference when the account's
    // policy forbids Meet. Returning something here would hand participants a
    // link that opens a calendar page instead of a meeting.
    userGoogleToken.mockResolvedValue('refresh');
    createEvent.mockResolvedValue({ eventId: 'ev1', meetUrl: null });

    const r = await createMeetingLink({
      userId: 'u1',
      provider: 'google_meet',
      organiserEmail: 'organiser@example.test',
      ...WHEN,
    });

    expect(r).toEqual({ ok: false, reason: 'failed' });
  });

  it('needs an address, because a Meet link only exists on an event', async () => {
    userGoogleToken.mockResolvedValue('refresh');

    const r = await createMeetingLink({ userId: 'u1', provider: 'google_meet', ...WHEN });

    expect(r).toEqual({ ok: false, reason: 'not_connected' });
    expect(createEvent).not.toHaveBeenCalled();
  });
});

describe('Thread and Meet mint through the one helper', () => {
  const read = (rel: string) =>
    readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

  it('Meet no longer calls the Zoom API itself', () => {
    // The point of the extraction. If createZoomMeeting reappears in a route,
    // there are two implementations again and the alternative-hosts retry is
    // the thing that gets fixed in one of them.
    expect(read('../routes/meet.ts')).not.toMatch(/\bcreateZoomMeeting\(/);
    expect(read('../routes/meet.ts')).toContain('createMeetingLink');
  });

  it('Thread mints through it too, rather than only naming a provider', () => {
    expect(read('../routes/thread.ts')).toContain('createMeetingLink');
  });
});
