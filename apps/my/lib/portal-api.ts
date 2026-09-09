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
 * A membership invoice, from the platform purchase ledger. Fetched from
 * Membership's OWN email-scoped portal endpoint rather than added to
 * `/me/portal`: the route exists, is deployed and is verified, and the
 * cheapest correct thing is to call it rather than widen this payload.
 */
export type PortalInvoice = {
  id: string;
  item_label: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  stripe_invoice_url: string | null;
};

export type MembershipItem = {
  member_id: string;
  tier: string | null;
  status: string;
  started_at: string | null;
  renews_at: string | null;
};

export type Group = {
  workspace_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  tickets: Ticket[];
  threads: ThreadItem[];
  meets: MeetItem[];
  memberships: MembershipItem[];
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
};

/**
 * One membership's invoices. Per membership rather than in one call, because
 * that is the shape the endpoint has and Membership's own /my already uses
 * it (apps/membership/app/my/page.tsx). A failure returns an empty list
 * rather than throwing: someone with three memberships and one bad workspace
 * should still see the other two, not an error page.
 */
export async function fetchInvoices(
  accessToken: string,
  memberId: string,
): Promise<PortalInvoice[]> {
  try {
    const res = await fetch(
      `${baseUrl}/api/v1/membership/portal/me/invoices?member_id=${encodeURIComponent(memberId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' },
    );
    if (!res.ok) return [];
    const body = (await res.json()) as { items?: PortalInvoice[] };
    return body.items ?? [];
  } catch {
    return [];
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
