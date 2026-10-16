import { describe, expect, it } from 'vitest';
import { googleCalendarLink, outlookLink } from './calendar-links';

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
