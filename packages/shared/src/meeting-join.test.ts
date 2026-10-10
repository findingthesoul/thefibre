// The two rules behind the Join link on a booking row.
//
// Worth testing because both are easy to write in a way that LOOKS right: a
// substring match for the provider, and a wall-clock read for "is it over".

import { describe, expect, it } from 'vitest';
import { meetingProvider, canJoinMeeting } from './meeting-join.js';

describe('which service a meeting link belongs to', () => {
  it('names the three we can place', () => {
    expect(meetingProvider('https://zoom.us/j/123456')).toBe('zoom');
    expect(meetingProvider('https://teams.microsoft.com/l/meetup-join/abc')).toBe('teams');
    expect(meetingProvider('https://meet.google.com/abc-defg-hij')).toBe('google');
  });

  it('follows a company subdomain', () => {
    expect(meetingProvider('https://acme.zoom.us/j/999')).toBe('zoom');
    expect(meetingProvider('https://teams.live.com/meet/123')).toBe('teams');
  });

  // The reason it reads the host rather than the string. A booking whose URL
  // carries "zoom" in a query parameter is not a Zoom call, and a lookalike
  // domain must not borrow the name.
  it('is not fooled by the word appearing elsewhere in the URL', () => {
    expect(meetingProvider('https://example.com/room?from=zoom.us')).toBeNull();
    expect(meetingProvider('https://notzoom.us/j/1')).toBeNull();
    expect(meetingProvider('https://zoom.us.evil.example/j/1')).toBeNull();
  });

  it('says nothing about a link it cannot place, rather than guessing', () => {
    expect(meetingProvider('https://whereby.com/team')).toBeNull();
    expect(meetingProvider('not a url')).toBeNull();
    expect(meetingProvider(null)).toBeNull();
    expect(meetingProvider('')).toBeNull();
  });
});

describe('whether a booking can be joined', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  const url = 'https://zoom.us/j/1';
  const soon = { meet_url: url, status: 'confirmed', ends_at: '2026-10-10T13:00:00Z' };

  it('yes for a confirmed meeting that has not ended', () => {
    expect(canJoinMeeting(soon, now)).toBe(true);
  });

  // People join early and hosts open the room before the hour; refusing until
  // the exact minute is wrong precisely when somebody is being punctual.
  it('yes before it has started', () => {
    expect(
      canJoinMeeting(
        { meet_url: url, status: 'confirmed', ends_at: '2026-10-11T10:00:00Z' },
        now,
      ),
    ).toBe(true);
  });

  it('no once it is over', () => {
    expect(canJoinMeeting({ ...soon, ends_at: '2026-10-10T11:59:59Z' }, now)).toBe(false);
  });

  it('no for cancelled, and no while it still needs approval', () => {
    expect(canJoinMeeting({ ...soon, status: 'cancelled' }, now)).toBe(false);
    expect(canJoinMeeting({ ...soon, status: 'pending_approval' }, now)).toBe(false);
  });

  it('no when there is nothing to join', () => {
    expect(canJoinMeeting({ ...soon, meet_url: null }, now)).toBe(false);
  });

  // A bad date is not a reason to hide a link somebody may be about to need.
  it('still offers the link when the end time is unreadable', () => {
    expect(canJoinMeeting({ ...soon, ends_at: 'whenever' }, now)).toBe(true);
    expect(canJoinMeeting({ meet_url: url, status: 'confirmed' }, now)).toBe(true);
  });

  // The clock is an argument, so this is a real assertion rather than a
  // restatement: the same booking flips on the time it is asked about.
  it('depends on the time it is asked, not on the machine clock', () => {
    const ends = { meet_url: url, status: 'confirmed', ends_at: '2026-10-10T12:30:00Z' };
    expect(canJoinMeeting(ends, new Date('2026-10-10T12:29:00Z'))).toBe(true);
    expect(canJoinMeeting(ends, new Date('2026-10-10T12:31:00Z'))).toBe(false);
  });
});
