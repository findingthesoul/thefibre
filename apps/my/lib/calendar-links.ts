// One-click "subscribe to my calendar" links for the big calendar services
// (2026-10-17; a member: "the only calendar recognized is .ics… can you add
// the option of Google Calendar?"). Each opens the service's OWN prompt to add
// a subscribed calendar; the feed address is the person's private my.thread
// feed, so it follows moved sessions like the Apple (webcal) route does.
//
// Checked in a browser with a fixture feed address, signed out (2026-10-17):
//   * Google: `calendar.google.com/calendar/r?cid=…` sends a SIGNED-OUT
//     browser to Google's marketing page and drops the subscription. Going in
//     through Google's sign-in entry, with that address as `continue`, keeps
//     it: the sign-in page says "to continue to Google Calendar" and the cid
//     rides along. So that is the link.
//   * Outlook.com: `outlook.live.com/calendar/0/addfromweb` keeps the address
//     through its landing page as `deeplink=…`.
//   * Outlook for work or school (outlook.office.com) loses the address into
//     an opaque sign-in token and lands on mail afterwards — not verified, so
//     not offered.
// What a signed-IN person sees was not verified: nobody signs in to Google or
// Microsoft from a test.
//
// SINGLE SESSIONS (2026-10-17, a thread's dialog on Next) were checked the
// same way, signed out, with a fixture event:
//   * Google's `calendar/render?action=TEMPLATE` loses the event signed out
//     (the marketing page again); through the sign-in entry it survives —
//     title and UTC times in the continue address. So the same wrapper.
//   * Outlook.com's `deeplink/compose` keeps the event as `deeplink=…`.
// A single event is a COPY: it does not move when the session moves. The
// menus say so; subscribing is what follows moves.

/** Google Calendar's "Add calendar?" prompt for a subscription. */
export function googleCalendarLink(webcalOrHttps: string): string {
  const webcal = webcalOrHttps.replace(/^https?:\/\//, 'webcal://');
  const calendar = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  return `https://accounts.google.com/ServiceLogin?service=cl&continue=${encodeURIComponent(calendar)}`;
}

/** Outlook.com's "Subscribe from web" with the address filled in. */
export function outlookLink(feedUrl: string, name: string): string {
  const https = feedUrl.replace(/^webcal:\/\//, 'https://');
  return `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=${encodeURIComponent(name)}`;
}

/** Through Google's sign-in entry, so a signed-out browser keeps the target. */
function viaGoogleSignIn(target: string): string {
  return `https://accounts.google.com/ServiceLogin?service=cl&continue=${encodeURIComponent(target)}`;
}

export type CalendarEvent = {
  title: string;
  /** ISO instant. */
  start: string;
  /** ISO instant; an hour after `start` when the session has no end. */
  end?: string | null;
  details?: string | null;
  location?: string | null;
};

const HOUR = 60 * 60 * 1000;

/** "20261020T180000Z" — Google's UTC stamp. */
export function utcStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function endOf(e: CalendarEvent): string {
  return e.end ?? new Date(Date.parse(e.start) + HOUR).toISOString();
}

/** Google Calendar's "new event" screen, filled in. */
export function googleEventLink(e: CalendarEvent): string {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${utcStamp(e.start)}/${utcStamp(endOf(e))}`,
  });
  if (e.details) q.set('details', e.details);
  if (e.location) q.set('location', e.location);
  return viaGoogleSignIn(`https://calendar.google.com/calendar/render?${q.toString()}`);
}

/** Outlook.com's "new event" screen, filled in. */
export function outlookEventLink(e: CalendarEvent): string {
  const iso = (x: string) => new Date(x).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const q = new URLSearchParams({
    subject: e.title,
    startdt: iso(e.start),
    enddt: iso(endOf(e)),
    path: '/calendar/action/compose',
    rru: 'addevent',
  });
  if (e.details) q.set('body', e.details);
  if (e.location) q.set('location', e.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${q.toString()}`;
}
