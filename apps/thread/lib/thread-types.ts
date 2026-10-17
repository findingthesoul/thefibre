// Shared shapes for The Thread's own API payloads.
// PostgREST returns FK joins as object-or-array depending on the relation;
// normalize with one() before use.

import type { Locale } from '@/lib/i18n';

export type ProgramCore = {
  id: string;
  title: string;
  format: 'event' | 'journey';
  status: 'draft' | 'active' | 'completed' | 'archived';
  starts_on: string | null;
  ends_on: string | null;
};

export type OrganiserCore = {
  id: string;
  slug: string;
  display_name: string | null;
  user_id: string;
};

export type ThreadRow = {
  id: string;
  /** This thread's own refund rule (refund rules, slice 2). null = the
   *  workspace's default; {steps: []} = no rule for this thread. */
  refund_rule?: { steps: { until_days_before: number; refund_pct: number }[]; fee_cents?: number } | null;
  /** The main facilitator's host row, or null = the organiser. */
  main_facilitator_id?: string | null;
  /** On the thread list: you host or facilitate this thread (null when you
   *  organise it or hold no role). Absent on older APIs. */
  my_role?: 'host' | 'facilitator' | null;
  /** On the thread list: calendar changes waiting for SEND. Absent on older
   *  APIs (no badge). */
  unsent_changes?: number;
  meeting_room?: MeetingRoom | null;
  /** Each account-holding host's personal room, by host row id. */
  room_by_host?: Record<string, string | null>;
  /** Why it could not go live with sign-up open (paid, no working payment
   *  route), or null. From GET /threads/:id; absent on older APIs. */
  publish_blocker?: string | null;
  /** Is this thread's SELLER VAT-registered (organiser first, then team or
   *  workspace)? Only then does a ticket offer "Price includes VAT". From
   *  GET /threads/:id; absent on older APIs (no switch). */
  seller_vat_registered?: boolean;
  /** "Open until session N" (2026-10-16); null = the first key moment. */
  signups_close_engagement_id?: string | null;
  /** The thread's dates as the API decided them (lib/thread-dates.ts). */
  dates?: {
    event_starts_at: string | null;
    event_ends_at: string | null;
    key_moment_count: number;
    signups_close_at: string | null;
    close_rule: 'session' | 'first_key_moment' | 'fallback' | 'none';
  } | null;
  /** On the thread LIST (GET /threads, additive — thread dates slice 4): the
   *  same four facts, at the top level, for the row's date line. */
  event_starts_at?: string | null;
  event_ends_at?: string | null;
  key_moment_count?: number;
  signups_close_at?: string | null;
  /** What in Members points at this thread (grants, product links), for the
   *  rename warning. Absent on older APIs. */
  references?: { grants: number; product_links: number };
  workspace_id: string;
  program_id: string;
  organiser_id: string;
  slug: string;
  intention: string | null;
  timezone: string;
  cover_url: string | null;
  is_public_listed: boolean;
  public_agenda: boolean;
  /** Null = inherit the workspace default; '' = this thread adds nothing. */
  enrolment_note?: string | null;
  categories?: { category: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null }[];
  requires_approval: boolean;
  /** False = the public page shows no enrolment form and /public/enrol
   *  refuses. Membership grants and manual adds still work. */
  public_enrolment_open?: boolean;
  price_cents: number | null;
  price_currency: string | null;
  payment_destination: 'workspace' | 'personal' | null;
  payment_methods: ('stripe' | 'invoice')[] | null;
  language: Locale;
  /** Free text — the language the thread is RUN in (informational; null = same as `language`). */
  facilitation_language: string | null;
  public_interaction: 'page' | 'popup';
  /** Workspace-scoped threads publish under the WORKSPACE slug
   *  (docs/brief-workspace-urls.md D1). Null = personal/team (team_id decides). */
  public_scope: 'personal' | 'team' | 'workspace' | null;
  share_participants_public: boolean | null;
  share_participants_participants: boolean | null;
  capacity: number | null;
  registration_fields: RegistrationField[];
  certificate_enabled: boolean;
  certificate_criteria: string | null;
  certificate_template_id: string | null;
  /** Set while the thread is locked — frozen as a design. Its settings,
   *  timeline, tickets, coupons, categories and co-organisers stop being
   *  editable and it can't be deleted; participants carry on enrolling. */
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
  updated_at: string;
  team_id: string | null;
  organisation_id: string | null;
  program: ProgramCore | ProgramCore[] | null;
  organiser: OrganiserCore | OrganiserCore[] | null;
  team: { id: string; name: string; slug?: string } | { id: string; name: string; slug?: string }[] | null;
  organisation: { id: string; name: string } | { id: string; name: string }[] | null;
};

export type ThreadMember = {
  /** thread_thread_organiser.id — what a main facilitator and a session's
   *  exclusion list point at. Absent on older APIs. */
  id?: string;
  role: 'host' | 'facilitator';
  organiser: OrganiserCore | OrganiserCore[] | null;
  /** A host who is a PERSON without an account (no room, no connections). */
  person?: { id: string; first_name: string | null; last_name: string | null } | { id: string; first_name: string | null; last_name: string | null }[] | null;
};

/** Whose room a thread's online sessions meet in (GET /threads/:id). */
export type MeetingRoom = {
  name: string;
  /** A named main facilitator (false = the organiser, by default). */
  is_main: boolean;
  is_me: boolean;
  url: string | null;
  /** Meet/Zoom links are made on that person's account (they said yes, or
   *  it is you); otherwise on yours. */
  allows_meetings: boolean;
};

export type WorkspaceMember = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  workspace_role: string;
};

export type TeamOption = { id: string; name: string; slug: string };

/** Ticket as exposed on the public thread payload (enrol chooser). */
export type PublicTicket = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  price_currency: string;
  /** Resolved server-side through the inheritance chain (ticket→thread→account). */
  payment_methods?: ('stripe' | 'invoice')[];
  sold_out: boolean;
  /** The price is what a home buyer pays, VAT included (2026-10-16).
   *  Absent on older APIs = excl., as before. */
  price_includes_vat?: boolean;
};

export type RegistrationField = {
  key: string;
  label: string;
  type: 'short' | 'long' | 'select' | 'checkbox';
  required: boolean;
  options?: string[];
};

// Engagement families — mirror of the API's rule: type only changes within
// its family after creation.
export const ACTIVITY_TYPES = ['event', 'conversation', 'workshop'] as const;
export const MESSAGE_TYPES = [
  'reflection',
  'practice',
  'message',
  'document',
  'inspiration',
] as const;
/** Its own family, not a ninth message — see the API's CERTIFICATE_TYPES. */
export const CERTIFICATE_TYPES = ['certificate'] as const;

export type EngagementType =
  | (typeof ACTIVITY_TYPES)[number]
  | (typeof MESSAGE_TYPES)[number]
  | (typeof CERTIFICATE_TYPES)[number];

export type TriggerKind =
  | 'fixed'
  | 'on_enrolment'
  | 'on_approval'
  | 'on_completion'
  // The seeded "application received" message on an approval-gated thread
  // (migration 20260901180000). Missing here since then: the editor handed
  // the row's own value back and the API refused it.
  | 'on_application'
  | 'relative';

/** One day's wall-clock window in a multi-day engagement (thread timezone).
 *  date 'YYYY-MM-DD', start/end 'HH:MM'. */
export type DailyTime = { date: string; start: string; end: string };

export type EngagementRow = {
  id: string;
  /** Host/facilitator rows NOT on this session; empty = everybody. */
  excluded_people?: string[] | null;
  /** Whose room this session meets in (a host row), or null = the main
   *  facilitator's. */
  room_owner_id?: string | null;
  thread_id: string;
  title: string;
  description: string | null;
  type: EngagementType;
  status: 'draft' | 'published' | 'closed';
  starts_at: string | null;
  ends_at: string | null;
  // Per-day times for multi-day activities; null = single starts_at/ends_at.
  daily_schedule: DailyTime[] | null;
  location: string | null;
  location_url: string | null;
  /** Per-engagement image — the timeline-level sibling of the thread's cover_url. */
  image_url: string | null;
  meeting_url: string | null;
  meeting_provider: 'google_meet' | 'zoom' | 'teams' | 'personal_room' | 'custom' | null;
  scheduled_at: string | null;
  // Message-family send trigger (see migration 20260702100000).
  trigger_kind: TriggerKind;
  trigger_anchor: 'start' | 'end' | 'engagement' | null;
  trigger_engagement_id: string | null;
  trigger_offset_days: number | null; // signed: negative = before anchor
  trigger_time: string | null; // 'HH:MM' in the thread's timezone
  content: Record<string, unknown>;
  position: number;
  show_in_agenda: boolean;
  /** A session that defines the public event dates (2026-10-16). */
  is_key_moment?: boolean;
  /** Does this item ask participants whether they are coming? The ONLY
   *  RSVP switch there is (Sjoerd 2026-09-09) — anything but an explicit
   *  true is off, so a new item does not ask. */
  rsvp_enabled: boolean | null;
  /** Set on the seeded transactional messages (enrolment_received /
   *  enrolment_confirmed). System messages stay deletable on every plan —
   *  they fall back to the compiled emails. */
  system_role?: string | null;
  /** Set (by the API, 2026-10-17) on an ORDINARY message that copies a
   *  system message this thread already has — both are sent. The editor
   *  flags it; nothing removes it. */
  system_twin_of?: string | null;
  created_at: string;
  updated_at: string;
};

export type OrganiserRow = OrganiserCore & {
  workspace_id: string;
  bio: string | null;
  photo_url: string | null;
  timezone: string;
  stripe_account_id: string | null;
  vendor_cut_percent: number;
  /** Does this person want a public page at all (2026-10-08)? NULL means the
   *  row predates the question and is grandfathered as published. Optional on
   *  the type because an API that predates the column omits it, and a
   *  settings screen must not break against one. */
  is_published?: boolean | null;
};

/** PostgREST join normalizer: object-or-array → object. */
export function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** Invoice billing details captured at enrolment (shape shared with the API). */
export type Billing = {
  company?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  tax_no?: string;
};
