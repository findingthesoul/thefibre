// What the two lines under a meeting are actually FOR.
//
// Sjoerd, 2026-09-21: *"if locations of meetings in the agenda are filled in:
// location -> maps or any mobile app using, zoom/teams: link opens app.
// Possible?"*
//
// Yes, and it needs no integration with anybody: a phone decides which app
// opens a link from the link itself. maps.google.com hands off to the Maps
// app on iOS and Android, a zoom.us/j/… link opens Zoom, a
// teams.microsoft.com/l/meetup-join link opens Teams, meet.google.com opens
// Meet. All this file does is work out WHICH of the two a meeting's location
// is — because the field is one box that people put both kinds of thing in.
//
// The trap it exists to avoid: Zoom writes the join URL into `location`. Sent
// to a maps search that produces a map of nowhere, which is worse than no
// link at all. So a location that is a URL is a way in, never a place.

/** Which app a link belongs to. Decides the word on the button, nothing else
 *  — the phone does the opening. `video` is an unrecognised meeting link. */
export type JoinKind = 'meet' | 'zoom' | 'teams' | 'video';

export type Join = { url: string; kind: JoinKind };

/** The first thing in `text` that looks like a link. Calendar locations are
 *  free text and often read "Zoom: https://… (passcode 1234)". */
function firstUrl(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(/https?:\/\/[^\s<>"')]+/i);
  if (!m) return null;
  // A trailing bracket or full stop is punctuation around the link, not part
  // of it. Commas and semicolons likewise.
  return m[0].replace(/[.,;:]+$/, '');
}

function kindOf(url: string): JoinKind {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'video';
  }
  if (host === 'meet.google.com' || host.endsWith('.meet.google.com')) return 'meet';
  if (host === 'zoom.us' || host.endsWith('.zoom.us')) return 'zoom';
  if (host === 'teams.microsoft.com' || host.endsWith('.teams.microsoft.com')) return 'teams';
  if (host === 'teams.live.com' || host.endsWith('.teams.live.com')) return 'teams';
  return 'video';
}

/**
 * The way into the meeting: the calendar's own conferencing entry if it has
 * one, otherwise a link somebody typed into the location.
 *
 * `conferenceUrl` wins because Google puts the real entry point there even
 * when the location says something else entirely ("Room 2 / online").
 */
export function joinLink(location: string | null, conferenceUrl: string | null): Join | null {
  const url = conferenceUrl?.trim() || firstUrl(location);
  if (!url) return null;
  // http(s) only. A calendar location can hold anything, and a `javascript:`
  // or `data:` string reaching an href is the one way this field could bite.
  if (!/^https?:\/\//i.test(url)) return null;
  return { url, kind: kindOf(url) };
}

/**
 * The location as a place to walk to, or null when it is not one.
 *
 * Null for a location that is only a link (that is a way in, and `joinLink`
 * already has it) and for one too short to be an address. A maps search takes
 * free text happily — "EBBF office, Athens" finds it — so nothing is parsed
 * here beyond deciding that there is something to search for.
 */
export function placeLink(location: string | null): { url: string; label: string } | null {
  const raw = (location ?? '').trim();
  if (!raw) return null;
  // Strip a link out of a mixed location: "Room 2, https://zoom.us/j/1" is a
  // room AND a way in, and the room half is still worth a map.
  const withoutUrl = raw.replace(/https?:\/\/[^\s<>"')]+/gi, '').trim();
  // Google's location is free text and often arrives with line breaks in it
  // (a postal address typed over three lines). Rendered in a one-line chip
  // those collapse into whatever they collapse into; normalising here makes
  // the chip and its tooltip say the same readable thing.
  const label = withoutUrl.replace(/\s+/g, ' ').replace(/^[\s,;:/|-]+|[\s,;:/|-]+$/g, '');
  // One or two characters is a desk number, not somewhere to navigate to.
  if (label.length < 3) return null;
  // google.com/maps rather than an app scheme: a scheme fails silently on a
  // phone without that app and does nothing at all on a desktop, while this
  // opens the Maps app when there is one and a map in the browser when not.
  return {
    url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`,
    label,
  };
}
