import { describe, expect, it } from 'vitest';
import { googleCalendarLink, googleEventLink, outlookEventLink, outlookLink, utcStamp } from './calendar-links';

const FEED = 'https://my.thefibre.tech/calendar/abc123.ics';

describe('subscribe links', () => {
  it('Google: through its sign-in entry, carrying a webcal cid to the calendar', () => {
    const url = new URL(googleCalendarLink(FEED));
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('service')).toBe('cl');
    const cont = new URL(url.searchParams.get('continue')!);
    expect(cont.origin + cont.pathname).toBe('https://calendar.google.com/calendar/r');
    expect(cont.searchParams.get('cid')).toBe('webcal://my.thefibre.tech/calendar/abc123.ics');
  });

  it('Google takes a webcal address as it is', () => {
    const cont = new URL(new URL(googleCalendarLink('webcal://my.thefibre.tech/calendar/abc123.ics')).searchParams.get('continue')!);
    expect(cont.searchParams.get('cid')).toBe('webcal://my.thefibre.tech/calendar/abc123.ics');
  });

  it('Outlook.com: addfromweb with the https feed and a name', () => {
    const url = new URL(outlookLink('webcal://my.thefibre.tech/calendar/abc123.ics', 'my.thread'));
    expect(url.origin + url.pathname).toBe('https://outlook.live.com/calendar/0/addfromweb');
    expect(url.searchParams.get('url')).toBe(FEED);
    expect(url.searchParams.get('name')).toBe('my.thread');
  });
});

describe('one session', () => {
  const EVENT = {
    title: 'Koor & band: “repetitie”',
    start: '2026-10-20T20:00:00+02:00',
    end: '2026-10-20T22:30:00+02:00',
    details: 'Join: https://zoom.us/j/123?pwd=a&b=c',
    location: 'De Kerk, Zierikzee',
  };

  it('writes UTC the way Google wants it, whatever the input offset', () => {
    expect(utcStamp('2026-10-20T20:00:00+02:00')).toBe('20261020T180000Z');
    expect(utcStamp('2026-01-05T09:05:07.123Z')).toBe('20260105T090507Z');
  });

  it('Google: the new-event screen, through the sign-in entry, every field encoded', () => {
    const outer = new URL(googleEventLink(EVENT));
    expect(outer.origin).toBe('https://accounts.google.com');
    const inner = new URL(outer.searchParams.get('continue')!);
    expect(inner.origin + inner.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(inner.searchParams.get('action')).toBe('TEMPLATE');
    expect(inner.searchParams.get('text')).toBe(EVENT.title);
    expect(inner.searchParams.get('dates')).toBe('20261020T180000Z/20261020T203000Z');
    expect(inner.searchParams.get('details')).toBe(EVENT.details);
    expect(inner.searchParams.get('location')).toBe(EVENT.location);
  });

  it('Outlook.com: the compose deeplink, UTC with a Z, fields encoded', () => {
    const url = new URL(outlookEventLink(EVENT));
    expect(url.origin + url.pathname).toBe('https://outlook.live.com/calendar/0/deeplink/compose');
    expect(url.searchParams.get('subject')).toBe(EVENT.title);
    expect(url.searchParams.get('startdt')).toBe('2026-10-20T18:00:00Z');
    expect(url.searchParams.get('enddt')).toBe('2026-10-20T20:30:00Z');
    expect(url.searchParams.get('body')).toBe(EVENT.details);
    expect(url.searchParams.get('location')).toBe(EVENT.location);
  });

  it('an hour long when the session has no end; empty fields left out', () => {
    const inner = new URL(new URL(googleEventLink({ title: 'Call', start: '2026-10-20T18:00:00Z' })).searchParams.get('continue')!);
    expect(inner.searchParams.get('dates')).toBe('20261020T180000Z/20261020T190000Z');
    expect(inner.searchParams.has('details')).toBe(false);
    expect(new URL(outlookEventLink({ title: 'Call', start: '2026-10-20T18:00:00Z' })).searchParams.get('enddt')).toBe('2026-10-20T19:00:00Z');
  });
});
