// The one call this app makes: GET /api/v1/me/portal on the Fibre API.
//
// Nothing is read from Supabase directly (hard rule §13) — the session token
// is passed through and the API decides what this person may see. The whole
// security model lives server-side; this file just carries the bearer.

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export class PortalApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type AgendaItem = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  /** A map link for the venue, when the organiser gave one. */
  location_url: string | null;
  meeting_url: string | null;
  external_url: string | null;
  /** Whether this item asks for an RSVP. The API resolves the two-level
   *  switch (workspace default, per-thread override) — we are told the
   *  answer, never the rule. */
  rsvp_enabled: boolean;
  /** This person's answer. `null` is NO ANSWER: a third state, and not the
   *  same as 'not_coming'. */
  rsvp: RsvpResponse | null;
};

export type RsvpResponse = 'coming' | 'not_coming';

export type Ticket = {
  enrolment_id: string;
  thread_id: string;
  title: string;
  starts_on: string | null;
  location: string | null;
  checkin_code: string | null;
  checked_in_at: string | null;
};

export type ThreadItem = {
  thread_id: string;
  title: string;
  format: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  language: string;
  cover_url: string | null;
  enrolment_status: string | null;
  progress_pct: number | null;
  url: string;
  /** Who the sessions are FROM — the name a calendar entry carries so it is
   *  not a block of time from nobody. Null when a workspace or team owns the
   *  thread rather than a person. */
  organiser_name: string | null;
  organiser_email: string | null;
  /** The certificate for this thread, if one was issued to this person. The
   *  number and the date only — the drawing is fetched by the thumbnail from
   *  the public endpoint, so the payload does not carry a page of JSON per
   *  certificate. */
  certificate: { number: string; issued_at: string } | null;
  agenda: AgendaItem[];
};

export type MeetItem = {
  booking_id: string;
  title: string;
  host: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  meet_url: string | null;
  location: string | null;
};

/**
 * One invoice from the platform purchase ledger — from ANY app.
 *
 * It used to come from Membership's own per-membership endpoint, which could
 * only ever answer for memberships; a thread ticket or a meet booking had no
 * member-facing route at all. `GET /api/v1/me/invoices` answers for all of
 * them at once, scoped to the verified email, so the Purchases tab is one
 * list rather than one list per membership plus two silent gaps.
 */
export type PortalInvoice = {
  id: string;
  /** Which app sold it — `membership`, `the-thread`, `fibre-meet`. */
  app: string;
  /** The community, by the name the member knows. */
  workspace: string;
  item_label: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  stripe_invoice_url: string | null;
  // The document itself (2026-10-11). Until now the member saw a row and a
  // PDF link and could never read the invoice on screen. These are what the
  // shared InvoiceDialog needs; all optional, so an older API degrades to
  // exactly today's list rather than to a broken dialog.
  method?: string;
  payer_name?: string;
  payer_email?: string | null;
  billing?: unknown;
  seller?: {
    legal_name?: string;
    address?: string;
    tax_no?: string;
    website?: string;
    logo_url?: string | null;
  } | null;
};

/** One thing a membership includes. `url` null means "you have this, and we
 *  cannot hand you a link to it" — a Circle space or a Meet page needs
 *  per-workspace knowledge the API does not have. Naming it is still worth
 *  more than hiding it; a dead link would be worth less than nothing. */
export type Included = {
  name: string;
  description: string | null;
  url: string | null;
};

/** One thing this membership lets you JOIN, and what you would pay for it.
 *  Priced by the API with the same function that charges at enrolment, so
 *  what is shown here and what is taken at the till are one number. */
export type CouldJoin = {
  thread_id: string;
  title: string;
  url: string;
  starts_on: string | null;
  team: string;
  list_price_cents: number;
  your_price_cents: number;
  currency: string;
  pct: number;
  /** The public address in two halves, so a join goes through the ONE enrol
   *  route. Optional: an API older than v1.192 does not send them. */
  owner_slug?: string;
  thread_slug?: string;
  /** True when one click completes it: no required question, and nothing to
   *  pay or a card checkout that works. */
  direct?: boolean;
  /** How this member would pay. `unavailable` = a paid thread with no
   *  working payment route: no button, "Sign-up not open yet". */
  payment?: 'none_needed' | 'card' | 'invoice_only' | 'unavailable';
};

export type MembershipItem = {
  member_id: string;
  tier: string | null;
  status: string;
  started_at: string | null;
  renews_at: string | null;
  /** Whether Stripe holds a subscription. Manual and comped members have
   *  none, so "manage payment" would only ever 409 for them. */
  has_stripe?: boolean;
  includes?: Included[];
  /** What it lets you join next. Absent on an older API, empty when the
   *  membership carries no calendar or the calendars have nothing coming
   *  up — both of which the page says in words rather than showing a
   *  heading over nothing. */
  could_join?: CouldJoin[];
};

/** One product this person BOUGHT here, and the day they bought it.
 *
 *  Not the same thing as something a membership includes: this is theirs
 *  outright, it survives a tier change and a lapse, and — the gap this
 *  closes — it exists whether or not they are a member of this community at
 *  all. */
export type OwnedProduct = Included & { bought_on: string };

export type Group = {
  workspace_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  tickets: Ticket[];
  threads: ThreadItem[];
  meets: MeetItem[];
  memberships: MembershipItem[];
  /** Optional, because an older API does not send it — the page treats an
   *  absent list and an empty one the same way, which is to say nothing. */
  products?: OwnedProduct[];
};

/**
 * Answer, change, or withdraw an RSVP. Goes through this app's own route
 * handler rather than straight to the API, so the session token never
 * reaches the browser — the same reason the .ics is served here.
 * `'none'` withdraws and returns the person to "no answer", which has to be
 * reachable or a mis-tap is permanent and every count is quietly wrong.
 */
export async function setRsvp(
  engagementId: string,
  response: RsvpResponse | 'none',
): Promise<void> {
  const res = await fetch('/api/rsvp', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ engagement_id: engagementId, response }),
  });
  if (!res.ok) throw new PortalApiError(res.status, `RSVP failed (${res.status})`);
}

export type Portal = {
  person: { first_name: string | null; last_name: string | null; email: string };
  /**
   * Whether the wallet passes are actually issuable. Both are env-gated on
   * credentials Sjoerd holds outside this repo (an Apple Pass Type ID
   * certificate, a Google Wallet issuer account); without them the pass
   * routes 503. Showing a button that fails is worse than showing none, so
   * the API tells us rather than us guessing.
   */
  wallet: { apple: boolean; google: boolean };
  groups: Group[];
  /** Does any membership carry a team calendar? Shows "Upcoming". Absent on
   *  an API older than v1.192, which reads as no. */
  upcoming?: boolean;
  /** Unread notifications, for the dot on the bell. Absent = none. */
  unread_notifications?: number;
  /** Communities this address is a live member of. One = sign-in lands on
   *  that community's page; any = a Community nav item. */
  communities?: number;
};

/** One community's page, as its member sees it (the API's member-page.ts). */
export type CommunityView = {
  workspace_id: string;
  name: string;
  logo_url: string | null;
  intro_html: string | null;
  documents: { id: string; title: string; mime: string; bytes: number }[];
  thread_documents: { thread_title: string; items: { title: string; url: string | null; sent_at: string }[] }[];
  next: { title: string; starts_at: string; thread_title: string | null; url: string | null; kind: 'yours' | 'upcoming' } | null;
};

/** THROWS on failure, so a broken call is not mistaken for "no community". */
export async function fetchCommunities(accessToken: string): Promise<CommunityView[]> {
  const res = await fetch(`${baseUrl}/api/v1/me/portal/community`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new PortalApiError(res.status, `API ${res.status}: /api/v1/me/portal/community`);
  return ((await res.json()) as { items: CommunityView[] }).items;
}

/** One thing a member was told (type + subject + date — never a body). */
export type MemberNotification = {
  id: string;
  kind: 'new_thread' | 'session_moved' | 'session_cancelled';
  thread_id: string | null;
  subject: string;
  starts_at: string | null;
  read: boolean;
  created_at: string;
  community: string | null;
};

/** THROWS on failure: an empty list and a broken call must not look alike. */
export async function fetchNotifications(
  accessToken: string,
  cursor: string | null,
): Promise<{ items: MemberNotification[]; next_cursor: string | null }> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const res = await fetch(`${baseUrl}/api/v1/me/portal/notifications${q}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new PortalApiError(res.status, `API ${res.status}: /api/v1/me/portal/notifications`);
  return res.json() as Promise<{ items: MemberNotification[]; next_cursor: string | null }>;
}

/** Best-effort: a list that failed to mark read is still a list. */
export async function markNotificationsRead(accessToken: string): Promise<void> {
  await fetch(`${baseUrl}/api/v1/me/portal/notifications/read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  }).catch(() => undefined);
}

export type NotifyPref = { workspace_id: string; community: string | null; email_off: boolean };

/** Null when the call failed — the You page then omits the switches rather
 *  than showing a state it is unsure of. */
export async function fetchNotifyPrefs(accessToken: string): Promise<NotifyPref[] | null> {
  const res = await fetch(`${baseUrl}/api/v1/me/portal/notification-prefs`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  }).catch(() => null);
  if (!res?.ok) return null;
  return ((await res.json()) as { items: NotifyPref[] }).items;
}

/** One page of everything the member's team calendars let them join. */
export type UpcomingPage = { entitled: boolean; items: CouldJoin[]; next_cursor: string | null };

/** THROWS on failure, like fetchInvoices: an empty calendar and a broken call
 *  must not look the same on the page. */
export async function fetchUpcoming(
  accessToken: string,
  cursor: string | null,
): Promise<UpcomingPage> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const res = await fetch(`${baseUrl}/api/v1/me/portal/upcoming${q}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new PortalApiError(res.status, `API ${res.status}: /api/v1/me/portal/upcoming`);
  return res.json() as Promise<UpcomingPage>;
}

/**
 * Every invoice this person has, newest first, across every app. One call —
 * it used to be one per membership, which is the shape Membership's own
 * endpoint has and the reason thread tickets and meet bookings were missing
 * from this page entirely.
 *
 * THROWS on failure. It used to return an empty list, which made the tab
 * incapable of telling "you have no invoices" from "the call broke" — and
 * that cost an hour on 2026-10-13, chasing a reported missing invoice whose
 * row, query and endpoint all turned out to be fine. A list that cannot fail
 * out loud makes every future report of this unanswerable.
 *
 * The caller (lib/session.ts) still keeps the other three tabs standing; the
 * difference is that the Purchases tab now says so instead of lying quietly.
 */
export async function fetchInvoices(accessToken: string): Promise<PortalInvoice[]> {
  const res = await fetch(`${baseUrl}/api/v1/me/invoices`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new PortalApiError(res.status, `API ${res.status}: /api/v1/me/invoices`);
  const body = (await res.json()) as { items?: PortalInvoice[] };
  return body.items ?? [];
}

/** The member's own details — the only thing on this surface they can
 *  change. Name reaches every community that knows their email; language is
 *  identity-level and is what the emails and the chrome read. */
export type MyProfile = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  locale: string | null;
  /** How many communities a name change will reach. Said before they save. */
  person_rows: number;
};

export async function fetchProfile(accessToken: string): Promise<MyProfile | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/me/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as MyProfile;
  } catch {
    return null;
  }
}

/**
 * Save the details. Goes through this app's own route handler rather than
 * straight to the API, so the session token never reaches the browser — the
 * same reason the .ics and the invoice PDF are served here.
 */
export async function saveProfile(patch: {
  first_name?: string;
  last_name?: string;
  locale?: string;
}): Promise<void> {
  const res = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new PortalApiError(res.status, body?.error ?? 'could not save');
  }
}

/** The file itself, through this app's own route — a plain link cannot carry
 *  a bearer token, which is why the route exists. */
export function invoicePdfUrl(id: string): string {
  return `/invoices/${id}/pdf`;
}

export async function fetchPortal(accessToken: string): Promise<Portal> {
  const res = await fetch(`${baseUrl}/api/v1/me/portal`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new PortalApiError(res.status, `API ${res.status}: /api/v1/me/portal`);
  return res.json() as Promise<Portal>;
}

// The QR and both wallet passes are already served by Thread, keyed on the
// check-in code, which this app holds. So these are URL builders, not fetches
// — the portal added no API surface to show a ticket.
const checkinBase = (code: string) => `${baseUrl}/api/v1/thread/public/checkin/${code}`;

/** The QR the door scans. Served by the API from the check-in code. */
export function ticketQrUrl(code: string): string {
  return `${checkinBase(code)}/qr.png`;
}

/** Apple Wallet pass (.pkpass). Only offer it when `portal.wallet.apple`. */
export function appleWalletUrl(code: string): string {
  return `${checkinBase(code)}/apple.pkpass`;
}

/** 302 to Google's save-to-wallet. Only offer it when `portal.wallet.google`. */
export function googleWalletUrl(code: string): string {
  return `${checkinBase(code)}/google`;
}

/**
 * Add-to-calendar for ONE agenda item. Served by this app, not the API,
 * because a calendar download is a plain link and a plain link cannot carry
 * a bearer token — the route handler has the session cookie and re-reads the
 * portal server-side, so the file is scoped to the person exactly as the
 * page is. Agenda items only: they carry real timestamps, where a thread
 * carries dates and would need all-day VEVENTs for no benefit.
 */
export function agendaIcsUrl(threadId: string, itemId: string): string {
  return `/ics/${threadId}/${itemId}`;
}

/**
 * Whether this person has a calendar subscription, the address itself, and
 * whether anything is actually collecting it.
 *
 * `url` is null only for an address minted before 2026-09-24, when nothing
 * but a hash was stored. Nothing can recover those, so the page offers a new
 * address rather than a broken promise.
 */
export type CalendarStatus = {
  subscribed: boolean;
  created_at: string | null;
  last_read_at: string | null;
  url: string | null;
  webcal: string | null;
};

export async function fetchCalendarStatus(accessToken: string): Promise<CalendarStatus> {
  const none: CalendarStatus = {
    subscribed: false,
    created_at: null,
    last_read_at: null,
    url: null,
    webcal: null,
  };
  try {
    const res = await fetch(`${baseUrl}/api/v1/me/portal/calendar`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return none;
    return (await res.json()) as CalendarStatus;
  } catch {
    return none;
  }
}

/** Mint an address, retiring any previous one. Through this app's route, so
 *  the browser never holds an access token. */
export async function createCalendar(): Promise<CalendarStatus> {
  const res = await fetch('/api/calendar', { method: 'POST' });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new PortalApiError(res.status, body?.error ?? 'could not create a calendar address');
  }
  return (await res.json()) as CalendarStatus;
}

export async function deleteCalendar(): Promise<void> {
  const res = await fetch('/api/calendar', { method: 'DELETE' });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new PortalApiError(res.status, body?.error ?? 'could not stop the calendar');
  }
}

/**
 * Add-to-calendar for a WHOLE thread — every dated session in one file.
 *
 * Same route family as `agendaIcsUrl`, same reason it lives in this app: a
 * download is a plain link and a plain link cannot carry a bearer token.
 */
export function threadIcsUrl(threadId: string): string {
  return `/ics/${threadId}`;
}

/** The certificate's own page — where a holder sends someone to verify it,
 *  and where "View online" goes. Served by The Thread, not by this app: it is
 *  public by design, addressed by the number alone, and needs no session.
 *
 *  The origin is taken from the thread's OWN public url rather than from an
 *  environment variable, so a certificate on the staging stack links to
 *  staging without this app having to know which stack it is on — the same
 *  mistake the portal's calendar address made and had to be fixed for. */
export function certificateUrl(number: string, threadUrl: string): string {
  let origin: string;
  try {
    origin = new URL(threadUrl).origin;
  } catch {
    return `/certificate/${encodeURIComponent(number)}`;
  }
  return `${origin}/certificate/${encodeURIComponent(number)}`;
}

/** The snapshot a thumbnail renders from. Public — the number IS the
 *  capability, exactly as it is for the verification page — so this needs no
 *  bearer and can be fetched from the browser. */
export async function fetchCertificate(
  number: string,
): Promise<{ certificate_number: string; recipient_name: string; issued_at: string; template_snapshot: unknown } | null> {
  try {
    const res = await fetch(
      `${baseUrl}/api/v1/thread/public/certificate/${encodeURIComponent(number)}`,
      { cache: 'force-cache' },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** What a removal request would mean for this person. Read before they ask,
 *  because finding out afterwards is how a right becomes a grievance. */
export type ErasurePicture = {
  pending: { id: string; requested_at: string; due_at: string } | null;
  removes: { workspaces: number; enrolments: number; bookings: number; memberships: number };
  kept: { invoices: number };
  blocked: { upcoming_threads: number; participants_affected: number; workspaces: string[] };
};

export async function fetchErasure(accessToken: string): Promise<ErasurePicture | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/me/portal/erasure`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as ErasurePicture;
  } catch {
    return null;
  }
}

export async function requestErasure(reason: string | null): Promise<ErasurePicture> {
  const res = await fetch('/api/erasure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new PortalApiError(res.status, body?.error ?? 'could not send that request');
  }
  return (await res.json()) as ErasurePicture;
}

// ── member directory (slice 2a) ───────────────────────────────────────────
//
// The member's own choice, per community. OPT-IN: `listed` is false until
// they say otherwise, and nothing lists anybody who has not.

export type DirectoryChoice = {
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  listed: boolean;
  /** null = follow the community's default, which is reported beside it. */
  show_contact: boolean | null;
  workspace_show_contact_default: boolean;
  /** Whether this community has a member list at all. */
  directory_enabled: boolean;
};

/** Read server-side while the YOU page renders.
 *
 *  NULL means the call failed; [] means no communities. Both hide the
 *  switches — a privacy control showing a state we are unsure of is the one
 *  wrong thing to render — but only one of them is worth telling somebody
 *  about, and a page cannot say which if both look the same. */
export async function fetchDirectoryChoices(
  accessToken: string,
): Promise<DirectoryChoice[] | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/membership/portal/me/directory`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { items?: DirectoryChoice[] };
    return body.items ?? [];
  } catch {
    return null;
  }
}

export async function saveDirectoryChoice(input: {
  workspace_id: string;
  listed?: boolean;
  show_contact?: boolean | null;
}): Promise<void> {
  const res = await fetch('/api/directory', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new PortalApiError(res.status, body?.error ?? 'could not save that choice');
  }
}

export type DirectoryMember = {
  person_id: string;
  display_name: string;
  photo_url: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  tags: string[];
  categories: string[];
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  website_url: string | null;
};

export type DirectoryList =
  | {
      state: 'ok';
      items: DirectoryMember[];
      /** Whether the viewer APPEARS in the list. A consent decision about
       *  their own data, and nothing else — it does not decide whether the
       *  list renders. */
      you_are_listed: boolean;
      /** Whether the viewer may READ the list: a member in good standing.
       *  Separate from `you_are_listed` since 2026-10-14, when consent
       *  stopped buying access. */
      can_view: boolean;
    }
  | { state: 'none' }
  | { state: 'failed' };

/** The member list of one community.
 *
 *  THREE OUTCOMES, not two, and they must not be collapsed. `none` means
 *  this community has no directory — a 404, a real answer. `failed` means we
 *  could not find out. An empty `ok` means the directory exists and nobody
 *  has opted in yet. A page that renders all three the same is the empty
 *  that reads as working. */
export async function fetchDirectoryMembers(
  accessToken: string,
  workspaceId: string,
): Promise<DirectoryList> {
  try {
    const res = await fetch(
      `${baseUrl}/api/v1/membership/portal/me/directory/${encodeURIComponent(workspaceId)}/members`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' },
    );
    if (res.status === 404 || res.status === 403) return { state: 'none' };
    if (!res.ok) return { state: 'failed' };
    const body = (await res.json()) as {
      items?: DirectoryMember[];
      you_are_listed?: boolean;
      can_view?: boolean;
    };
    return {
      state: 'ok',
      items: body.items ?? [],
      you_are_listed: Boolean(body.you_are_listed),
      // AN OLDER API DOES NOT SEND IT, and `Boolean(undefined)` would hide
      // the list from everybody for the minutes the two halves are out of
      // step. Absent, fall back to the rule that API still enforces — the
      // viewer must be listed — so a stale pairing behaves like the old
      // system rather than like a broken one.
      can_view: body.can_view ?? Boolean(body.you_are_listed),
    };
  } catch {
    return { state: 'failed' };
  }
}
