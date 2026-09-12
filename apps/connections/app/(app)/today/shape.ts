// The shape Today is rendered from — no 'use client' on this file, and that
// is the whole point of it existing.
//
// HORIZONS lived in client.tsx and page.tsx imported it to validate the
// ?horizon= param. That typechecks and crashes at runtime: Next replaces the
// exports of a 'use client' module with client-reference proxies when a
// SERVER component imports them, so the array arrives as a proxy and
// `.includes` is not a function. Types are erased, so the compiler sees
// nothing wrong — it surfaced only on the first render of the page.
//
// Rule this file encodes: a runtime VALUE shared between a server component
// and a client component belongs in a module that is neither.

export const HORIZONS = ['today', 'tomorrow', 'week', 'next_week'] as const;
export type Horizon = (typeof HORIZONS)[number];

export type PersonRef = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type OwedRow = {
  id: string;
  title: string;
  due_at: string;
  overdue: boolean;
  person: PersonRef | null;
  organisation: { id: string; name: string } | null;
  /** Estimated minutes — the kind's default, never asked for. */
  minutes: number;
};

export type PrepareSignal =
  | 'thread_unreached'
  | 'thread_unpaid'
  | 'meeting_brief'
  | 'money_uninvoiced';

export type PrepareRow = {
  id: string;
  signal: PrepareSignal;
  /** When this becomes work — happens_at minus lead_days. The lead-time rule
   *  lives in this field, and it is what decides the segment, never
   *  happens_at. */
  prepare_at: string;
  happens_at: string;
  lead_days: number;
  days_until: number;
  subject: string;
  /** Counts, not a phrased sentence — so the same fact says itself in six
   *  languages. */
  count: number | null;
  of: number | null;
  days_since_spoken: number | null;
  amount_cents: number | null;
  currency: string | null;
  person_id: string | null;
  person: PersonRef | null;
  /** Exactly one destination, never a menu. */
  link: { kind: 'person' | 'thread'; id: string } | null;
  /** Estimated minutes; per-person signals already multiplied by count. */
  minutes: number;
};

export type TodayPayload = {
  now: string;
  horizon: Horizon;
  /** free_minutes: unbooked working time in the same stretch, from the
   *  calendar. null when there is no calendar to ask — never read as zero. */
  segments: { key: Horizon; count: number; minutes: number; free_minutes: number | null }[];
  calendar: 'none' | 'unavailable' | 'ok';
  owed: OwedRow[];
  prepare: PrepareRow[];
};
