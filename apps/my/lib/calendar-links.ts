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
