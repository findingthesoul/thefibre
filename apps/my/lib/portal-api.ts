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
  /** Who hosts this session, by name. Additive; absent on older APIs. */
  hosts?: string[];
  /** Set when YOU host or facilitate this session. */
  my_role?: 'host' | 'facilitator' | null;
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
  /** Thread dates (additive, slice 4): what the date line is made of, and the
   *  zone it is read in. Absent on an older API — the line then falls back to
   *  the thread period. */
  event_starts_at?: string | null;
  event_ends_at?: string | null;
  key_moment_count?: number;
  signups_close_at?: string | null;
  timezone?: string | null;
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
  /** You host or facilitate this thread. A hosted-only thread lists just the
   *  sessions you are on, without RSVP, ticket or certificate. */
  my_role?: 'host' | 'facilitator' | null;
  /** Your place on this thread, its latest cancellation request, and
   *  whether you may ask now. Absent on older APIs (no button). */
  enrolment_id?: string | null;
  cancellation_request?: CancellationRequest | null;
  can_request_cancellation?: boolean;
};

export type CancellationRequest = {
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  created_at: string;
  /** The organiser's note on a rejection. */
  decision_note: string | null;
};

/** Ask to cancel a place, or withdraw the request. Through this app's route,
 *  so the browser never holds a token. */
export async function requestCancellation(enrolmentId: string, reason: string | null): Promise<void> {
  const res = await fetch('/api/cancellation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrolment_id: enrolmentId, reason }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new PortalApiError(res.status, body?.error ?? 'could not send the request');
  }
}

export async function withdrawCancellation(enrolmentId: string): Promise<void> {
  const res = await fetch('/api/cancellation', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrolment_id: enrolmentId }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new PortalApiError(res.status, body?.error ?? 'could not withdraw the request');
  }
}

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
  /** Thread dates (additive, slice 4): the rest of what a card's date line
   *  needs, and whose card choice (card_dates on the page) applies. */
  ends_on?: string | null;
  event_starts_at?: string | null;
  event_ends_at?: string | null;
  key_moment_count?: number;
  signups_close_at?: string | null;
  workspace_id?: string;
  timezone?: string | null;
  team: string;
  list_price_cents: number;
  your_price_cents: number;
  currency: string;
  /** The prices include VAT (additive; absent = excl., as before). */
  price_includes_vat?: boolean;
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
  /** The sections for the tiers this member holds (2jj), under the intro.
   *  Optional: an API from before tiers sends none. */
  tier_sections?: { tier_id: string; tier_name: string; intro_html: string }[];
  /** The directory categories' sections this member holds, under the tier
   *  sections. Optional, like tier_sections. */
  category_sections?: { category_id: string; category_name: string; intro_html: string }[];
  documents: ({ id: string; title: string; kind: 'file'; mime: string; bytes: number } | { id: string; title: string; kind: 'link'; url: string })[];
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

/** The Files page (2ij): per community, its own documents, then what each
 *  live thread has released to this person. Admitted by the API's existing
 *  readers; a file opens through /community-document. */
export type FilesGroup = {
  workspace_id: string;
  name: string;
  logo_url: string | null;
  community: CommunityView['documents'];
  threads: { thread_id: string; thread_title: string; items: { title: string; url: string; sent_at: string }[] }[];
};

export async function fetchFiles(accessToken: string): Promise<FilesGroup[]> {
  const res = await fetch(`${baseUrl}/api/v1/me/portal/files`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new PortalApiError(res.status, `API ${res.status}: /api/v1/me/portal/files`);
  return ((await res.json()) as { items: FilesGroup[] }).items;
}

/** One thing a member was told (type + subject + date — never a body). */
export type MemberNotification = {
  id: string;
  kind: 'new_thread' | 'session_added' | 'session_moved' | 'session_cancelled';
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
export type UpcomingPage = {
  entitled: boolean;
  items: CouldJoin[];
  next_cursor: string | null;
  /** Each community's card date choice, by workspace id (additive, slice 4). */
  card_dates?: Record<string, unknown>;
};

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
  /** THE ONE PROFILE — identity_profile, the row Settings → Profile in The
   *  Fibre edits (additive, 2026-10-16). Absent from an API older than that;
   *  the profile section is then not shown. */
  face?: ProfileFace;
  /** As given at the last checkout; read-only (additive, 2026-10-15). */
  billing_details?: {
    company: string | null;
    address: string | null;
    postal_code: string | null;
    city: string | null;
    country: string | null;
    tax_no: string | null;
  } | null;
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
export type ProfileFace = {
  display_name: string | null;
  bio: string | null;
  short_bio: string | null;
  photo_url: string | null;
  timezone: string | null;
  city: string | null;
  website_url: string | null;
  linkedin_url: string | null;
};

/** A refusal the API tied to a field (bio too long, a link without https). */
export class ProfileFieldError extends Error {
  constructor(message: string, public fieldErrors: Record<string, string[] | undefined>) {
    super(message);
  }
}

export async function saveProfile(patch: {
  first_name?: string;
  last_name?: string;
  locale?: string;
  /** photo_url may only be null (remove); a photo is set by uploading it. */
  face?: Partial<Omit<ProfileFace, 'photo_url'>> & { photo_url?: null };
}): Promise<void> {
  const res = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; fieldErrors?: Record<string, string[]> } | null;
    if (body?.fieldErrors) throw new ProfileFieldError(body.error ?? 'could not save', body.fieldErrors);
    throw new PortalApiError(res.status, body?.error ?? 'could not save');
  }
}

/** Upload your photo; it is saved to your profile at once and the URL comes
 *  back. Through this app's own route, so the token stays on the server. */
export async function uploadProfilePhoto(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/profile/photo', { method: 'POST', body: form });
  const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !body?.url) throw new PortalApiError(res.status, body?.error ?? 'could not upload');
  return body.url;
}

/** The file itself, through this app's own route — a plain link cannot carry
 *  a bearer token, which is why the route exists. */
export function invoicePdfUrl(id: string): string {
  return `/invoices/${id}/pdf`;
}

/** What the frame (nav, bell) needs on every page — GET /me/nav. The same
 *  three values /me/portal carries, without the rest of it. */
export type PortalNav = {
  upcoming: boolean;
  communities: number;
  unread_notifications: number;
  /** The reader's chosen language (identity_profile.locale), or null. Absent
   *  from an API older than 2026-10-16 and from the /me/portal fallback below
   *  — lib/locale.ts reads either as "no choice made". */
  locale?: string | null;
};

export async function fetchNav(accessToken: string): Promise<PortalNav> {
  const res = await fetch(`${baseUrl}/api/v1/me/nav`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  // Anything but OK or a refused session → ask the old way. Above all a 404,
  // which means an API older than this page: the frontend and the API deploy
  // separately (Vercel builds the branch; Fly is a second step, and on
  // production batch-prod promotes the web apps FIRST), so for a few minutes
  // after a release this app can be newer than the API it calls. v1.215.0
  // showed what that costs on staging: my.thread's error page on every page
  // until the API caught up. A 401 is not that — it is "signed out", and
  // loadFrame turns it into the sign-in page.
  if (!res.ok && res.status !== 401) {
    const p = await fetchPortal(accessToken);
    return {
      upcoming: !!p.upcoming,
      communities: p.communities ?? 0,
      unread_notifications: p.unread_notifications ?? 0,
    };
  }
  if (!res.ok) throw new PortalApiError(res.status, `API ${res.status}: /api/v1/me/nav`);
  return res.json() as Promise<PortalNav>;
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

/** A membership's renewal, as Stripe will do it (my.thread → Purchases, P1). */
export type MyRenewal = {
  member_id: string;
  community: string;
  tier: string;
  status: string;
  /** Manual, comped or invoiced: nothing renews through a card here. */
  managed_by_community: boolean;
  unavailable?: boolean;
  renews_at?: string | null;
  stops_at_period_end?: boolean;
  next_invoice?: { total: number; tax: number; subtotal: number; currency: string } | null;
};

/** A product subscribed to on its own (2026-10-16): one per subscription. */
export type MyProductSubscription = {
  subscription_id: string;
  community: string;
  products: string[];
  status: string;
  unavailable?: boolean;
  renews_at?: string | null;
  stops_at_period_end?: boolean;
  next_invoice?: { total: number; tax: number; subtotal: number; currency: string } | null;
};

export async function fetchRenewals(accessToken: string): Promise<{ memberships: MyRenewal[]; products: MyProductSubscription[] } | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/membership/portal/me/renewals`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { items?: MyRenewal[]; product_subscriptions?: MyProductSubscription[] };
    // product_subscriptions is additive: an API one release behind sends none.
    return { memberships: body.items ?? [], products: body.product_subscriptions ?? [] };
  } catch {
    return null;
  }
}

/** The member's billing details as a buyer (Purchases, P2). */
export type BuyerDetails = {
  name: string | null;
  company: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  tax_no: string | null;
  /** Not saved yet: the last checkout's details, shown as a start. */
  from_checkout?: boolean;
};

export async function fetchBuyerDetails(accessToken: string): Promise<BuyerDetails | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/membership/portal/me/billing-details`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    return res.ok ? ((await res.json()) as BuyerDetails) : null;
  } catch {
    return null;
  }
}

/** The shop (GET /membership/portal/me/shop, lib/shop.ts in the API): per
 *  community the person belongs to or bought from, what they may add to their
 *  membership, buy or subscribe to without one, and what they already have. */
export type ShopCommunity = {
  workspace_id: string;
  workspace_slug: string;
  workspace_name: string;
  member_id: string | null;
  members_only: { id: string; name: string; price_cents: number | null; currency: string; recurring: boolean; price_interval: string | null; action: 'add_to_membership' }[];
  open: { id: string; name: string; description: string | null; price_cents: number; price_interval: string; currency: string; price_includes_vat: boolean; action: 'buy' | 'subscribe' }[];
  owned: { id: string; name: string; recurring: boolean }[];
};

/** Null when the call failed — never an empty shop, which would read as
 *  "nothing to offer". */
export async function fetchShop(accessToken: string): Promise<ShopCommunity[] | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/membership/portal/me/shop`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return ((await res.json()) as { communities: ShopCommunity[] }).communities;
  } catch {
    return null;
  }
}
