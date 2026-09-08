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
};

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

export type Portal = {
  person: { first_name: string | null; last_name: string | null; email: string };
  groups: Group[];
};

export async function fetchPortal(accessToken: string): Promise<Portal> {
  const res = await fetch(`${baseUrl}/api/v1/me/portal`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new PortalApiError(res.status, `API ${res.status}: /api/v1/me/portal`);
  return res.json() as Promise<Portal>;
}

/** The QR the door scans. Served by the API from the check-in code. */
export function ticketQrUrl(code: string): string {
  return `${baseUrl}/api/v1/thread/public/checkin/${code}/qr.png`;
}
